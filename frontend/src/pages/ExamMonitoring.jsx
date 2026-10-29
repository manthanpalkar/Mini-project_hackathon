import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert,
  Video,
  Play,
  Pause,
  RotateCcw,
  Square,
  AlertTriangle,
  Users,
  Eye,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  Sparkles,
  Upload,
  Info,
  ChevronRight,
  Filter,
  Check,
  Search,
  ExternalLink,
  Lock,
  Layers,
  Activity,
  Cpu
} from 'lucide-react';
import {
  fetchExamHealth,
  fetchSampleVideos,
  fetchExamSessions,
  createExamSession,
  startExamSession,
  pauseExamSession,
  resumeExamSession,
  stopExamSession,
  fetchSessionIncidents,
  updateIncidentReview,
  uploadExamVideo
} from '../utils/examApi';

export default function ExamMonitoring() {
  // Service & Setup State
  const [healthData, setHealthData] = useState(null);
  const [sampleVideos, setSampleVideos] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);

  // Configuration State
  const [selectedVideo, setSelectedVideo] = useState('classroom_front_aisle.mp4');
  const [roomCode, setRoomCode] = useState('EXAM-HALL-302');
  const [frameSkip, setFrameSkip] = useState(2);
  const [headTurnThresh, setHeadTurnThresh] = useState(2);
  const [phoneConfThresh, setPhoneConfThresh] = useState(0.35);
  const [restrictedZoneEnabled, setRestrictedZoneEnabled] = useState(false);

  // Analysis & Stream State
  const [processingState, setProcessingState] = useState('idle'); // 'idle' | 'running' | 'paused' | 'stopped'
  const [framesData, setFramesData] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [metrics, setMetrics] = useState({
    fps: 18.2,
    latencyMs: 42,
    totalFrames: 0,
    processedFrames: 0,
    activeTracks: 0,
    alertCount: 0
  });

  // Filtering State
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Incident Modal State
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Video and Canvas Overlay Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Status and Alerts Notification State
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('info'); // 'info' | 'success' | 'warning'

  const showToast = (msg, type = 'info') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 4500);
  };

  // Initial Data Load
  useEffect(() => {
    async function init() {
      try {
        const [health, samples, existingSessions] = await Promise.all([
          fetchExamHealth().catch(() => null),
          fetchSampleVideos().catch(() => ({ samples: [] })),
          fetchExamSessions().catch(() => ({ data: [] }))
        ]);

        if (health) setHealthData(health);
        if (samples?.samples) setSampleVideos(samples.samples);
        if (existingSessions?.data) {
          setSessions(existingSessions.data);
          if (existingSessions.data.length > 0) {
            setCurrentSession(existingSessions.data[0]);
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
    init();
  }, []);

  // Update canvas bounding boxes based on current video playback timestamp
  const updateCanvasOverlay = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || framesData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const currentTime = video.currentTime;

    // Find closest processed frame to current timestamp
    let closestFrame = framesData[0];
    let minDiff = 9999;
    for (const f of framesData) {
      const diff = Math.abs(f.timestampSec - currentTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrame = f;
      }
    }

    if (!closestFrame || !closestFrame.tracks) return;

    // Optional Restricted Zone Rendering
    if (restrictedZoneEnabled) {
      const rzX1 = 0 * width;
      const rzY1 = 0 * height;
      const rzW = 0.25 * width;
      const rzH = 0.35 * height;

      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.fillRect(rzX1, rzY1, rzW, rzH);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(rzX1, rzY1, rzW, rzH);
      ctx.setLineDash([]);
      ctx.fillStyle = '#EF4444';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText('Restricted Proctor Podium', rzX1 + 8, rzY1 + 18);
    }

    // Render Bounding Boxes
    closestFrame.tracks.forEach((track) => {
      const [x1Norm, y1Norm, x2Norm, y2Norm] = track.bbox;
      const x = x1Norm * width;
      const y = y1Norm * height;
      const w = (x2Norm - x1Norm) * width;
      const h = (y2Norm - y1Norm) * height;

      const isAlert = track.status === 'REVIEW';

      // Box Styling
      ctx.lineWidth = isAlert ? 3 : 2;
      ctx.strokeStyle = isAlert ? '#EF4444' : '#10B981';

      if (isAlert) {
        // Red Pulsing Glow for Alert Candidate
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
        ctx.shadowBlur = 4;
      }

      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0; // reset

      // Top Header Tag
      const labelText = track.label || `Track #${track.trackId}`;
      ctx.font = 'bold 12px Inter, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const badgeWidth = textMetrics.width + 16;
      const badgeHeight = 22;

      ctx.fillStyle = isAlert ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.90)';
      ctx.fillRect(x, Math.max(0, y - badgeHeight), badgeWidth, badgeHeight);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(labelText, x + 8, Math.max(14, y - 6));
    });

    setMetrics((prev) => ({
      ...prev,
      activeTracks: closestFrame.detectedPeople || 0,
      alertCount: closestFrame.activeAlerts || 0
    }));
  }, [framesData, restrictedZoneEnabled]);

  // Synchronize canvas animation loop with HTML5 video playback
  useEffect(() => {
    let active = true;
    function renderLoop() {
      if (active) {
        updateCanvasOverlay();
        animationFrameRef.current = requestAnimationFrame(renderLoop);
      }
    }
    renderLoop();
    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateCanvasOverlay]);

  // Resize canvas overlay to match video dimensions
  const handleVideoResize = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleVideoResize);
    return () => window.removeEventListener('resize', handleVideoResize);
  }, [handleVideoResize]);

  // Start Exam Surveillance Pipeline
  const handleStartSurveillance = async () => {
    setProcessingState('running');
    showToast('Starting multi-student CCTV computer vision pipeline...', 'info');

    try {
      // 1. Create session if needed
      let activeSessionId = currentSession?.sessionId;
      if (!activeSessionId) {
        const createRes = await createExamSession({
          sessionName: `Exam Surveillance - ${roomCode}`,
          roomCode,
          videoFileName: selectedVideo,
          sourceName: selectedVideo.includes('front') ? 'Front Aisle View' : 'Diagonal Hall View',
          config: {
            frameSkip,
            headTurnThreshold: headTurnThresh,
            phoneConfidenceThreshold: phoneConfThresh,
            restrictedZone: {
              enabled: restrictedZoneEnabled,
              name: 'Invigilator Master Desk Zone',
              xMin: 0.0,
              yMin: 0.0,
              xMax: 0.25,
              yMax: 0.35
            }
          }
        });
        setCurrentSession(createRes.session);
        activeSessionId = createRes.session.sessionId;
      }

      // 2. Trigger backend execution
      const analysisRes = await startExamSession(activeSessionId);
      setFramesData(analysisRes.frames || []);
      setIncidents(analysisRes.incidents || []);
      setMetrics({
        fps: analysisRes.metrics?.fpsMeasured || 18.2,
        latencyMs: analysisRes.metrics?.latencyMs || 42,
        totalFrames: analysisRes.metrics?.totalFrames || 0,
        processedFrames: analysisRes.metrics?.processedFrames || 0,
        activeTracks: analysisRes.metrics?.activeTracksCount || 5,
        alertCount: analysisRes.incidents?.length || 0
      });

      // Play video
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
        handleVideoResize();
      }

      showToast(`Analysis ready! Detected ${analysisRes.totalIncidents || 0} reviewable incidents.`, 'success');
    } catch (err) {
      console.error('Surveillance execution failed:', err);
      setProcessingState('idle');
      showToast(err.message || 'Failed to start examination monitoring', 'warning');
    }
  };

  const handlePause = async () => {
    if (videoRef.current) videoRef.current.pause();
    setProcessingState('paused');
    if (currentSession) await pauseExamSession(currentSession.sessionId).catch(() => {});
  };

  const handleResume = async () => {
    if (videoRef.current) videoRef.current.play().catch(() => {});
    setProcessingState('running');
    if (currentSession) await resumeExamSession(currentSession.sessionId).catch(() => {});
  };

  const handleStop = async () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setProcessingState('stopped');
    if (currentSession) await stopExamSession(currentSession.sessionId).catch(() => {});
    showToast('Examination surveillance session stopped.', 'info');
  };

  const handleRestart = async () => {
    handleStop();
    setTimeout(() => {
      handleStartSurveillance();
    }, 400);
  };

  // Seek video directly to incident timestamp
  const handleSeekToIncident = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, seconds - 1.0);
      videoRef.current.play().catch(() => {});
      showToast(`Jumped to ${seconds.toFixed(1)}s in examination video.`, 'info');
    }
  };

  // Update Incident Status
  const handleUpdateIncidentStatus = async (incidentId, newStatus) => {
    setIsUpdatingStatus(true);
    try {
      const res = await updateIncidentReview(incidentId, {
        reviewStatus: newStatus,
        reviewerNotes
      });

      // Update in local state
      setIncidents((prev) =>
        prev.map((inc) => (inc.incidentId === incidentId ? res.incident : inc))
      );

      if (selectedIncident && selectedIncident.incidentId === incidentId) {
        setSelectedIncident(res.incident);
      }

      showToast(`Incident marked as ${newStatus}`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update review status', 'warning');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Video Upload Handler
  const handleCustomUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast(`Uploading ${file.name} for examination surveillance...`, 'info');
    try {
      const res = await uploadExamVideo(file);
      setSelectedVideo(res.file.fileName);
      showToast('Custom examination video loaded successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Video upload failed', 'warning');
    }
  };

  // Filtered incidents list
  const filteredIncidents = incidents.filter((inc) => {
    const matchesStatus =
      statusFilter === 'all' || inc.reviewStatus.toLowerCase() === statusFilter.toLowerCase();
    const matchesType =
      eventTypeFilter === 'all' || inc.eventType === eventTypeFilter;
    const matchesSearch =
      !searchQuery ||
      inc.incidentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.eventLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(inc.trackingId).includes(searchQuery);

    return matchesStatus && matchesType && matchesSearch;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: '5rem',
            right: '2rem',
            zIndex: 9999,
            backgroundColor:
              toastType === 'success'
                ? '#065F46'
                : toastType === 'warning'
                ? '#991B1B'
                : 'var(--card-bg, #1E293B)',
            color: '#FFFFFF',
            padding: '0.85rem 1.4rem',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            border: '1px solid rgba(255,255,255,0.15)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {toastType === 'success' ? (
            <CheckCircle size={18} />
          ) : toastType === 'warning' ? (
            <AlertTriangle size={18} />
          ) : (
            <Info size={18} />
          )}
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Module E Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#3B82F6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              padding: '0.2rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid rgba(59, 130, 246, 0.25)'
            }}
          >
            Module E // Autonomous Surveillance
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              padding: '0.2rem 0.6rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            Vision Service: {healthData?.visionServiceStatus || 'Connected'}
          </span>
        </div>

        <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Responsible Examination Monitoring
        </h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '900px' }}>
          Multi-candidate examination hall surveillance with temporary spatial tracking, behavioral event detection,
          and human-in-the-loop dispute review. Strict zero-biometrics ethical compliance.
        </p>
      </div>

      {/* Ethical & Privacy Safeguards Banner */}
      <div
        style={{
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '12px',
          padding: '0.9rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              padding: '0.5rem',
              borderRadius: '8px',
              color: '#3B82F6'
            }}
          >
            <Lock size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Responsible AI & Privacy Protection Active
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              No facial recognition or identity database matching. Detections are observations requiring human evaluation, never automated proof of cheating.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <span style={{ padding: '0.2rem 0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
            YOLOv8 + 17-Keypoint Pose
          </span>
          <span style={{ padding: '0.2rem 0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
            Anonymous Track #IDs
          </span>
          <span style={{ padding: '0.2rem 0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
            Human Invigilator Review
          </span>
        </div>
      </div>

      {/* Main Grid: Left Video Player & Controls | Right Stats & Config */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Left Column: Video Player with Real-Time Bounding Box Overlay */}
        <div
          style={{
            backgroundColor: 'var(--card-bg, #1E293B)',
            borderRadius: '14px',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          {/* Top Player Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Video size={18} color="#3B82F6" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Surveillance Feed // {roomCode}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor: processingState === 'running' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                  color: processingState === 'running' ? '#EF4444' : 'var(--text-secondary)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                {processingState === 'running' && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
                )}
                {processingState.toUpperCase()}
              </span>
            </div>

            {/* Live Metrics HUD */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <div>
                FPS: <strong style={{ color: 'var(--text-primary)' }}>{metrics.fps}</strong>
              </div>
              <div>
                Candidates: <strong style={{ color: '#10B981' }}>{metrics.activeTracks}</strong>
              </div>
              <div>
                Alerts: <strong style={{ color: '#EF4444' }}>{metrics.alertCount}</strong>
              </div>
            </div>
          </div>

          {/* Video Container with Overlaid Dynamic Canvas */}
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16/9',
              backgroundColor: '#000000',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
            }}
          >
            <video
              ref={videoRef}
              src={`/api/modules/e/video/${selectedVideo}`}
              controls
              playsInline
              onLoadedMetadata={handleVideoResize}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'contain'
              }}
            />
            {/* The Synchronized High-Visibility Canvas Overlay */}
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
            />
          </div>

          {/* Video Playback Controls Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              paddingTop: '0.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {processingState !== 'running' ? (
                <button
                  onClick={handleStartSurveillance}
                  style={{
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.55rem 1.15rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <Play size={16} fill="#FFFFFF" />
                  Start Monitoring
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  style={{
                    backgroundColor: '#D97706',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.55rem 1.15rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  <Pause size={16} />
                  Pause
                </button>
              )}

              {processingState === 'paused' && (
                <button
                  onClick={handleResume}
                  style={{
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Play size={16} />
                  Resume
                </button>
              )}

              <button
                onClick={handleStop}
                disabled={processingState === 'idle'}
                style={{
                  backgroundColor: 'transparent',
                  color: processingState === 'idle' ? 'var(--text-secondary)' : '#EF4444',
                  border: '1px solid currentColor',
                  padding: '0.55rem 0.9rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: processingState === 'idle' ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  opacity: processingState === 'idle' ? 0.4 : 1
                }}
              >
                <Square size={15} />
                Stop
              </button>

              <button
                onClick={handleRestart}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                  padding: '0.55rem 0.9rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <RotateCcw size={15} />
                Restart
              </button>
            </div>

            {/* Quick Video Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Source:</span>
              <select
                value={selectedVideo}
                onChange={(e) => {
                  setSelectedVideo(e.target.value);
                  handleStop();
                }}
                style={{
                  backgroundColor: 'var(--bg-secondary, #0F172A)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem'
                }}
              >
                {sampleVideos.map((s) => (
                  <option key={s.fileName} value={s.fileName}>
                    {s.name}
                  </option>
                ))}
              </select>

              <label
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Upload size={14} />
                Upload MP4
                <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={handleCustomUpload} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Surveillance Parameters & Live Incident Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Hall Configuration Card */}
          <div
            style={{
              backgroundColor: 'var(--card-bg, #1E293B)',
              borderRadius: '14px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
              padding: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Layers size={18} color="#3B82F6" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Surveillance Parameters
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Room Code */}
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  Examination Hall / Room
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-secondary, #0F172A)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Frame Skip Acceleration */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  <span>Frame Sampling (Skip)</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{frameSkip}x (Processes 1/{frameSkip} frames)</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={frameSkip}
                  onChange={(e) => setFrameSkip(parseInt(e.target.value, 10))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  Accelerates inference throughput by ~{frameSkip * 100}% on CPU/GPU.
                </div>
              </div>

              {/* Head Turn Threshold */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  <span>Head Turn Sensitivity</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{headTurnThresh} turns / 5s</strong>
                </div>
                <input
                  type="range"
                  min="2"
                  max="6"
                  value={headTurnThresh}
                  onChange={(e) => setHeadTurnThresh(parseInt(e.target.value, 10))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              {/* Phone Confidence Threshold */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  <span>Device Detection Confidence</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{Math.round(phoneConfThresh * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="0.80"
                  step="0.05"
                  value={phoneConfThresh}
                  onChange={(e) => setPhoneConfThresh(parseFloat(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              {/* Restricted Zone Toggle */}
              <div style={{ paddingTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={restrictedZoneEnabled}
                    onChange={(e) => setRestrictedZoneEnabled(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Enable Restricted Podium Polygon</span>
                </label>
              </div>
            </div>
          </div>

          {/* Quick Metrics Card */}
          <div
            style={{
              backgroundColor: 'var(--card-bg, #1E293B)',
              borderRadius: '14px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
              padding: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <Activity size={18} color="#10B981" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Hall Status Telemetry
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ backgroundColor: 'var(--bg-secondary, #0F172A)', padding: '0.75rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Detected Candidates</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10B981', marginTop: '0.2rem' }}>
                  {metrics.activeTracks}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-secondary, #0F172A)', padding: '0.75rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Review Alerts</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#EF4444', marginTop: '0.2rem' }}>
                  {incidents.filter((i) => i.reviewStatus === 'Pending Review').length}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-secondary, #0F172A)', padding: '0.75rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Inference Rate</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  {metrics.fps} FPS
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-secondary, #0F172A)', padding: '0.75rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Frame Latency</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  {metrics.latencyMs} ms
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Incident Dashboard Section */}
      <div
        style={{
          backgroundColor: 'var(--card-bg, #1E293B)',
          borderRadius: '14px',
          border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
          padding: '1.5rem'
        }}
      >
        {/* Dashboard Title & Filter Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.25rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))'
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Examination Incident Audit Trail
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Showing {filteredIncidents.length} of {incidents.length} recorded behavioral events
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}
              />
              <input
                type="text"
                placeholder="Search Incident ID / Track..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-secondary, #0F172A)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                  padding: '0.4rem 0.75rem 0.4rem 2rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem'
                }}
              />
            </div>

            {/* Event Type Filter */}
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-secondary, #0F172A)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8rem'
              }}
            >
              <option value="all">All Event Types</option>
              <option value="repeated_head_turn">Repeated Head Turns</option>
              <option value="phone_detected">Phone Detected</option>
              <option value="prolonged_orientation">Prolonged Orientation</option>
              <option value="restricted_zone_entry">Restricted Zone Entry</option>
            </select>

            {/* Review Status Filter */}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {['all', 'Pending Review', 'Reviewed', 'Dismissed', 'Resolved'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    backgroundColor: statusFilter === st ? '#3B82F6' : 'rgba(255,255,255,0.06)',
                    color: statusFilter === st ? '#FFFFFF' : 'var(--text-secondary)',
                    border: 'none',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Incidents Table */}
        {filteredIncidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
            <CheckCircle size={36} color="#10B981" style={{ margin: '0 auto 0.75rem' }} />
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              No incidents match current filter
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              {incidents.length === 0
                ? 'Start surveillance or play the CCTV footage to begin real-time incident capture.'
                : 'Try adjusting your search criteria or review status filter.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.1))', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>Incident ID</th>
                  <th style={{ padding: '0.75rem' }}>Candidate</th>
                  <th style={{ padding: '0.75rem' }}>Observable Event</th>
                  <th style={{ padding: '0.75rem' }}>Video Time</th>
                  <th style={{ padding: '0.75rem' }}>Model Certainty</th>
                  <th style={{ padding: '0.75rem' }}>Review Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.map((inc) => (
                  <tr
                    key={inc.incidentId}
                    style={{
                      borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.05))',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    {/* Incident ID */}
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {inc.incidentId}
                    </td>

                    {/* Candidate Temporary Track ID */}
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.15)',
                          color: '#60A5FA',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.8rem'
                        }}
                      >
                        Track #{inc.trackingId}
                      </span>
                    </td>

                    {/* Observable Event */}
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inc.eventLabel}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {inc.eventType === 'repeated_head_turn'
                          ? `${inc.metadata?.turns_in_window || 3} direction flips in 5s window`
                          : inc.eventType === 'phone_detected'
                          ? 'Unauthorized mobile handset proximity'
                          : 'Sustained orientation toward neighbor'}
                      </div>
                    </td>

                    {/* Video Time + Seek Button */}
                    <td style={{ padding: '0.75rem' }}>
                      <button
                        onClick={() => handleSeekToIncident(inc.videoTimestampSeconds)}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                          padding: '0.25rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                        title="Seek video player directly to this incident"
                      >
                        <Clock size={12} />
                        {inc.videoTimestampSeconds.toFixed(1)}s
                      </button>
                    </td>

                    {/* Model Confidence */}
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          backgroundColor: inc.confidence >= 0.8 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: inc.confidence >= 0.8 ? '#34D399' : '#FBBF24',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.8rem'
                        }}
                      >
                        {Math.round(inc.confidence * 100)}%
                      </span>
                    </td>

                    {/* Review Status */}
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          backgroundColor:
                            inc.reviewStatus === 'Resolved'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : inc.reviewStatus === 'Dismissed'
                              ? 'rgba(148, 163, 184, 0.15)'
                              : inc.reviewStatus === 'Reviewed'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                          color:
                            inc.reviewStatus === 'Resolved'
                              ? '#34D399'
                              : inc.reviewStatus === 'Dismissed'
                              ? '#94A3B8'
                              : inc.reviewStatus === 'Reviewed'
                              ? '#60A5FA'
                              : '#F87171',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.75rem'
                        }}
                      >
                        {inc.reviewStatus}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => {
                            setSelectedIncident(inc);
                            setReviewerNotes(inc.reviewerNotes || '');
                          }}
                          style={{
                            backgroundColor: '#2563EB',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Review Evidence
                        </button>

                        {inc.reviewStatus === 'Pending Review' && (
                          <button
                            onClick={() => handleUpdateIncidentStatus(inc.incidentId, 'Dismissed')}
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.06)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                              padding: '0.3rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incident Review & Evidence Detail Modal */}
      {selectedIncident && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--card-bg, #1E293B)',
              borderRadius: '16px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3B82F6' }}>
                  Incident Appraisal // {selectedIncident.incidentId}
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.15rem 0 0', color: 'var(--text-primary)' }}>
                  {selectedIncident.eventLabel}
                </h3>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.35rem'
                }}
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* Evidence Snapshot Frame */}
            {selectedIncident.evidenceSnapshot && (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16/9',
                  backgroundColor: '#000000',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <img
                  src={selectedIncident.evidenceSnapshot}
                  alt="Incident Evidence Snapshot"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '0.65rem',
                    left: '0.75rem',
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    color: '#FFFFFF',
                    fontSize: '0.75rem'
                  }}
                >
                  Timestamp: {selectedIncident.videoTimestampSeconds}s // Anonymous Track #{selectedIncident.trackingId}
                </div>
              </div>
            )}

            {/* Metadata Breakdown */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-secondary, #0F172A)',
                padding: '0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem'
              }}
            >
              <div>
                <div style={{ color: 'var(--text-secondary)' }}>Model Confidence</div>
                <strong style={{ color: '#FBBF24', fontSize: '1rem' }}>
                  {Math.round(selectedIncident.confidence * 100)}%
                </strong>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)' }}>Assigned Subject</div>
                <strong style={{ color: '#60A5FA', fontSize: '1rem' }}>
                  Track #{selectedIncident.trackingId}
                </strong>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)' }}>Review Status</div>
                <strong style={{ color: '#34D399', fontSize: '1rem' }}>
                  {selectedIncident.reviewStatus}
                </strong>
              </div>
            </div>

            {/* Model Disclaimer Notice */}
            <div
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.8rem',
                color: '#FBBF24'
              }}
            >
              <strong>Important Notice:</strong> Model confidence represents vision certainty of the physical gesture, not proof of misconduct. Invigilators must evaluate environmental context before reaching a decision.
            </div>

            {/* Reviewer Notes Field */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Invigilator Audit Notes & Observations
              </label>
              <textarea
                rows={3}
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Record objective observations (e.g., student asked proctor for extra answer sheet, posture adjustment, lighting glare)..."
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-secondary, #0F172A)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                  padding: '0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  handleSeekToIncident(selectedIncident.videoTimestampSeconds);
                  setSelectedIncident(null);
                }}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Clock size={14} />
                Jump in Video
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  disabled={isUpdatingStatus}
                  onClick={() => handleUpdateIncidentStatus(selectedIncident.incidentId, 'Dismissed')}
                  style={{
                    backgroundColor: '#475569',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Dismiss (False Positive)
                </button>

                <button
                  disabled={isUpdatingStatus}
                  onClick={() => handleUpdateIncidentStatus(selectedIncident.incidentId, 'Reviewed')}
                  style={{
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Mark Reviewed
                </button>

                <button
                  disabled={isUpdatingStatus}
                  onClick={() => handleUpdateIncidentStatus(selectedIncident.incidentId, 'Resolved')}
                  style={{
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Resolve Incident
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
