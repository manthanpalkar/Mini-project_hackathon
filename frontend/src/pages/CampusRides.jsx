import React, { useState, useEffect, useCallback } from 'react';
import { 
  Car, Search, PlusCircle, MapPin, Calendar, Clock, Users, Leaf, 
  DollarSign, Shield, ArrowRight, CheckCircle, XCircle, AlertCircle, 
  RotateCcw, Navigation, Compass, Filter, Sparkles, ChevronRight, UserCheck,
  Play, CheckCheck, Star, MessageSquare, Phone, Repeat, Eye, Trash2
} from 'lucide-react';
import SEOHead from '../components/SEOHead';
import CampusNetworkMap from '../components/universe/CampusNetworkMap';
import {
  fetchLocations,
  searchRides,
  createRideOffer,
  fetchMyOfferedRides,
  cancelRideOffer,
  requestSeat,
  fetchMyRequests,
  cancelRideRequest,
  fetchRequestsForRide,
  acceptRideRequest,
  rejectRideRequest,
  fetchSustainabilityMetrics,
  computeRoute,
  startRide,
  completeRide,
  fetchRideProgress,
  advanceSimulation,
  submitRating,
  fetchAuthorizedDriverContact,
  createRecurringTemplate,
  fetchMyRecurringTemplates,
  toggleRecurringTemplate,
  deleteRecurringTemplate,
  generateRecurringOccurrences,
  fetchMySustainabilityOutcomes
} from '../utils/rideApi';

