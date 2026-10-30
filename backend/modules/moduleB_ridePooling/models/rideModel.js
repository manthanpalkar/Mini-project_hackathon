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

const SimulationSchema = new mongoose.Schema({
  currentWaypointIndex: { type: Number, default: 0 },
  progressFraction: { type: Number, default: 0, min: 0, max: 1 },
  lastSimulatedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['idle', 'running', 'paused', 'completed'],
    default: 'idle'
  }
}, { _id: false });

const ContactSharingSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  phone: { type: String, default: '' },
  allowWhatsApp: { type: Boolean, default: true },
  allowCall: { type: Boolean, default: true }
}, { _id: false });

const RatingsSummarySchema = new mongoose.Schema({
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  ratingsCount: { type: Number, default: 0, min: 0 }
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
  vehicleType: { type: String, enum: ['car', 'motorcycle', 'auto', 'cab_share', 'ev_scooter'], default: 'car' },
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
    enum: ['open', 'full', 'scheduled', 'in_transit', 'in_progress', 'completed', 'cancelled'],
    default: 'open',
    index: true
  },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  simulation: { type: SimulationSchema, default: () => ({}) },
  contactSharing: { type: ContactSharingSchema, default: () => ({}) },
  ratingsSummary: { type: RatingsSummarySchema, default: () => ({}) },
  recurringTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringRideTemplate', default: null },
  occurrenceKey: { type: String, default: null },
  confirmedPassengers: [ConfirmedPassengerSchema],
  cancellationReason: { type: String, default: '' }
}, { timestamps: true });

RideOfferSchema.index({ originNodeId: 1, destinationNodeId: 1, status: 1 });
RideOfferSchema.index({ departureTime: 1, status: 1 });
RideOfferSchema.index({ driverEmail: 1, status: 1 });
RideOfferSchema.index({ recurringTemplateId: 1, occurrenceKey: 1 }, { unique: true, sparse: true });

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

// Model 3: RideRating & Safety Feedback
const RideRatingSchema = new mongoose.Schema({
  rideOfferId: { type: mongoose.Schema.Types.ObjectId, ref: 'RideOffer', required: true, index: true },
  raterEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  raterName: { type: String, default: '' },
  ratedUserEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  role: { type: String, enum: ['passenger_to_driver', 'driver_to_passenger'], required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  categories: [{
    type: String,
    enum: ['punctuality', 'communication', 'etiquette', 'driving_safety', 'vehicle_condition']
  }],
  comment: { type: String, maxlength: 300, default: '' },
  isSafetyConcern: { type: Boolean, default: false },
  safetyCategory: {
    type: String,
    enum: ['', 'reckless_driving', 'harassment', 'unauthorized_vehicle', 'unresponsive', 'route_deviation'],
    default: ''
  },
  safetyDetails: { type: String, maxlength: 1000, default: '' },
  safetyStatus: {
    type: String,
    enum: ['none', 'reported', 'reviewed', 'resolved'],
    default: 'none'
  }
}, { timestamps: true });

// Enforces exactly one rating per rater per rated participant per ride
RideRatingSchema.index({ rideOfferId: 1, raterEmail: 1, ratedUserEmail: 1 }, { unique: true });

// Model 4: Recurring Commute Template
const RecurringRideTemplateSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  driverEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  driverName: { type: String, required: true },
  driverPhone: { type: String, default: '' },
  originNodeId: { type: String, required: true },
  destinationNodeId: { type: String, required: true },
  originName: { type: String, required: true },
  destinationName: { type: String, required: true },
  departureTimeOfDay: { type: String, required: true }, // Format "HH:mm" (24-hour)
  daysOfWeek: [{
    type: String,
    enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  }],
  timeZone: { type: String, default: 'Asia/Kolkata' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  totalSeats: { type: Number, required: true, min: 1, max: 6 },
  costPerSeat: { type: Number, default: 0, min: 0 },
  maxDetourKm: { type: Number, default: 2.0 },
  vehicleType: { type: String, enum: ['car', 'motorcycle', 'auto', 'cab_share', 'ev_scooter'], default: 'car' },
  vehicleModel: { type: String, default: '' },
  vehicleNumber: { type: String, default: '' },
  contactSharing: { type: ContactSharingSchema, default: () => ({}) },
  enabled: { type: Boolean, default: true, index: true },
  lastGeneratedDate: { type: Date, default: null }
}, { timestamps: true });

// Model 5: In-App Ride Notifications
const RideNotificationSchema = new mongoose.Schema({
  recipientEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  actorEmail: { type: String, lowercase: true, trim: true, default: '' },
  actorName: { type: String, default: '' },
  eventType: {
    type: String,
    enum: [
      'REQUEST_RECEIVED',
      'REQUEST_ACCEPTED',
      'REQUEST_REJECTED',
      'REQUEST_CANCELLED',
      'RIDE_CANCELLED',
      'RIDE_STARTED',
      'RIDE_COMPLETED',
      'RATING_INVITATION',
      'RECURRING_RIDE_GENERATED'
    ],
    required: true,
    index: true
  },
  rideOfferId: { type: mongoose.Schema.Types.ObjectId, ref: 'RideOffer', default: null },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'RideRequest', default: null },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false, index: true },
  readAt: { type: Date, default: null },
  actionLink: { type: String, default: '/campus-rides' }
}, { timestamps: true });

RideNotificationSchema.index({ recipientEmail: 1, read: 1, createdAt: -1 });

