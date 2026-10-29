const mongoose = require('mongoose');

// Module B: Smart Campus Ride-Pooling
// Schema for Ride Offers and Matching between SPIT students/faculty

const RideOfferSchema = new mongoose.Schema({
  driverEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  driverName: { type: String, required: true },
  driverPhone: { type: String, default: '' },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  departureTime: { type: Date, required: true, index: true },
  totalSeats: { type: Number, required: true, min: 1, max: 6 },
  availableSeats: { type: Number, required: true, min: 0 },
  farePerSeat: { type: Number, default: 0 }, // 0 for free campus carpool
  status: { type: String, enum: ['scheduled', 'ongoing', 'completed', 'cancelled'], default: 'scheduled', index: true },
  vehicleModel: { type: String, default: '' },
  waypoints: [String],
  passengers: [{
    studentEmail: String,
    studentName: String,
    seatsBooked: Number,
    bookedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

RideOfferSchema.index({ origin: 1, destination: 1, status: 1 });
RideOfferSchema.index({ departureTime: 1, status: 1 });

const RideRequestSchema = new mongoose.Schema({
  passengerEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  passengerName: { type: String, required: true },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  desiredDepartureTime: { type: Date, required: true },
  seatsRequired: { type: Number, default: 1 },
  matchedRideId: { type: mongoose.Schema.Types.ObjectId, ref: 'RideOffer', default: null },
  status: { type: String, enum: ['searching', 'matched', 'completed', 'cancelled'], default: 'searching', index: true }
}, { timestamps: true });

const RideOffer = mongoose.models.RideOffer || mongoose.model('RideOffer', RideOfferSchema);
const RideRequest = mongoose.models.RideRequest || mongoose.model('RideRequest', RideRequestSchema);

module.exports = {
  RideOffer,
  RideRequest
};
