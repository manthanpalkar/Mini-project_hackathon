const { RecurringRideTemplate, RideOffer } = require('../models/rideModel');
const { campusGraphInstance } = require('./campusGraphService');
const { createNotification } = require('./rideNotificationService');

/**
 * UniVerse Module B: Recurring Commute Offers Service
 * Allows students to schedule recurring weekday commutes with idempotent instance generation.
 */
class RecurringRideService {
  constructor() {
    this.graph = campusGraphInstance;
  }

  /**
   * Creates a recurring ride schedule template.
   */
  async createTemplate({
    driverId = null,
    driverEmail,
    driverName,
    driverPhone = '',
    originNodeId,
    destinationNodeId,
    departureTimeOfDay, // e.g. "08:45"
    daysOfWeek = ['mon', 'tue', 'wed', 'thu', 'fri'],
    startDate = new Date(),
    endDate = null,
    totalSeats = 3,
    costPerSeat = 20,
    maxDetourKm = 2.0,
    vehicleType = 'car',
    vehicleModel = '',
    vehicleNumber = '',
    contactSharing = {}
  }) {
    if (!originNodeId || !destinationNodeId || !departureTimeOfDay) {
      throw { status: 400, message: 'Origin, destination, and departureTimeOfDay are required.' };
    }

    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      throw { status: 400, message: 'At least one day of the week must be selected.' };
    }

    // Validate time format "HH:mm"
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(departureTimeOfDay)) {
      throw { status: 400, message: 'departureTimeOfDay must be in 24-hour format HH:mm (e.g. 08:45).' };
    }

    if (!this.graph.isValidNode(originNodeId) || !this.graph.isValidNode(destinationNodeId)) {
      throw { status: 400, message: 'Origin or destination is not a recognized campus node.' };
    }

    const originNode = this.graph.getNode(originNodeId);
    const destNode = this.graph.getNode(destinationNodeId);

    const template = await RecurringRideTemplate.create({
      driverId,
      driverEmail: driverEmail.toLowerCase().trim(),
      driverName,
      driverPhone,
      originNodeId,
      destinationNodeId,
      originName: originNode ? originNode.name : originNodeId,
      destinationName: destNode ? destNode.name : destinationNodeId,
      departureTimeOfDay,
      daysOfWeek: daysOfWeek.map(d => d.toLowerCase().trim()),
      timeZone: 'Asia/Kolkata',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      totalSeats: Math.max(1, Math.min(6, parseInt(totalSeats, 10) || 3)),
      costPerSeat: Math.max(0, parseFloat(costPerSeat) || 0),
      maxDetourKm: Math.max(0.5, Math.min(10, parseFloat(maxDetourKm) || 2.0)),
      vehicleType,
      vehicleModel,
      vehicleNumber,
      contactSharing: {
        enabled: Boolean(contactSharing.enabled),
        phone: contactSharing.phone || driverPhone,
        allowWhatsApp: contactSharing.allowWhatsApp !== false,
        allowCall: contactSharing.allowCall !== false
      },
      enabled: true
    });

    return template;
  }

  /**
   * Previews upcoming occurrence timestamps for a template without database writes.
   */
  previewOccurrences(template, horizonDays = 7) {
    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const targetDays = (template.daysOfWeek || []).map(d => dayMap[d.toLowerCase()]).filter(d => d !== undefined);

    const [hours, minutes] = template.departureTimeOfDay.split(':').map(Number);
    const occurrences = [];
    const now = new Date();
    const startDate = new Date(template.startDate || now);
    const endDate = template.endDate ? new Date(template.endDate) : null;

    for (let i = 0; i < horizonDays; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hours, minutes, 0, 0);

      // Check boundaries
      if (d <= now) continue;
      if (d < startDate) continue;
      if (endDate && d > endDate) continue;

      if (targetDays.includes(d.getDay())) {
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        occurrences.push({
          departureTime: d,
          dateKey,
          occurrenceKey: `${template._id || template.id}_${dateKey}`
        });
      }
    }

    return occurrences;
  }

  /**
   * Idempotently generates individual RideOffer instances from a template.
   */
  async generateOccurrences(templateId, horizonDays = 7) {
    const template = await RecurringRideTemplate.findById(templateId);
    if (!template) {
      throw { status: 404, message: 'Recurring ride template not found.' };
    }

    if (!template.enabled) {
      return { generatedCount: 0, rides: [], message: 'Template is paused; no rides generated.' };
    }

    const baselineRoute = this.graph.findShortestPath(template.originNodeId, template.destinationNodeId);
    if (!baselineRoute) {
      throw { status: 400, message: 'No valid road route exists between template origin and destination.' };
    }

    const preview = this.previewOccurrences(template, horizonDays);
    const generatedRides = [];

    for (const occ of preview) {
      const existing = await RideOffer.findOne({
        recurringTemplateId: template._id,
        occurrenceKey: occ.occurrenceKey
      });

      if (!existing) {
        const ride = await RideOffer.create({
          driverId: template.driverId,
          driverEmail: template.driverEmail,
          driverName: template.driverName,
          driverPhone: template.driverPhone,
          originNodeId: template.originNodeId,
          destinationNodeId: template.destinationNodeId,
          originName: template.originName,
          destinationName: template.destinationName,
          departureTime: occ.departureTime,
          totalSeats: template.totalSeats,
          availableSeats: template.totalSeats,
          confirmedPassengerCount: 0,
          maxDetourKm: template.maxDetourKm,
          costPerSeat: template.costPerSeat,
          vehicleType: template.vehicleType,
          vehicleModel: template.vehicleModel,
          vehicleNumber: template.vehicleNumber,
          originalRoute: baselineRoute.path,
          originalDistanceKm: baselineRoute.totalDistance,
          originalDurationMins: baselineRoute.totalDuration,
          currentRoute: baselineRoute.path,
          currentDistanceKm: baselineRoute.totalDistance,
          currentDurationMins: baselineRoute.totalDuration,
          status: 'open',
          contactSharing: template.contactSharing,
          recurringTemplateId: template._id,
          occurrenceKey: occ.occurrenceKey,
          confirmedPassengers: []
        });
        generatedRides.push(ride);
      }
    }

    template.lastGeneratedDate = new Date();
    await template.save();

    return {
      generatedCount: generatedRides.length,
      rides: generatedRides,
      message: `Generated ${generatedRides.length} new upcoming ride offers.`
    };
  }

  /**
   * Pause or resume recurring schedule.
   */
  async toggleTemplate(templateId, driverEmail, enabled) {
    const template = await RecurringRideTemplate.findById(templateId);
    if (!template) throw { status: 404, message: 'Template not found.' };

    if (template.driverEmail.toLowerCase() !== driverEmail.toLowerCase()) {
      throw { status: 403, message: 'Forbidden: You can only modify your own templates.' };
    }

    template.enabled = typeof enabled === 'boolean' ? enabled : !template.enabled;
    await template.save();
    return template;
  }
}

let recurringInstance = null;
function getRecurringRideInstance() {
  if (!recurringInstance) recurringInstance = new RecurringRideService();
  return recurringInstance;
}

module.exports = {
  RecurringRideService,
  getRecurringRideInstance
};