export default function CampusRides() {
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'offer' | 'mine' | 'recurring' | 'network'
  const [locations, setLocations] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search state
  const [searchOrigin, setSearchOrigin] = useState('andheri_station_west');
  const [searchDest, setSearchDest] = useState('spit_main_gate');
  const [searchTime, setSearchTime] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [searchSeats, setSearchSeats] = useState(1);
  const [searchMaxDetour, setSearchMaxDetour] = useState(2.5);
  const [searchResults, setSearchResults] = useState(null);

  // Offer Ride state
  const [offerOrigin, setOfferOrigin] = useState('andheri_station_west');
  const [offerDest, setOfferDest] = useState('spit_main_gate');
  const [offerTime, setOfferTime] = useState(() => {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [offerSeats, setOfferSeats] = useState(3);
  const [offerCost, setOfferCost] = useState(20);
  const [offerDetour, setOfferDetour] = useState(2.0);
  const [offerVehicleType, setOfferVehicleType] = useState('car');
  const [offerVehicleModel, setOfferVehicleModel] = useState('Honda City');
  const [offerVehicleNumber, setOfferVehicleNumber] = useState('MH-02-CD-5421');
  const [offerPhone, setOfferPhone] = useState('9876543210');
  const [offerAllowContact, setOfferAllowContact] = useState(true);
  const [offerPreviewRoute, setOfferPreviewRoute] = useState(null);

  // My Rides & Requests state
  const [myOfferedRides, setMyOfferedRides] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [activeDriverRideId, setActiveDriverRideId] = useState(null);
  const [driverRideRequests, setDriverRideRequests] = useState([]);
  const [activeTripProgress, setActiveTripProgress] = useState(null);
  const [myOutcomes, setMyOutcomes] = useState(null);

  // Contact Drawer state
  const [contactModalData, setContactModalData] = useState(null);

  // Rating Modal state
  const [ratingModalRide, setRatingModalRide] = useState(null);
  const [selectedStars, setSelectedStars] = useState(5);
  const [selectedCategories, setSelectedCategories] = useState(['punctuality', 'driving_safety']);
  const [ratingComment, setRatingComment] = useState('');
  const [isSafetyConcern, setIsSafetyConcern] = useState(false);
  const [safetyCategory, setSafetyCategory] = useState('');
  const [safetyDetails, setSafetyDetails] = useState('');

  // Recurring Commute Templates state
  const [recurringTemplates, setRecurringTemplates] = useState([]);
  const [recOrigin, setRecOrigin] = useState('andheri_station_west');
  const [recDest, setRecDest] = useState('spit_main_gate');
  const [recTimeOfDay, setRecTimeOfDay] = useState('08:45');
  const [recDays, setRecDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [recSeats, setRecSeats] = useState(3);
  const [recCost, setRecCost] = useState(20);

  // Map inspection state
  const [inspectRoute, setInspectRoute] = useState([]);

  // Load locations and sustainability metrics
  const loadInitialData = useCallback(async () => {
    try {
      const [locs, mets] = await Promise.all([
        fetchLocations().catch(() => []),
        fetchSustainabilityMetrics().catch(() => null)
      ]);
      setLocations(locs);
      setMetrics(mets);
    } catch (err) {
      console.error('Initialization error:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Compute baseline driver route preview when offer origin/dest changes
  useEffect(() => {
    if (offerOrigin && offerDest && offerOrigin !== offerDest) {
      computeRoute(offerOrigin, offerDest)
        .then(res => {
          setOfferPreviewRoute(res);
          setInspectRoute(res.path || []);
        })
        .catch(() => setOfferPreviewRoute(null));
    }
  }, [offerOrigin, offerDest]);

  // Load data for 'mine' tab
  const loadMyData = useCallback(async () => {
    setLoading(true);
    try {
      const [offered, reqs, outcomes] = await Promise.all([
        fetchMyOfferedRides().catch(() => []),
        fetchMyRequests().catch(() => []),
        fetchMySustainabilityOutcomes().catch(() => null)
      ]);
      setMyOfferedRides(offered);
      setMyRequests(reqs);
      setMyOutcomes(outcomes);
    } catch (err) {
      setErrorMsg('Failed to load your rides/requests');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load recurring templates
  const loadRecurringData = useCallback(async () => {
    try {
      const list = await fetchMyRecurringTemplates();
      setRecurringTemplates(list);
    } catch (err) {
      console.error('Failed to load recurring templates', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'mine') {
      loadMyData();
    } else if (activeTab === 'recurring') {
      loadRecurringData();
    }
  }, [activeTab, loadMyData, loadRecurringData]);

  // Handle Search submit
  const handleSearchSubmit = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await searchRides({
        pickupNodeId: searchOrigin,
        dropoffNodeId: searchDest,
        desiredDepartureTime: new Date(searchTime).toISOString(),
        seatsRequested: parseInt(searchSeats, 10),
        maxDetourKm: parseFloat(searchMaxDetour),
        departureWindowMins: 60
      });
      setSearchResults(res);
      if (res.directBaselineRoute?.path) {
        setInspectRoute(res.directBaselineRoute.path);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Ride search failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle Offer submit
  const handleOfferSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const payload = {
        originNodeId: offerOrigin,
        destinationNodeId: offerDest,
        departureTime: new Date(offerTime).toISOString(),
        totalSeats: parseInt(offerSeats, 10),
        costPerSeat: parseFloat(offerCost) || 0,
        maxDetourKm: parseFloat(offerDetour) || 2.0,
        vehicleType: offerVehicleType,
        vehicleModel: offerVehicleModel,
        vehicleNumber: offerVehicleNumber,
        driverPhone: offerPhone,
        contactSharing: {
          enabled: offerAllowContact,
          phone: offerPhone,
          allowWhatsApp: true,
          allowCall: true
        }
      };
      await createRideOffer(payload);
      setSuccessMsg('Your campus ride offer has been successfully published!');
      setActiveTab('mine');
      loadMyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to publish ride offer');
    } finally {
      setLoading(false);
    }
  };

  // Request seat action
  const handleConfirmRequest = async (rideId) => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await requestSeat(rideId, {
        pickupNodeId: searchOrigin,
        dropoffNodeId: searchDest,
        seatsRequested: parseInt(searchSeats, 10),
        desiredDepartureTime: new Date(searchTime).toISOString()
      });
      setSuccessMsg('Ride request submitted to driver! You can track status in My Rides.');
      handleSearchSubmit();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit seat request');
    } finally {
      setLoading(false);
    }
  };

  // Start ride action (Driver)
  const handleStartTrip = async (rideId) => {
    try {
      await startRide(rideId);
      setSuccessMsg('Trip started! Live simulated vehicle progress is now active.');
      loadMyData();
      handleInspectProgress(rideId);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start ride');
    }
  };

  // Complete ride action (Driver)
  const handleCompleteTrip = async (rideId) => {
    try {
      await completeRide(rideId);
      setSuccessMsg('Ride completed! Sustainability credits have been durably recorded.');
      loadMyData();
      setActiveTripProgress(null);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to complete ride');
    }
  };

  // Advance simulation action
  const handleAdvanceSim = async (rideId) => {
    try {
      const updated = await advanceSimulation(rideId, 0.25);
      setActiveTripProgress(updated.data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to advance simulation');
    }
  };

  // Inspect live trip progress
  const handleInspectProgress = async (rideId) => {
    try {
      const prog = await fetchRideProgress(rideId);
      setActiveTripProgress(prog);
      if (prog.route) setInspectRoute(prog.route);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load progress');
    }
  };

  // Driver view incoming requests
  const handleViewDriverRequests = async (rideId) => {
    setActiveDriverRideId(rideId);
    try {
      const reqs = await fetchRequestsForRide(rideId);
      setDriverRideRequests(reqs);
    } catch (err) {
      setErrorMsg('Failed to fetch requests for this ride');
    }
  };

  // Driver accept request
  const handleAcceptRequest = async (reqId) => {
    try {
      await acceptRideRequest(reqId);
      setSuccessMsg('Passenger request accepted and seat confirmed!');
      if (activeDriverRideId) handleViewDriverRequests(activeDriverRideId);
      loadMyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to accept request');
    }
  };

  // Driver reject request
  const handleRejectRequest = async (reqId) => {
    try {
      await rejectRideRequest(reqId, 'Driver declined request');
      setSuccessMsg('Passenger request declined.');
      if (activeDriverRideId) handleViewDriverRequests(activeDriverRideId);
      loadMyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to decline request');
    }
  };

  // Open Authorized Driver Contact
  const handleOpenContact = async (rideId) => {
    try {
      const contact = await fetchAuthorizedDriverContact(rideId);
      setContactModalData(contact);
    } catch (err) {
      setErrorMsg(err.message || 'Driver contact is only available to confirmed participants.');
    }
  };

  // Submit Rating
  const handleSubmitRatingForm = async (e) => {
    e.preventDefault();
    if (!ratingModalRide) return;
    try {
      await submitRating(ratingModalRide._id, {
        ratedUserEmail: ratingModalRide.driverEmail,
        rating: selectedStars,
        categories: selectedCategories,
        comment: ratingComment,
        isSafetyConcern,
        safetyCategory,
        safetyDetails
      });
      setSuccessMsg('Thank you! Your feedback has been verified and recorded.');
      setRatingModalRide(null);
      loadMyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit rating');
    }
  };

  // Create Recurring Template
  const handleCreateRecurring = async (e) => {
    e.preventDefault();
    try {
      await createRecurringTemplate({
        originNodeId: recOrigin,
        destinationNodeId: recDest,
        departureTimeOfDay: recTimeOfDay,
        daysOfWeek: recDays,
        totalSeats: parseInt(recSeats, 10),
        costPerSeat: parseFloat(recCost) || 0
      });
      setSuccessMsg('Recurring commute template created successfully!');
      loadRecurringData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create recurring template');
    }
  };

  // Generate Occurrences
  const handleGenerateRides = async (templateId) => {
    try {
      const res = await generateRecurringOccurrences(templateId, 7);
      setSuccessMsg(res.message || 'Upcoming ride occurrences generated!');
      loadMyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate rides');
    }
  };

  // Toggle Recurring Template
  const handleToggleTemplate = async (templateId, currentEnabled) => {
    try {
      await toggleRecurringTemplate(templateId, !currentEnabled);
      loadRecurringData();
    } catch (err) {
      setErrorMsg('Failed to update template status');
    }
  };

  // Delete Recurring Template
  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Delete this recurring commute template?')) return;
    try {
      await deleteRecurringTemplate(templateId);
      loadRecurringData();
    } catch (err) {
      setErrorMsg('Failed to delete template');
    }
  };

  return (
    <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '5rem', minHeight: '85vh' }}>
      <SEOHead
        title="Smart Campus Ride-Pooling | UniVerse"
        description="Graph-based campus mobility, detour route matching, simulated transit progress, and peer trust."
      />

      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
        borderRadius: '24px',
        padding: '2.25rem',
        border: '1px solid var(--border-color)',
        marginBottom: '2rem',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ maxWidth: '640px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0, 113, 227, 0.1)', color: '#0071E3', padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              <Sparkles size={14} /> UNIVERSE MODULE B
            </div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Smart Campus Ride-Pooling
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.98rem', lineHeight: 1.5 }}>
              Coordinated student mobility connecting SPIT to transit hubs. Dijkstra route insertion, live simulated progress, durable carbon accounting, and verified peer trust.
            </p>
          </div>

          {metrics && (
            <div style={{
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
              background: 'var(--bg-primary)',
              padding: '1rem 1.25rem',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>CO₂ Saved</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Leaf size={16} /> {metrics.metrics?.totalCo2SavedKg || '8.4'} kg
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Shared Rides</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Car size={16} /> {metrics.metrics?.totalRides || 3}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Active Hubs</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0071E3', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Navigation size={16} /> 10
                </div>
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '2rem',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '0.75rem',
        overflowX: 'auto'
      }}>
        {[
          { id: 'search', label: 'Find a Ride', icon: Search },
          { id: 'offer', label: 'Offer a Ride', icon: PlusCircle },
          { id: 'mine', label: 'My Rides & Progress', icon: Users },
          { id: 'recurring', label: 'Recurring Commutes', icon: Repeat },
          { id: 'network', label: 'Campus Map & Hubs', icon: Compass }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '24px',
                border: 'none',
                background: isActive ? 'var(--text-primary)' : 'var(--bg-secondary)',
                color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: FIND A RIDE */}
      {activeTab === 'search' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '2rem', alignItems: 'start' }}>
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            padding: '1.75rem'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={18} style={{ color: '#0071E3' }} /> Match Campus Rides
            </h2>

            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Pickup Hub
                </label>
                <select
                  value={searchOrigin}
                  onChange={(e) => setSearchOrigin(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Destination Hub
                </label>
                <select
                  value={searchDest}
                  onChange={(e) => setSearchDest(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Desired Departure
                  </label>
                  <input
                    type="datetime-local"
                    value={searchTime}
                    onChange={(e) => setSearchTime(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Seats
                  </label>
                  <select
                    value={searchSeats}
                    onChange={(e) => setSearchSeats(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  >
                    {[1, 2, 3, 4].map(n => (
                      <option key={n} value={n}>{n} {n === 1 ? 'seat' : 'seats'}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  <span>Max Tolerated Detour</span>
                  <span style={{ color: '#0071E3' }}>{searchMaxDetour} km</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.5"
                  value={searchMaxDetour}
                  onChange={(e) => setSearchMaxDetour(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#0071E3' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.95rem'
                }}
              >
                {loading ? 'Searching Algorithm...' : 'Find Compatible Rides'}
              </button>
            </form>
          </div>

          <div>
            {searchResults ? (
              <div>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: 700 }}>
                  Compatible Rides ({searchResults.matchesCount || 0})
                </h3>

                {(() => {
                  const matchesList = searchResults.rankedRides || searchResults.matches || [];
                  if (matchesList.length === 0) {
                    return (
                      <div style={{ padding: '2.5rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <Car size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                        <p style={{ margin: 0, fontWeight: 600 }}>No compatible rides found in this time window.</p>
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {matchesList.map(match => {
                        const ride = match.ride || match;
                        const ratingsSummary = ride.ratingsSummary;
                        const hasRating = ratingsSummary && ratingsSummary.ratingsCount > 0;
                        const detourDisplay = match.detourKm !== undefined ? match.detourKm : (match.insertionMetrics?.detourKm || 0);
                        const co2Display = match.estimatedCo2SavedGrams !== undefined ? match.estimatedCo2SavedGrams : (match.savings?.co2SavedGrams || 0);
                        const timeDiffDisplay = match.timeDiffMinutes !== undefined ? match.timeDiffMinutes : (match.timeDifferenceMins || 0);

                      return (
                        <div
                          key={ride._id || match.rideId}
                          style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: '16px',
                            border: '1px solid var(--border-color)',
                            padding: '1.25rem',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                                  {ride.driverName}
                                </span>
                                {/* Driver Trust Badge */}
                                <span style={{
                                  fontSize: '0.72rem',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  background: hasRating ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.12)',
                                  color: hasRating ? '#D97706' : 'var(--text-secondary)',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem'
                                }}>
                                  <Star size={11} fill={hasRating ? '#D97706' : 'none'} />
                                  {hasRating ? `${ratingsSummary.averageRating} ★ (${ratingsSummary.ratingsCount})` : 'New driver'}
                                </span>
                                <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(0, 113, 227, 0.1)', color: '#0071E3', fontWeight: 600 }}>
                                  {ride.vehicleModel || ride.vehicleType}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                Departing: {new Date(ride.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({timeDiffDisplay}m diff)
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: match.matchScore >= 80 ? '#10B981' : '#0071E3' }}>
                                {match.matchScore}% Match
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                {match.explanation}
                              </div>
                            </div>
                          </div>

                          <div style={{
                            background: 'var(--bg-primary)',
                            padding: '0.75rem',
                            borderRadius: '10px',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0.75rem'
                          }}>
                            <div>
                              <span style={{ fontWeight: 600 }}>{ride.originName}</span>
                              <span style={{ margin: '0 0.5rem', color: 'var(--text-secondary)' }}>➔</span>
                              <span style={{ fontWeight: 600 }}>{ride.destinationName}</span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)' }}>
                              Detour: <strong>+{detourDisplay} km</strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.82rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)' }}>
                              <span><Users size={14} /> {ride.availableSeats} seats left</span>
                              <span style={{ color: '#10B981' }}><Leaf size={14} /> {co2Display}g CO₂ saved</span>
                              <span><DollarSign size={14} /> ₹{ride.costPerSeat || 0}/seat</span>
                            </div>

                            <button
                              onClick={() => handleConfirmRequest(ride._id || match.rideId)}
                              disabled={loading}
                              style={{
                                background: '#10B981',
                                color: '#FFFFFF',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '10px',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              Request Seat <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '2rem', textAlign: 'center' }}>
                <Compass size={36} style={{ color: '#0071E3', marginBottom: '0.75rem' }} />
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Plan Your Campus Commute</h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Search for shared student rides across SPIT and transit lines.
                </p>
                <div style={{ marginTop: '1.5rem' }}>
                  <CampusNetworkMap activeRoute={inspectRoute} pickupNodeId={searchOrigin} dropoffNodeId={searchDest} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OFFER A RIDE */}
      {activeTab === 'offer' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'start' }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Car size={20} style={{ color: '#10B981' }} /> Publish a Campus Ride Offer
            </h2>

            <form onSubmit={handleOfferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Origin Node
                  </label>
                  <select
                    value={offerOrigin}
                    onChange={(e) => setOfferOrigin(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Destination Node
                  </label>
                  <select
                    value={offerDest}
                    onChange={(e) => setOfferDest(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Departure Timestamp
                  </label>
                  <input
                    type="datetime-local"
                    value={offerTime}
                    onChange={(e) => setOfferTime(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Seats Available
                  </label>
                  <select
                    value={offerSeats}
                    onChange={(e) => setOfferSeats(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  >
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <option key={n} value={n}>{n} seats</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Cost Per Seat (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="150"
                    value={offerCost}
                    onChange={(e) => setOfferCost(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Max Detour Allowed (km)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={offerDetour}
                    onChange={(e) => setOfferDetour(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                    required
                  />
                </div>
              </div>

              {/* Contact Sharing Consent Toggle */}
              <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Allow WhatsApp / Call from Confirmed Passengers</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Protected: strictly visible only after you accept their seat request.</div>
                </div>
                <input
                  type="checkbox"
                  checked={offerAllowContact}
                  onChange={(e) => setOfferAllowContact(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#10B981' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: '#10B981',
                  color: '#FFFFFF',
                  padding: '0.9rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem',
                  marginTop: '0.5rem'
                }}
              >
                {loading ? 'Publishing...' : 'Publish Campus Ride Offer'}
              </button>
            </form>
          </div>

          <div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 700 }}>Dijkstra Baseline Route Preview</h3>
              {offerPreviewRoute && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Distance: <strong>{offerPreviewRoute.totalDistance} km</strong> • Travel Time: <strong>{offerPreviewRoute.totalDuration} mins</strong>
                </div>
              )}
              <CampusNetworkMap activeRoute={offerPreviewRoute?.path || []} pickupNodeId={offerOrigin} dropoffNodeId={offerDest} />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MY RIDES & TRIP PROGRESS */}
      {activeTab === 'mine' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* Driver: Offered Rides with Trip Progression */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '1.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Car size={18} style={{ color: '#0071E3' }} /> Rides Offered by You ({myOfferedRides.length})
            </h2>

            {myOfferedRides.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>No offered rides found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {myOfferedRides.map(ride => (
                  <div key={ride._id} style={{ background: 'var(--bg-primary)', borderRadius: '14px', border: '1px solid var(--border-color)', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          {ride.originName} ➔ {ride.destinationName}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          Departure: {new Date(ride.departureTime).toLocaleString()}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: ride.status === 'in_transit' ? 'rgba(59, 130, 246, 0.15)' : ride.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                        color: ride.status === 'in_transit' ? '#3B82F6' : ride.status === 'completed' ? '#10B981' : 'var(--text-primary)'
                      }}>
                        {ride.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      <span>Seats: <strong>{ride.availableSeats}/{ride.totalSeats} open</strong></span>
                      <span>Confirmed: <strong>{ride.confirmedPassengerCount || 0}</strong></span>
                      <span>Fare: <strong>₹{ride.costPerSeat}</strong></span>
                    </div>

                    {/* Trip Progression Controls */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {ride.status === 'open' || ride.status === 'full' || ride.status === 'scheduled' ? (
                        <button
                          onClick={() => handleStartTrip(ride._id)}
                          style={{ flex: 1, padding: '0.45rem', borderRadius: '8px', border: 'none', background: '#3B82F6', color: '#FFF', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                        >
                          <Play size={13} /> Start Trip
                        </button>
                      ) : (ride.status === 'in_transit' || ride.status === 'in_progress') ? (
                        <>
                          <button
                            onClick={() => handleInspectProgress(ride._id)}
                            style={{ flex: 1, padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Track Trip
                          </button>
                          <button
                            onClick={() => handleAdvanceSim(ride._id)}
                            style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: 'none', background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            +25% Sim Step
                          </button>
                          <button
                            onClick={() => handleCompleteTrip(ride._id)}
                            style={{ flex: 1, padding: '0.45rem', borderRadius: '8px', border: 'none', background: '#10B981', color: '#FFF', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                          >
                            <CheckCheck size={13} /> Complete Trip
                          </button>
                        </>
                      ) : null}

                      <button
                        onClick={() => handleViewDriverRequests(ride._id)}
                        style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Requests
                      </button>
                    </div>

                    {/* Expandable Driver Requests */}
                    {activeDriverRideId === ride._id && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 700 }}>
                          Incoming Seat Requests ({driverRideRequests.length})
                        </h4>
                        {driverRideRequests.length === 0 ? (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>No seat requests for this ride yet.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {driverRideRequests.map(req => (
                              <div key={req._id} style={{ background: 'var(--bg-primary)', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                  <span style={{ fontWeight: 700 }}>{req.passengerName} ({req.seatsRequested} seat)</span>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: req.status === 'accepted' ? '#10B981' : '#F59E0B' }}>
                                    {req.status.toUpperCase()}
                                  </span>
                                </div>
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                  {req.pickupName} ➔ {req.dropoffName}
                                </div>
                                {req.status === 'pending' && (
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => handleAcceptRequest(req._id)} style={{ flex: 1, padding: '0.35rem', background: '#10B981', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                                      Accept & Reserve
                                    </button>
                                    <button onClick={() => handleRejectRequest(req._id)} style={{ flex: 1, padding: '0.35rem', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                                      Decline
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Passenger Bookings & Live Progress */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '1.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} style={{ color: '#10B981' }} /> Your Passenger Bookings ({myRequests.length})
            </h2>

            {/* Active Live Progress Monitor */}
            {activeTripProgress && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '14px', border: '1px solid #3B82F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem' }}>
                    <Car size={15} /> Active Ride In-Transit
                  </span>
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', fontWeight: 700 }}>
                    SIMULATED PROGRESS
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Next Waypoint: <strong>{activeTripProgress.currentWaypointNodeId || 'En route'}</strong> • Destination ETA: <strong>{activeTripProgress.remainingDurationMins} mins</strong>
                </div>
                <CampusNetworkMap
                  activeRoute={activeTripProgress.route || []}
                  simulationMode={true}
                  progressFraction={activeTripProgress.progressFraction || 0}
                  remainingMins={activeTripProgress.remainingDurationMins}
                  passengerPickupEtaMins={activeTripProgress.passengerPickupEtaMins}
                />
              </div>
            )}

            {myRequests.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>No passenger bookings found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {myRequests.map(req => {
                  const ride = req.rideOfferId;
                  const isAccepted = req.status === 'accepted';
                  const isCompleted = ride?.status === 'completed';
                  const isInTransit = ride?.status === 'in_transit';

                  return (
                    <div key={req._id} style={{ background: 'var(--bg-primary)', borderRadius: '14px', border: '1px solid var(--border-color)', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            {req.pickupName} ➔ {req.dropoffName}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            Seats: <strong>{req.seatsRequested}</strong> • Status: <strong style={{ color: isAccepted ? '#10B981' : 'inherit' }}>{req.status.toUpperCase()}</strong>
                          </div>
                        </div>
                        {isInTransit && (
                          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', fontWeight: 700 }}>
                            IN TRANSIT
                          </span>
                        )}
                      </div>

                      {ride && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                          Driver: <strong>{ride.driverName}</strong> • Vehicle: <strong>{ride.vehicleModel || ride.vehicleType}</strong>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* Live Track Button */}
                        {ride && (isInTransit || isAccepted) && (
                          <button
                            onClick={() => handleInspectProgress(ride._id)}
                            style={{ flex: 1, padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                          >
                            <Navigation size={12} /> Track Trip
                          </button>
                        )}

                        {/* Authorized Driver Contact Button */}
                        {ride && isAccepted && (
                          <button
                            onClick={() => handleOpenContact(ride._id)}
                            style={{ flex: 1, padding: '0.45rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.08)', color: '#10B981', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                          >
                            <Phone size={12} /> Contact Driver
                          </button>
                        )}

                        {/* Rate Trip Button upon completion */}
                        {ride && isCompleted && (
                          <button
                            onClick={() => setRatingModalRide(ride)}
                            style={{ flex: 1, padding: '0.45rem', borderRadius: '8px', border: 'none', background: '#D97706', color: '#FFF', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                          >
                            <Star size={12} /> Rate Trip
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: RECURRING COMMUTES */}
      {activeTab === 'recurring' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '2rem', alignItems: 'start' }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '1.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Repeat size={18} style={{ color: '#0071E3' }} /> New Recurring Commute Template
            </h2>

            <form onSubmit={handleCreateRecurring} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Departure Node
                </label>
                <select
                  value={recOrigin}
                  onChange={(e) => setRecOrigin(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Campus Destination
                </label>
                <select
                  value={recDest}
                  onChange={(e) => setRecDest(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Time of Day (HH:mm)
                  </label>
                  <input
                    type="time"
                    value={recTimeOfDay}
                    onChange={(e) => setRecTimeOfDay(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Available Seats
                  </label>
                  <select
                    value={recSeats}
                    onChange={(e) => setRecSeats(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                  >
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <option key={n} value={n}>{n} seats</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Weekday Checkboxes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Active Weekdays (Asia/Kolkata)
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(day => {
                    const isSelected = recDays.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => {
                          setRecDays(prev => isSelected ? prev.filter(d => d !== day) : [...prev, day]);
                        }}
                        style={{
                          padding: '0.45rem 0.75rem',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid #0071E3' : '1px solid var(--border-color)',
                          background: isSelected ? 'rgba(0, 113, 227, 0.15)' : 'var(--bg-primary)',
                          color: isSelected ? '#0071E3' : 'var(--text-secondary)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          cursor: 'pointer'
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                style={{ background: '#0071E3', color: '#FFF', padding: '0.85rem', borderRadius: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '0.92rem' }}
              >
                Create Recurring Commute Schedule
              </button>
            </form>
          </div>

          {/* List of Recurring Templates */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '1.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
              Your Commute Templates ({recurringTemplates.length})
            </h2>

            {recurringTemplates.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>No recurring schedules created yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {recurringTemplates.map(t => (
                  <div key={t._id} style={{ background: 'var(--bg-primary)', borderRadius: '14px', border: '1px solid var(--border-color)', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t.originName} ➔ {t.destinationName}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          Departs: <strong>{t.departureTimeOfDay}</strong> • Days: <strong>{(t.daysOfWeek || []).join(', ').toUpperCase()}</strong>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        background: t.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                        color: t.enabled ? '#10B981' : 'var(--text-secondary)'
                      }}>
                        {t.enabled ? 'ACTIVE' : 'PAUSED'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button
                        onClick={() => handleGenerateRides(t._id)}
                        style={{ flex: 1, padding: '0.45rem', borderRadius: '8px', border: 'none', background: '#10B981', color: '#FFF', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Generate Rides (7d)
                      </button>
                      <button
                        onClick={() => handleToggleTemplate(t._id, t.enabled)}
                        style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {t.enabled ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(t._id)}
                        style={{ padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', color: '#EF4444', cursor: 'pointer' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: CAMPUS NETWORK & HUBS */}
      {activeTab === 'network' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <CampusNetworkMap activeRoute={inspectRoute} />
        </div>
      )}

      {/* CONTACT MODAL DRAWER */}
      {contactModalData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '20px', maxWidth: '420px', width: '90%', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 700 }}>Driver Contact Details</h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Authorized for confirmed passenger communication.
            </p>

            {contactModalData.sharingEnabled ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: '10px', fontSize: '0.88rem' }}>
                  Driver: <strong>{contactModalData.driverName}</strong>
                </div>
                {contactModalData.whatsappUrl && (
                  <a
                    href={contactModalData.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ padding: '0.85rem', borderRadius: '10px', background: '#25D366', color: '#FFF', fontWeight: 700, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                  >
                    Open WhatsApp Chat
                  </a>
                )}
                {contactModalData.telUri && (
                  <a
                    href={contactModalData.telUri}
                    style={{ padding: '0.85rem', borderRadius: '10px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontWeight: 700, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                  >
                    Call ({contactModalData.maskedDisplay})
                  </a>
                )}
              </div>
            ) : (
              <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                {contactModalData.message}
              </div>
            )}

            <button
              onClick={() => setContactModalData(null)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* RATING & SAFETY FEEDBACK MODAL */}
      {ratingModalRide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '20px', maxWidth: '460px', width: '90%', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 700 }}>Rate Your Campus Commute</h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Rate driver <strong>{ratingModalRide.driverName}</strong> for trip from {ratingModalRide.originName} to {ratingModalRide.destinationName}.
            </p>

            <form onSubmit={handleSubmitRatingForm} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Star selector */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setSelectedStars(star)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                  >
                    <Star size={28} fill={star <= selectedStars ? '#D97706' : 'none'} color="#D97706" />
                  </button>
                ))}
              </div>

              {/* Feedback categories */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Commute Highlights
                </label>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {['punctuality', 'communication', 'etiquette', 'driving_safety', 'vehicle_condition'].map(cat => {
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setSelectedCategories(prev => isSelected ? prev.filter(c => c !== cat) : [...prev, cat])}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid #10B981' : '1px solid var(--border-color)',
                          background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-primary)',
                          color: isSelected ? '#10B981' : 'var(--text-secondary)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          cursor: 'pointer'
                        }}
                      >
                        {cat.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Optional Feedback (Max 300 chars)
                </label>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value.slice(0, 300))}
                  placeholder="Share details about your commute experience..."
                  rows={3}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                />
              </div>

              {/* Safety Report Toggle */}
              <div style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#EF4444' }}>
                  <input
                    type="checkbox"
                    checked={isSafetyConcern}
                    onChange={(e) => setIsSafetyConcern(e.target.checked)}
                    style={{ accentColor: '#EF4444' }}
                  />
                  Report Safety or Route Violation (Private Admin Review)
                </label>
                {isSafetyConcern && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <select
                      value={safetyCategory}
                      onChange={(e) => setSafetyCategory(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                    >
                      <option value="">Select violation category</option>
                      <option value="reckless_driving">Reckless Driving</option>
                      <option value="harassment">Etiquette / Harassment</option>
                      <option value="route_deviation">Unwarranted Route Deviation</option>
                    </select>
                    <textarea
                      value={safetyDetails}
                      onChange={(e) => setSafetyDetails(e.target.value)}
                      placeholder="Confidential explanation for campus administrator..."
                      rows={2}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: '0.8rem' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', background: '#D97706', color: '#FFF', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  Submit Feedback
                </button>
                <button
                  type="button"
                  onClick={() => setRatingModalRide(null)}
                  style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
