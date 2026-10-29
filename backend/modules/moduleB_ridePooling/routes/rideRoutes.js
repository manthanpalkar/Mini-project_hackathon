const express = require('express');
const router = express.Router();
const { RideOffer, RideRequest } = require('../models/rideModel');

// GET /api/modules/b/rides - List active ride offers
router.get('/rides', async (req, res) => {
  try {
    const rides = await RideOffer.find({ status: 'scheduled', availableSeats: { $gt: 0 } })
      .sort({ departureTime: 1 })
      .limit(50);
    res.json({ success: true, count: rides.length, data: rides });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve active ride offers', details: err.message });
  }
});

// POST /api/modules/b/rides - Create a new ride offer
router.post('/rides', async (req, res) => {
  try {
    const { driverEmail, driverName, origin, destination, departureTime, totalSeats, vehicleModel, farePerSeat } = req.body;
    if (!driverEmail || !driverName || !origin || !destination || !departureTime || !totalSeats) {
      return res.status(400).json({ error: 'Missing required ride offer fields.' });
    }
    const offer = await RideOffer.create({
      driverEmail,
      driverName,
      origin,
      destination,
      departureTime,
      totalSeats,
      availableSeats: totalSeats,
      vehicleModel,
      farePerSeat: farePerSeat || 0
    });
    res.status(201).json({ success: true, message: 'Ride offer posted successfully.', data: offer });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ride offer', details: err.message });
  }
});

// GET /api/modules/b/health - Module B status probe
router.get('/health', (req, res) => {
  res.json({
    module: 'Module B: Smart Campus Ride-Pooling',
    status: 'ready',
    version: '1.0.0'
  });
});

module.exports = router;
