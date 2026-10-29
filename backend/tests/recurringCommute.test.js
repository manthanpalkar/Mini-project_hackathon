const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { RecurringRideTemplate, RideOffer } = require('../modules/moduleB_ridePooling/models/rideModel');
const { getRecurringRideInstance } = require('../modules/moduleB_ridePooling/services/recurringRideService');

describe('Module B - Recurring Commute Templates & Idempotent Generation', () => {
  let recurringService;
  const templatesStore = new Map();
  const ridesStore = new Map();

  before(() => {
    recurringService = getRecurringRideInstance();

    RecurringRideTemplate.create = async (doc) => {
      const id = new mongoose.Types.ObjectId().toString();
      const t = { _id: id, id, ...doc, save: async function() { return this; } };
      templatesStore.set(id, t);
      return t;
    };

    RecurringRideTemplate.findById = async (id) => templatesStore.get(String(id)) || null;

    RideOffer.findOne = async (query) => {
      const key = `${query.recurringTemplateId}_${query.occurrenceKey}`;
      return ridesStore.get(key) || null;
    };

    RideOffer.create = async (doc) => {
      const id = new mongoose.Types.ObjectId().toString();
      const r = { _id: id, id, ...doc };
      const key = `${doc.recurringTemplateId}_${doc.occurrenceKey}`;
      ridesStore.set(key, r);
      return r;
    };
  });

  test('Valid template creates recurring schedule with Asia/Kolkata timezone', async () => {
    const template = await recurringService.createTemplate({
      driverEmail: 'commuter@spit.ac.in',
      driverName: 'Regular Driver',
      originNodeId: 'andheri_station_west',
      destinationNodeId: 'spit_main_gate',
      departureTimeOfDay: '08:45',
      daysOfWeek: ['mon', 'wed', 'fri'],
      totalSeats: 3,
      costPerSeat: 25
    });

    assert.strictEqual(template.driverEmail, 'commuter@spit.ac.in');
    assert.strictEqual(template.departureTimeOfDay, '08:45');
    assert.strictEqual(template.timeZone, 'Asia/Kolkata');
    assert.strictEqual(template.enabled, true);
    assert.deepStrictEqual(template.daysOfWeek, ['mon', 'wed', 'fri']);
  });

  test('Template creation rejects invalid time formats', async () => {
    await assert.rejects(
      async () => await recurringService.createTemplate({
        driverEmail: 'commuter@spit.ac.in',
        originNodeId: 'andheri_station_west',
        destinationNodeId: 'spit_main_gate',
        departureTimeOfDay: '25:99', // Invalid
        daysOfWeek: ['mon']
      }),
      { status: 400 }
    );
  });

  test('Preview occurrences returns upcoming dates without database writes', async () => {
    const template = Array.from(templatesStore.values())[0];
    const preview = recurringService.previewOccurrences(template, 14);
    assert.ok(Array.isArray(preview));
    assert.ok(preview.length > 0);
    assert.ok(preview[0].departureTime instanceof Date);
    assert.ok(preview[0].occurrenceKey.startsWith(template._id));
  });

  test('Generate occurrences idempotently creates distinct upcoming RideOffers', async () => {
    const template = Array.from(templatesStore.values())[0];
    const result1 = await recurringService.generateOccurrences(template._id, 14);
    assert.ok(result1.generatedCount > 0);
    const initialGenerated = result1.generatedCount;

    // Running a second time on the same template must generate 0 new rides (idempotent)
    const result2 = await recurringService.generateOccurrences(template._id, 14);
    assert.strictEqual(result2.generatedCount, 0);
  });

  test('Paused template does not generate any rides', async () => {
    const template = Array.from(templatesStore.values())[0];
    await recurringService.toggleTemplate(template._id, 'commuter@spit.ac.in', false);
    assert.strictEqual(template.enabled, false);

    const result = await recurringService.generateOccurrences(template._id, 14);
    assert.strictEqual(result.generatedCount, 0);
  });
});