// Model 6: Durable Student Sustainability Outcome (Idempotent Exactly-Once Completion Accounting)
const StudentSustainabilityOutcomeSchema = new mongoose.Schema({
  rideOfferId: { type: mongoose.Schema.Types.ObjectId, ref: 'RideOffer', required: true, index: true },
  studentEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  role: { type: String, enum: ['driver', 'passenger'], required: true },
  completionTimestamp: { type: Date, required: true },
  routeDistanceKm: { type: Number, required: true },
  sharedDistanceKm: { type: Number, required: true },
  estimatedCo2SavedGrams: { type: Number, required: true },
  monetarySavedRupees: { type: Number, default: 0 },
  calculationMethodology: {
    type: String,
    default: 'UniVerse v1.0 Urban Commute Baseline (120g CO2/km)'
  },
  source: {
    type: String,
    default: 'driver_confirmed_simulated_trip'
  }
}, { timestamps: true });

// Exactly-once protection: a student cannot have duplicate completion credits for the same ride
StudentSustainabilityOutcomeSchema.index({ rideOfferId: 1, studentEmail: 1 }, { unique: true });

const RideOffer = mongoose.models.RideOffer || mongoose.model('RideOffer', RideOfferSchema);
const RideRequest = mongoose.models.RideRequest || mongoose.model('RideRequest', RideRequestSchema);
const RideRating = mongoose.models.RideRating || mongoose.model('RideRating', RideRatingSchema);
const RecurringRideTemplate = mongoose.models.RecurringRideTemplate || mongoose.model('RecurringRideTemplate', RecurringRideTemplateSchema);
const RideNotification = mongoose.models.RideNotification || mongoose.model('RideNotification', RideNotificationSchema);
const StudentSustainabilityOutcome = mongoose.models.StudentSustainabilityOutcome || mongoose.model('StudentSustainabilityOutcome', StudentSustainabilityOutcomeSchema);


// High-availability in-memory store for ride offers, requests, ratings, and templates
const IN_MEMORY_RIDES = {
  offers: [
    {
      _id: 'ride_seed_1',
      driverId: 'driver_rohan',
      driverEmail: 'rohan.sharma@spit.ac.in',
      driverName: 'Rohan Sharma (TE CSE)',
      driverPhone: '9820123456',
      originNodeId: 'andheri_station_west',
      destinationNodeId: 'spit_main_gate',
      originName: 'Andheri Railway Station (West)',
      destinationName: "SPIT Main Gate (Bhavan's Campus)",
      departureTime: new Date(Date.now() + 45 * 60 * 1000),
      totalSeats: 3,
      availableSeats: 2,
      confirmedPassengerCount: 1,
      costPerSeat: 20,
      currentRoute: ['andheri_station_west', 'spit_main_gate'],
      originalRoute: ['andheri_station_west', 'spit_main_gate'],
      currentDistanceKm: 2.2,
      currentDurationMins: 8,
      vehicleType: 'car',
      vehicleModel: 'Maruti Swift (Silver)',
      vehicleNumber: 'MH-02-CD-5421',
      status: 'open',
      ratingsSummary: { averageRating: 4.9, ratingsCount: 14 },
      confirmedPassengers: [],
      createdAt: new Date()
    },
    {
      _id: 'ride_seed_2',
      driverId: 'driver_priya',
      driverEmail: 'priya.nair@spit.ac.in',
      driverName: 'Priya Nair (BE EXTC)',
      driverPhone: '9819234567',
      originNodeId: 'dn_nagar_metro',
      destinationNodeId: 'spit_library',
      originName: 'D.N. Nagar Metro Station (Line 1 & 2A)',
      destinationName: 'SPIT Central Library & Academic Quad',
      departureTime: new Date(Date.now() + 90 * 60 * 1000),
      totalSeats: 4,
      availableSeats: 3,
      confirmedPassengerCount: 1,
      costPerSeat: 25,
      currentRoute: ['dn_nagar_metro', 'spit_main_gate', 'spit_library'],
      originalRoute: ['dn_nagar_metro', 'spit_main_gate', 'spit_library'],
      currentDistanceKm: 2.1,
      currentDurationMins: 7,
      vehicleType: 'car',
      vehicleModel: 'Hyundai i20 (White)',
      vehicleNumber: 'MH-02-AB-9876',
      status: 'open',
      ratingsSummary: { averageRating: 4.8, ratingsCount: 9 },
      confirmedPassengers: [],
      createdAt: new Date()
    },
    {
      _id: 'ride_seed_3',
      driverId: 'driver_aditya',
      driverEmail: 'aditya.joshi@spit.ac.in',
      driverName: 'Aditya Joshi (SE IT)',
      driverPhone: '9769345678',
      originNodeId: 'azad_nagar_metro',
      destinationNodeId: 'spit_gymkhana',
      originName: 'Azad Nagar Metro Station (Line 1)',
      destinationName: 'SPIT Sports Gymkhana & Ground',
      departureTime: new Date(Date.now() + 110 * 60 * 1000),
      totalSeats: 3,
      availableSeats: 2,
      confirmedPassengerCount: 1,
      costPerSeat: 20,
      currentRoute: ['azad_nagar_metro', 'spit_main_gate', 'spit_gymkhana'],
      originalRoute: ['azad_nagar_metro', 'spit_main_gate', 'spit_gymkhana'],
      currentDistanceKm: 2.4,
      currentDurationMins: 9,
      vehicleType: 'car',
      vehicleModel: 'Tata Nexon (Blue)',
      vehicleNumber: 'MH-03-EF-1234',
      status: 'open',
      ratingsSummary: { averageRating: 5.0, ratingsCount: 11 },
      confirmedPassengers: [],
      createdAt: new Date()
    }
  ],
  requests: [],
  ratings: [],
  templates: [],
  outcomes: []
};

module.exports = {
  RideOffer,
  RideRequest,
  RideRating,
  RecurringRideTemplate,
  RideNotification,
  StudentSustainabilityOutcome,
  IN_MEMORY_RIDES
};

