const mongoose = require('mongoose');

// Module B: Smart Campus Ride-Pooling
// Schema specifications for SPIT Campus Mobility & Graph-based Ride Sharing

const ConfirmedPassengerSchema = new mongoose.Schema({
  passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  passengerEmail: { type: String, required: true, lowercase: true, trim: true },
  passengerName: { type: String, required: true },
  pickupNodeId: { type: String, required: true },
  dropoffNodeId: { type: String, required: true },
  seatsBooked: { type: Number, required: true, min: 1, default: 1 },
  fareTotal: { type: Number, default: 0 },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'RideRequest', required: true },
  confirmedAt: { type: Date, default: Date.now }
}, { _id: false });

const RideOfferSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  driverEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  driverName: { type: String, required: true },
  driverPhone: { type: String, default: '' },
  originNodeId: { type: String, required: true },
  destinationNodeId: { type: String, required: true },
  originName: { type: String, required: true },
  destinationName: { type: String, required: true },
  departureTime: { type: Date, required: true, index: true },
  totalSeats: { type: Number, required: true, min: 1, max: 6 },
  availableSeats: { type: Number, required: true, min: 0 },
  confirmedPassengerCount: { type: Number, default: 0, min: 0 },
  maxDetourKm: { type: Number, default: 2.0, min: 0.1, max: 10.0 },
  costPerSeat: { type: Number, default: 0, min: 0 }, // 0 = Free carpool
  vehicleType: { type: String, enum: ['car', 'motorcycle', 'auto', 'cab_share'], default: 'car' },
  vehicleModel: { type: String, default: '' },
  vehicleNumber: { type: String, default: '' },
  originalRoute: [{ type: String }], // Array of node IDs [D_orig, ..., D_dest]
  originalDistanceKm: { type: Number, default: 0 },
  originalDurationMins: { type: Number, default: 0 },
  currentRoute: [{ type: String }],
  currentDistanceKm: { type: Number, default: 0 },
  currentDurationMins: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['open', 'full', 'in_progress', 'completed', 'cancelled'],
    default: 'open',
    index: true
  },
  confirmedPassengers: [ConfirmedPassengerSchema],
  cancellationReason: { type: String, default: '' }
}, { timestamps: true });

RideOfferSchema.index({ originNodeId: 1, destinationNodeId: 1, status: 1 });
RideOfferSchema.index({ departureTime: 1, status: 1 });
RideOfferSchema.index({ driverEmail: 1, status: 1 });

const RideRequestSchema = new mongoose.Schema({
  passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  passengerEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  passengerName: { type: String, required: true },
  passengerPhone: { type: String, default: '' },
  rideOfferId: { type: mongoose.Schema.Types.ObjectId, ref: 'RideOffer', required: true, index: true },
  pickupNodeId: { type: String, required: true },
  dropoffNodeId: { type: String, required: true },
  pickupName: { type: String, default: '' },
  dropoffName: { type: String, default: '' },
  seatsRequested: { type: Number, required: true, min: 1, max: 4, default: 1 },
  desiredDepartureTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending',
    index: true
  },
  matchMetrics: {
    detourKm: { type: Number, default: 0 },
    detourRatio: { type: Number, default: 0 },
    extraDurationMins: { type: Number, default: 0 },
    estimatedCo2SavedGrams: { type: Number, default: 0 },
    fareEstimate: { type: Number, default: 0 },
    monetarySavings: { type: Number, default: 0 },
    matchScore: { type: Number, default: 0 },
    explanation: { type: String, default: '' }
  },
  rejectionReason: { type: String, default: '' }
}, { timestamps: true });

RideRequestSchema.index({ passengerEmail: 1, status: 1 });
RideRequestSchema.index({ rideOfferId: 1, status: 1 });
RideRequestSchema.index({ rideOfferId: 1, passengerEmail: 1 });

const RideOffer = mongoose.models.RideOffer || mongoose.model('RideOffer', RideOfferSchema);
const RideRequest = mongoose.models.RideRequest || mongoose.model('RideRequest', RideRequestSchema);

module.exports = {
  RideOffer,
  RideRequest
};
