import React, { useState, useEffect, useCallback } from 'react';
import { 
  Car, Search, PlusCircle, MapPin, Calendar, Clock, Users, Leaf, 
  DollarSign, Shield, ArrowRight, CheckCircle, XCircle, AlertCircle, 
  RotateCcw, Navigation, Compass, Filter, Sparkles, ChevronRight, UserCheck
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
  computeRoute
} from '../utils/rideApi';

export default function CampusRides() {
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'offer' | 'mine' | 'network'
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
  const [selectedRideForRequest, setSelectedRideForRequest] = useState(null);

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
  const [offerPreviewRoute, setOfferPreviewRoute] = useState(null);

  // My Rides & Requests state
  const [myOfferedRides, setMyOfferedRides] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [activeDriverRideId, setActiveDriverRideId] = useState(null);
  const [driverRideRequests, setDriverRideRequests] = useState([]);

  // Map inspection state
  const [inspectRoute, setInspectRoute] = useState([]);

  // Current user from local storage
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = localStorage.getItem('loop_current_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

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
      const [offered, reqs] = await Promise.all([
        fetchMyOfferedRides().catch(() => []),
        fetchMyRequests().catch(() => [])
      ]);
      setMyOfferedRides(offered);
      setMyRequests(reqs);
    } catch (err) {
      setErrorMsg('Failed to load your rides/requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'mine') {
      loadMyData();
    }
  }, [activeTab, loadMyData]);

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
        driverPhone: offerPhone
      };
      const res = await createRideOffer(payload);
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
      setSelectedRideForRequest(null);
      // Refresh search or switch to mine
      handleSearchSubmit();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit seat request');
    } finally {
      setLoading(false);
    }
  };

  // Cancel offered ride
  const handleCancelOffer = async (rideId) => {
    if (!window.confirm('Are you sure you want to cancel this offered ride?')) return;
    try {
      await cancelRideOffer(rideId, 'Cancelled by driver from dashboard');
      setSuccessMsg('Ride offer cancelled.');
      loadMyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to cancel ride');
    }
  };

  // Cancel passenger request
  const handleCancelRequest = async (reqId) => {
    if (!window.confirm('Cancel this ride request?')) return;
    try {
      await cancelRideRequest(reqId);
      setSuccessMsg('Ride request cancelled.');
      loadMyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to cancel request');
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
      if (activeDriverRideId) {
        handleViewDriverRequests(activeDriverRideId);
      }
      loadMyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to accept request');
    }
  };

  // Driver reject request
  const handleRejectRequest = async (reqId) => {
    try {
      await rejectRideRequest(reqId, 'Driver declined request due to route or timing constraints');
      setSuccessMsg('Passenger request declined.');
      if (activeDriverRideId) {
        handleViewDriverRequests(activeDriverRideId);
      }
      loadMyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to decline request');
    }
  };

  return (
    <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '5rem', minHeight: '85vh' }}>
      <SEOHead
        title="Smart Campus Ride-Pooling | UniVerse"
        description="P2P campus ride sharing, graph-based route matching and carbon savings optimization for SPIT students."
      />

      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
        borderRadius: '24px',
        padding: '2.25rem',
        border: '1px solid var(--border-color)',
        marginBottom: '2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ maxWidth: '640px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0, 113, 227, 0.1)', color: 'var(--accent-blue, #0071E3)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
              <Sparkles size={14} /> UNIVERSE MODULE B
            </div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Smart Campus Ride-Pooling
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.5 }}>
              Coordinated student mobility connecting SPIT to suburban transit nodes. Intelligent graph-based route detour insertion, transparent fare sharing, and verified CO₂ reduction.
            </p>
          </div>

          {/* Quick Metrics Badge */}
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
                  <Leaf size={16} /> {metrics.metrics?.totalCo2SavedKg || '0.00'} kg
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Shared Rides</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Car size={16} /> {metrics.metrics?.totalRidesOffered || 0}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Hops Connected</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0071E3', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Navigation size={16} /> {metrics.network?.activeNodesCount || 10}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Notifications */}
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

      {/* Navigation Tabs */}
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
          { id: 'mine', label: 'My Rides & Requests', icon: Users },
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
          {/* Search Form Panel */}
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
                  fontSize: '0.95rem',
                  transition: 'opacity 0.2s'
                }}
              >
                {loading ? 'Searching Algorithm...' : 'Find Compatible Rides'}
              </button>
            </form>
          </div>

          {/* Results Panel */}
          <div>
            {searchResults ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                      Compatible Rides ({searchResults.matchesCount || 0})
                    </h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Ranked by detour feasibility, seat capacity, departure proximity, and carbon offset.
                    </p>
                  </div>
                </div>

                {searchResults.rankedRides && searchResults.rankedRides.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {searchResults.rankedRides.map(match => {
                      const ride = match.ride;
                      return (
                        <div
                          key={ride._id || match.rideId}
                          style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: '16px',
                            border: '1px solid var(--border-color)',
                            padding: '1.25rem',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                                  {ride.driverName}
                                </span>
                                <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(0, 113, 227, 0.1)', color: '#0071E3', fontWeight: 600 }}>
                                  {ride.vehicleModel || ride.vehicleType}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                Departing: {new Date(ride.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({match.timeDifferenceMins}m diff)
                              </div>
                            </div>

                            {/* Match Score Badge */}
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: match.matchScore >= 80 ? '#10B981' : '#0071E3' }}>
                                {match.matchScore}% Match
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                {match.explanation}
                              </div>
                            </div>
                          </div>

                          {/* Route Summary */}
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
                              Detour: <strong>+{match.insertionMetrics?.detourKm || 0} km</strong>
                            </div>
                          </div>

                          {/* Highlights Bar */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.82rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Users size={14} /> {ride.availableSeats} seats left
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#10B981' }}>
                                <Leaf size={14} /> {match.savings?.co2SavedGrams || 0}g CO₂ saved
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <DollarSign size={14} /> ₹{ride.costPerSeat || 0}/seat
                              </span>
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
                ) : (
                  <div style={{
                    padding: '2.5rem',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)'
                  }}>
                    <Car size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No matching rides found within this time window or detour radius.</p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.82rem' }}>Try expanding your departure window or publish an offer to become the driver!</p>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--text-secondary)'
              }}>
                <Compass size={36} style={{ color: '#0071E3', marginBottom: '0.75rem' }} />
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Select Your Journey</h3>
                <p style={{ margin: 0, fontSize: '0.88rem' }}>
                  Choose your origin and destination to view live campus rides and calculated road routes.
                </p>
                <div style={{ marginTop: '1.5rem' }}>
                  <CampusNetworkMap
                    activeRoute={inspectRoute}
                    pickupNodeId={searchOrigin}
                    dropoffNodeId={searchDest}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OFFER A RIDE */}
      {activeTab === 'offer' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* Driver Form */}
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            padding: '2rem'
          }}>
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

              {/* Vehicle & Contact info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Vehicle Type
                  </label>
                  <select
                    value={offerVehicleType}
                    onChange={(e) => setOfferVehicleType(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  >
                    <option value="car">Car / Sedan</option>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="ev_scooter">Electric Scooter</option>
                    <option value="auto">Auto / Shared</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Model
                  </label>
                  <input
                    type="text"
                    value={offerVehicleModel}
                    onChange={(e) => setOfferVehicleModel(e.target.value)}
                    placeholder="e.g. Honda City"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    License Plate
                  </label>
                  <input
                    type="text"
                    value={offerVehicleNumber}
                    onChange={(e) => setOfferVehicleNumber(e.target.value)}
                    placeholder="MH-02-..."
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  />
                </div>
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
                  marginTop: '0.5rem',
                  transition: 'background 0.2s'
                }}
              >
                {loading ? 'Publishing...' : 'Publish Campus Ride Offer'}
              </button>
            </form>
          </div>

          {/* Route Preview Map */}
          <div>
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              padding: '1.5rem',
              marginBottom: '1rem'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 700 }}>
                Dijkstra Baseline Route Preview
              </h3>
              {offerPreviewRoute ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Distance: <strong>{offerPreviewRoute.totalDistance} km</strong> • Travel Time: <strong>{offerPreviewRoute.totalDuration} mins</strong>
                </div>
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Select distinct origin and destination to preview road routing.
                </div>
              )}
              <CampusNetworkMap
                activeRoute={offerPreviewRoute?.path || []}
                pickupNodeId={offerOrigin}
                dropoffNodeId={offerDest}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MY RIDES & REQUESTS */}
      {activeTab === 'mine' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* Driver: Rides Offered */}
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            padding: '1.75rem'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Car size={18} style={{ color: '#0071E3' }} /> Rides Offered by You ({myOfferedRides.length})
            </h2>

            {myOfferedRides.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>You haven't offered any campus rides yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {myOfferedRides.map(ride => (
                  <div
                    key={ride._id}
                    style={{
                      background: 'var(--bg-primary)',
                      borderRadius: '14px',
                      border: '1px solid var(--border-color)',
                      padding: '1rem'
                    }}
                  >
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
                        background: ride.status === 'open' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: ride.status === 'open' ? '#10B981' : '#EF4444'
                      }}>
                        {ride.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      <span>Seats: <strong>{ride.availableSeats}/{ride.totalSeats} open</strong></span>
                      <span>Confirmed: <strong>{ride.confirmedPassengerCount || 0}</strong></span>
                      <span>Cost: <strong>₹{ride.costPerSeat}</strong></span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleViewDriverRequests(ride._id)}
                        style={{
                          flex: 1,
                          padding: '0.45rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: activeDriverRideId === ride._id ? '#0071E3' : 'var(--bg-secondary)',
                          color: activeDriverRideId === ride._id ? '#FFF' : 'var(--text-primary)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Passenger Requests
                      </button>
                      {ride.status === 'open' && (
                        <button
                          onClick={() => handleCancelOffer(ride._id)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#EF4444',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {/* Expandable Driver Requests Drawer */}
                    {activeDriverRideId === ride._id && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)'
                      }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 700 }}>
                          Incoming Seat Requests ({driverRideRequests.length})
                        </h4>

                        {driverRideRequests.length === 0 ? (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>No seat requests for this ride yet.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {driverRideRequests.map(req => (
                              <div
                                key={req._id}
                                style={{
                                  background: 'var(--bg-primary)',
                                  padding: '0.65rem',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-color)',
                                  fontSize: '0.78rem'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                  <span style={{ fontWeight: 700 }}>{req.passengerName} ({req.seatsRequested} seat)</span>
                                  <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: req.status === 'accepted' ? '#10B981' : req.status === 'pending' ? '#F59E0B' : '#EF4444'
                                  }}>
                                    {req.status.toUpperCase()}
                                  </span>
                                </div>
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                  Pickup: {req.pickupName} ➔ Dropoff: {req.dropoffName}
                                  {req.matchMetrics?.detourKm > 0 && ` (+${req.matchMetrics.detourKm}km detour)`}
                                </div>
                                {req.status === 'pending' && (
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      onClick={() => handleAcceptRequest(req._id)}
                                      style={{
                                        flex: 1,
                                        padding: '0.35rem',
                                        background: '#10B981',
                                        color: '#FFF',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Accept & Reserve Seat
                                    </button>
                                    <button
                                      onClick={() => handleRejectRequest(req._id)}
                                      style={{
                                        flex: 1,
                                        padding: '0.35rem',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: '#EF4444',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                    >
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

          {/* Passenger: My Ride Requests */}
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            padding: '1.75rem'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} style={{ color: '#10B981' }} /> Your Passenger Bookings ({myRequests.length})
            </h2>

            {myRequests.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>You haven't requested any rides yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {myRequests.map(req => {
                  const ride = req.rideOfferId;
                  return (
                    <div
                      key={req._id}
                      style={{
                        background: 'var(--bg-primary)',
                        borderRadius: '14px',
                        border: '1px solid var(--border-color)',
                        padding: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            {req.pickupName} ➔ {req.dropoffName}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            Seats: <strong>{req.seatsRequested}</strong> • Requested at: {new Date(req.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: req.status === 'accepted' ? 'rgba(16, 185, 129, 0.15)' : req.status === 'pending' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: req.status === 'accepted' ? '#10B981' : req.status === 'pending' ? '#F59E0B' : '#EF4444'
                        }}>
                          {req.status}
                        </span>
                      </div>

                      {ride && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                          Driver: <strong>{ride.driverName}</strong> • Vehicle: <strong>{ride.vehicleModel || ride.vehicleType}</strong>
                        </div>
                      )}

                      {/* Cancel Passenger Request */}
                      {req.status !== 'cancelled' && req.status !== 'rejected' && (
                        <button
                          onClick={() => handleCancelRequest(req._id)}
                          style={{
                            width: '100%',
                            padding: '0.45rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#EF4444',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Cancel Booking
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: CAMPUS NETWORK & HUBS */}
      {activeTab === 'network' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <CampusNetworkMap activeRoute={inspectRoute} />

          {/* Hub Directory */}
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            padding: '1.75rem'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700 }}>
              Campus & Suburban Transit Node Directory
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {locations.map(loc => (
                <div
                  key={loc.id}
                  style={{
                    background: 'var(--bg-primary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem'
                  }}
                >
                  <MapPin size={18} style={{ color: '#0071E3', marginTop: '0.2rem', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{loc.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      Type: {loc.type.replace('_', ' ')}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Lat: {loc.lat?.toFixed(4)}, Lng: {loc.lng?.toFixed(4)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
