import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Square,
  CheckCircle,
  AlertTriangle,
  Shield,
  ShieldCheck,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  BarChart3,
  List,
  Eye,
  Download,
  Info,
  Layers,
  Zap,
  ArrowRight,
  RefreshCw,
  Search,
  Check,
  X,
  Target,
  Coffee,
  Bookmark,
  Globe,
  Laptop
} from 'lucide-react';
import SEOHead from '../components/SEOHead';
import {
  fetchWellbeingHealth,
  fetchActiveSession,
  startFocusSession,
  pauseFocusSession,
  resumeFocusSession,
  stopFocusSession,
  discardFocusSession,
  fetchUserSessions,
  fetchCategorizationRules,
  createCategorizationRule,
  toggleCategorizationRule,
  deleteCategorizationRule,
  previewDomainClassification,
  generateSyntheticActivity,
  fetchActivityEvents,
  deleteActivityEvent,
  fetchWellbeingAnalytics,
  fetchPrivacyStatus,
  clearWellbeingHistory,
  exportWellbeingJson,
  syncExtensionSession,
  fetchExtensionSummary
} from '../utils/wellbeingApi';

export default function DigitalWellbeing() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'rules' | 'simulator' | 'analytics' | 'history' | 'privacy'

  // Focus Session State
  const [activeSession, setActiveSession] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionForm, setSessionForm] = useState({
    title: 'Compiler Design & System Architecture',
    targetDurationMinutes: 25,
    sessionCategory: 'coding',
    branchTrack: 'CSE'
  });
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [completionForm, setCompletionForm] = useState({
    focusQualityScore: 8,
    reflectionNotes: ''
  });

  // Rules State
  const [rulesData, setRulesData] = useState({ customRules: [], systemDefaults: [] });
  const [newRuleForm, setNewRuleForm] = useState({
    ruleName: '',
    pattern: '',
    matchType: 'domain_suffix',
    category: 'learning',
    priority: 80
  });
  const [previewInput, setPreviewInput] = useState('');
  const [previewResult, setPreviewResult] = useState(null);

  // Synthetic Simulator State
  const [simulatorConfig, setSimulatorConfig] = useState({
    scenario: 'focused_study',
    eventCount: 8,
    seed: 42
  });
  const [isGeneratingEvents, setIsGeneratingEvents] = useState(false);
  const [recentGeneratedEvents, setRecentGeneratedEvents] = useState([]);

  // Analytics & History State
  const [analyticsRange, setAnalyticsRange] = useState('all');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [sessionsHistory, setSessionsHistory] = useState([]);
  const [activityEventsList, setActivityEventsList] = useState([]);
  const [privacyInfo, setPrivacyInfo] = useState(null);

  // Status & Feedback messages
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);

  // Chrome Extension Integration State
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [extensionStats, setExtensionStats] = useState(null);
  const [extensionSummary, setExtensionSummary] = useState(null);
  const [isSyncingExtension, setIsSyncingExtension] = useState(false);
  const [extensionInstructionsOpen, setExtensionInstructionsOpen] = useState(false);

  // Local tick interval for smooth Cupertino timer display
  useEffect(() => {
    let timer = null;
    if (activeSession && activeSession.status === 'active') {
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeSession]);

  // Chrome Extension Detection & Message Bridge
  useEffect(() => {
    // 1. Check DOM marker immediately
    if (document.documentElement.dataset.universeExtensionInstalled === 'true') {
      setExtensionInstalled(true);
    }

    const handleExtensionReady = () => {
      setExtensionInstalled(true);
      requestExtensionData();
    };

    window.addEventListener('UNIVERSE_EXTENSION_READY', handleExtensionReady);

    // 2. Window message listener for content-bridge communication
    const handleBridgeMessage = (event) => {
      if (event.source !== window || !event.data || event.data.source !== 'UNIVERSE_EXTENSION') return;

      const { type, data } = event.data;
      if (type === 'EXTENSION_PONG') {
        setExtensionInstalled(true);
        requestExtensionData();
      } else if (type === 'RECEIVE_STATS') {
        setExtensionInstalled(true);
        setExtensionStats(data);
      } else if (type === 'SYNC_COMPLETED') {
        setIsSyncingExtension(false);
        if (data?.success) {
          setSuccessMsg('Successfully synchronized Chrome Extension statistics to your UniVerse dashboard!');
          loadAllData();
        } else {
          setErrorMsg(data?.error || 'Failed to sync extension data.');
        }
      }
    };

    window.addEventListener('message', handleBridgeMessage);

    // Ping extension on mount
    window.postMessage({ source: 'UNIVERSE_WEB', type: 'PING_EXTENSION' }, '*');
    window.postMessage({ source: 'UNIVERSE_WEB', type: 'REQUEST_STATS' }, '*');

    // Auto-authenticate extension with currently active UniVerse web token
    let token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      try {
        const userRaw = localStorage.getItem('loop_current_user');
        if (userRaw) token = JSON.parse(userRaw).token;
      } catch {}
    }
    if (token) {
      window.postMessage({
        source: 'UNIVERSE_WEB',
        type: 'PASS_AUTH_TOKEN',
        payload: { token, apiUrl: 'http://localhost:5001/api/modules/d' }
      }, '*');
    }

    return () => {
      window.removeEventListener('UNIVERSE_EXTENSION_READY', handleExtensionReady);
      window.removeEventListener('message', handleBridgeMessage);
    };
  }, []);

  function requestExtensionData() {
    window.postMessage({ source: 'UNIVERSE_WEB', type: 'REQUEST_STATS' }, '*');
  }

  async function handleTriggerExtensionSync() {
    setIsSyncingExtension(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Ask extension to sync to cloud
    window.postMessage({ source: 'UNIVERSE_WEB', type: 'TRIGGER_SYNC_TO_CLOUD' }, '*');

    // Also query backend summary
    setTimeout(async () => {
      try {
        const summary = await fetchExtensionSummary();
        if (summary.success) {
          setExtensionSummary(summary.summary);
        }
      } catch {}
      await loadAllData();
      setIsSyncingExtension(false);
    }, 1500);
  }

  // Initial Load of Active Session & Dashboard Data
  useEffect(() => {
    loadAllData();
  }, [analyticsRange]);

  async function loadAllData() {
    setLoading(true);
    setErrorMsg('');
    try {
      const [activeRes, rulesRes, analyticsRes, sessionsRes, eventsRes, privacyRes, extSummaryRes] = await Promise.all([
        fetchActiveSession().catch(() => ({ hasActiveSession: false, data: null })),
        fetchCategorizationRules().catch(() => ({ data: { customRules: [], systemDefaults: [] } })),
        fetchWellbeingAnalytics(analyticsRange).catch(() => ({ data: null })),
        fetchUserSessions({ limit: 15 }).catch(() => ({ data: [] })),
        fetchActivityEvents({ limit: 30 }).catch(() => ({ data: [] })),
        fetchPrivacyStatus().catch(() => null),
        fetchExtensionSummary().catch(() => null)
      ]);

      if (activeRes.hasActiveSession && activeRes.data) {
        setActiveSession(activeRes.data);
        setElapsedSeconds(activeRes.data.currentActiveSeconds || 0);
      } else {
        setActiveSession(null);
        setElapsedSeconds(0);
      }

      setRulesData(rulesRes.data || { customRules: [], systemDefaults: [] });
      setAnalyticsData(analyticsRes.data);
      setSessionsHistory(sessionsRes.data || []);
      setActivityEventsList(eventsRes.data || []);
      setPrivacyInfo(privacyRes);
      if (extSummaryRes?.success) setExtensionSummary(extSummaryRes.summary);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to initialize digital wellbeing dashboard.');
    } finally {
      setLoading(false);
    }
  }

  // --- Session Handlers ---
  async function handleStartSession(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsStartingSession(true);
    try {
      const res = await startFocusSession(sessionForm);
      setActiveSession(res.data);
      setElapsedSeconds(0);
      setSuccessMsg(`Focus session '${res.data.title}' initiated! Happy focusing.`);
      loadAllData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start session.');
    } finally {
      setIsStartingSession(false);
    }
  }

  async function handlePauseSession() {
    if (!activeSession) return;
    try {
      const res = await pauseFocusSession(activeSession._id);
      setActiveSession(res.data);
      setSuccessMsg('Session paused. Paused time does not count against your active focus time.');
      loadAllData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to pause session.');
    }
  }

  async function handleResumeSession() {
    if (!activeSession) return;
    try {
      const res = await resumeFocusSession(activeSession._id);
      setActiveSession(res.data);
      setSuccessMsg('Session resumed! Stay in the flow.');
      loadAllData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to resume session.');
    }
  }

  function handleOpenStopModal() {
    setCompletionModalOpen(true);
  }

  async function handleConfirmStopSession() {
    if (!activeSession) return;
    try {
      await stopFocusSession(activeSession._id, completionForm);
      setCompletionModalOpen(false);
      setActiveSession(null);
      setElapsedSeconds(0);
      setSuccessMsg('Focus session completed successfully and saved to your history!');
      loadAllData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to complete session.');
    }
  }

  async function handleDiscardSession() {
    if (!activeSession) return;
    if (!window.confirm('Are you sure you want to discard this in-progress focus session?')) return;
    try {
      await discardFocusSession(activeSession._id);
      setActiveSession(null);
      setElapsedSeconds(0);
      setSuccessMsg('Session discarded.');
      loadAllData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to discard session.');
    }
  }

  // --- Rules Handlers ---
  async function handleCreateRule(e) {
    e.preventDefault();
    try {
      await createCategorizationRule(newRuleForm);
      setNewRuleForm({ ruleName: '', pattern: '', matchType: 'domain_suffix', category: 'learning', priority: 80 });
      setSuccessMsg('Categorization rule saved!');
      const res = await fetchCategorizationRules();
      setRulesData(res.data || { customRules: [], systemDefaults: [] });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create rule.');
    }
  }

  async function handleToggleRule(ruleId) {
    try {
      await toggleCategorizationRule(ruleId);
      const res = await fetchCategorizationRules();
      setRulesData(res.data || { customRules: [], systemDefaults: [] });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to toggle rule.');
    }
  }

  async function handleDeleteRule(ruleId) {
    if (!window.confirm('Delete this custom classification rule?')) return;
    try {
      await deleteCategorizationRule(ruleId);
      setSuccessMsg('Rule deleted.');
      const res = await fetchCategorizationRules();
      setRulesData(res.data || { customRules: [], systemDefaults: [] });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete rule.');
    }
  }

  async function handlePreviewDomain(e) {
    e.preventDefault();
    if (!previewInput.trim()) return;
    try {
      const res = await previewDomainClassification(previewInput.trim());
      setPreviewResult(res);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to preview domain.');
    }
  }

  // --- Synthetic Generator Handlers ---
  async function handleGenerateSynthetic(e) {
    e.preventDefault();
    setIsGeneratingEvents(true);
    setErrorMsg('');
    try {
      const res = await generateSyntheticActivity({
        sessionId: activeSession ? activeSession._id : null,
        scenario: simulatorConfig.scenario,
        eventCount: simulatorConfig.eventCount,
        seed: simulatorConfig.seed
      });
      setRecentGeneratedEvents(res.events || []);
      setSuccessMsg(`Generated ${res.eventCount} simulated activity events for scenario: ${res.scenario}.`);
      loadAllData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate synthetic activity.');
    } finally {
      setIsGeneratingEvents(false);
    }
  }

  // --- Privacy & Deletion Handlers ---
  async function handleDeleteEvent(eventId) {
    try {
      await deleteActivityEvent(eventId);
      setSuccessMsg('Event record removed from your privacy ledger.');
      const eventsRes = await fetchActivityEvents({ limit: 30 });
      setActivityEventsList(eventsRes.data || []);
      const analyticsRes = await fetchWellbeingAnalytics(analyticsRange);
      setAnalyticsData(analyticsRes.data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete event.');
    }
  }

  async function handlePurgeAllHistory() {
    try {
      const res = await clearUserHistory();
      setPurgeConfirmOpen(false);
      setActiveSession(null);
      setElapsedSeconds(0);
      setSuccessMsg(`All digital wellbeing history purged: ${res.deletedSessionsCount} sessions & ${res.deletedEventsCount} events deleted.`);
      loadAllData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to purge history.');
    }
  }

  async function handleExportJson() {
    try {
      const blob = await exportWellbeingJson();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `universe_wellbeing_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setSuccessMsg('Privacy export downloaded successfully.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to export data.');
    }
  }

  // Format Elapsed Time (MM:SS or HH:MM:SS)
  const formattedTimer = useMemo(() => {
    const hrs = Math.floor(elapsedSeconds / 3600);
    const mins = Math.floor((elapsedSeconds % 3600) / 60);
    const secs = elapsedSeconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [elapsedSeconds]);

  // Target Goal Progress percentage
  const goalProgressPercent = useMemo(() => {
    if (!activeSession) return 0;
    const targetSec = (activeSession.targetDurationMinutes || 25) * 60;
    return Math.min(100, Math.round((elapsedSeconds / targetSec) * 100));
  }, [activeSession, elapsedSeconds]);

  // Category Badge Color
  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'learning': return { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' };
      case 'productive': return { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' };
      case 'distracting': return { bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA' };
      case 'neutral': return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
      default: return { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' };
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem 4rem 1rem' }}>
      <SEOHead
        title="Privacy-Aware Digital Wellbeing | UniVerse"
        description="User-controlled focus sessions, custom browsing categorization rules, synthetic telemetry demonstration, and zero-surveillance student privacy."
      />

      {/* 1. TOP HEADER & ETHICAL PRIVACY BADGE */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                UniVerse • Module D
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Learn • Commute • Focus
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Digital Wellbeing & Focus Control
            </h1>
          </div>

          {/* Live Session Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '6px 14px',
              borderRadius: '24px',
              background: activeSession
                ? (activeSession.status === 'active' ? '#ECFDF5' : '#FEF3C7')
                : 'var(--bg-secondary)',
              border: `1px solid ${activeSession
                ? (activeSession.status === 'active' ? '#A7F3D0' : '#FDE68A')
                : 'var(--border-color)'}`,
              color: activeSession
                ? (activeSession.status === 'active' ? '#047857' : '#B45309')
                : 'var(--text-secondary)',
              fontSize: '0.82rem',
              fontWeight: 700
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: activeSession
                  ? (activeSession.status === 'active' ? '#10B981' : '#F59E0B')
                  : '#9CA3AF',
                boxShadow: activeSession?.status === 'active' ? '0 0 8px #10B981' : 'none'
              }} />
              {activeSession
                ? (activeSession.status === 'active' ? 'Active Focus Session' : 'Session Paused')
                : 'Focus Tracker Idle'}
            </div>
          </div>
        </div>

        {/* Transparent Privacy Banner */}
        <div style={{
          background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.06) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldCheck size={18} color="#10B981" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              <strong>100% Client & User-Controlled:</strong> Zero background surveillance, no silent tab monitoring, and no capture of page content, passwords, or keystrokes.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('privacy')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#059669',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Review Data Rights →
          </button>
        </div>
      </div>

        {/* Chrome Extension Live Integration Panel */}
        <div style={{
          background: extensionInstalled
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.06) 100%)'
            : 'var(--bg-secondary)',
          border: extensionInstalled
            ? '1px solid rgba(139, 92, 246, 0.3)'
            : '1px dashed var(--border-color)',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          marginTop: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: '10px',
              background: extensionInstalled ? 'rgba(139, 92, 246, 0.15)' : 'rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Globe size={22} color={extensionInstalled ? '#8B5CF6' : 'var(--text-secondary)'} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  Chrome Browser Extension
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: extensionInstalled ? '#EDE9FE' : 'var(--bg-primary)',
                  color: extensionInstalled ? '#7C3AED' : 'var(--text-secondary)',
                  border: `1px solid ${extensionInstalled ? '#DDD6FE' : 'var(--border-color)'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: extensionInstalled ? '#10B981' : '#9CA3AF'
                  }} />
                  {extensionInstalled ? 'Extension Connected (MV3)' : 'Not Connected'}
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {extensionInstalled ? (
                  extensionStats?.session?.status === 'active' ? (
                    <span style={{ color: '#10B981', fontWeight: 600 }}>
                      ● Live Focus Session in Browser: {Math.floor((extensionStats?.activeSeconds || 0) / 60)}m elapsed
                      {extensionStats?.currentTabInfo?.hostname && ` on ${extensionStats.currentTabInfo.hostname}`}
                    </span>
                  ) : (
                    <span>
                      Statistics: <strong>{analyticsData?.summary?.extensionActiveMinutes || extensionSummary?.totalActiveMinutes || 0} mins</strong> focus time across <strong>{analyticsData?.summary?.extensionSessionCount || extensionSummary?.sessionsCount || 0}</strong> browser session(s).
                    </span>
                  )
                ) : (
                  <span>
                    Use the companion Chrome Extension to track study focus across browser tabs with zero surveillance.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {extensionInstalled ? (
              <>
                <button
                  onClick={requestExtensionData}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                  title="Refresh live extension status"
                >
                  <RefreshCw size={13} /> Refresh
                </button>
                <button
                  onClick={handleTriggerExtensionSync}
                  disabled={isSyncingExtension}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#8B5CF6',
                    color: '#FFFFFF',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: isSyncingExtension ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    opacity: isSyncingExtension ? 0.7 : 1
                  }}
                >
                  <RefreshCw size={14} className={isSyncingExtension ? 'animate-spin' : ''} />
                  {isSyncingExtension ? 'Syncing to Dashboard...' : 'Sync Extension Stats'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setExtensionInstructionsOpen(true)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1px solid #8B5CF6',
                  background: 'rgba(139, 92, 246, 0.08)',
                  color: '#7C3AED',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                How to Load Extension →
              </button>
            )}
          </div>
        </div>

        {/* Modal: How to load Chrome Extension */}
        {extensionInstructionsOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}>
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Load UniVerse Chrome Extension</h3>
                <button
                  onClick={() => setExtensionInstructionsOpen(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  <X size={20} />
                </button>
              </div>
              <ol style={{ paddingLeft: '1.25rem', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 1.25rem 0' }}>
                <li>Open Google Chrome and navigate to <code>chrome://extensions</code></li>
                <li>Enable <strong>Developer mode</strong> in the top-right corner.</li>
                <li>Click <strong>Load unpacked</strong> in the top-left corner.</li>
                <li>Select the <code>loop/extension</code> directory from this project.</li>
                <li>Return here — the extension will instantly connect and display your browsing statistics!</li>
              </ol>
              <button
                onClick={() => setExtensionInstructionsOpen(false)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#8B5CF6',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Got It
              </button>
            </div>
          </div>
        )}

      {/* Alerts */}
      {errorMsg && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} /> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      {/* 2. NAVIGATION TABS */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '1.75rem',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        {[
          { id: 'overview', label: 'Focus Controller', icon: Clock },
          { id: 'analytics', label: 'Activity Insights', icon: BarChart3 },
          { id: 'rules', label: 'Categorization Rules', icon: Sliders },
          { id: 'simulator', label: 'Synthetic Generator', icon: Sparkles },
          { id: 'history', label: 'Session History', icon: Bookmark },
          { id: 'privacy', label: 'Privacy Center', icon: Shield }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.65rem 1.1rem',
                border: 'none',
                background: 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.9rem',
                borderBottom: isActive ? '2px solid #10B981' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
            >
              <Icon size={16} color={isActive ? '#10B981' : 'currentColor'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW / FOCUS SESSION CONTROLLER                                */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Main Apple-style Timer Card */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10B981', marginBottom: '0.35rem' }}>
              {activeSession ? activeSession.title : 'Focus Session Ready'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Category: <strong>{activeSession ? activeSession.sessionCategory.toUpperCase() : sessionForm.sessionCategory.toUpperCase()}</strong>
              {activeSession && ` • Goal: ${activeSession.targetDurationMinutes} mins`}
            </div>

            {/* Giant Digital Stopwatch */}
            <div style={{
              fontSize: '4.2rem',
              fontWeight: 900,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", monospace',
              letterSpacing: '-0.03em',
              color: activeSession?.status === 'paused' ? '#F59E0B' : 'var(--text-primary)',
              lineHeight: 1,
              marginBottom: '1rem',
              transition: 'color 0.3s ease'
            }}>
              {formattedTimer}
            </div>

            {/* Target Goal Progress Bar */}
            {activeSession && (
              <div style={{ maxWidth: '320px', margin: '0 auto 1.75rem auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  <span>Goal Progress</span>
                  <span>{goalProgressPercent}% ({activeSession.targetDurationMinutes}m)</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${goalProgressPercent}%`, height: '100%', background: '#10B981', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )}

            {/* Controls */}
            {activeSession ? (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {activeSession.status === 'active' ? (
                  <button
                    onClick={handlePauseSession}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.4rem',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Pause size={16} /> Pause
                  </button>
                ) : (
                  <button
                    onClick={handleResumeSession}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.4rem',
                      borderRadius: '12px',
                      border: 'none',
                      background: '#10B981',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Play size={16} /> Resume Focus
                  </button>
                )}

                <button
                  onClick={handleOpenStopModal}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.4rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#047857',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Square size={16} /> Complete & Save
                </button>

                <button
                  onClick={handleDiscardSession}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: '#EF4444',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Discard without saving"
                >
                  <Trash2 size={16} /> Discard
                </button>
              </div>
            ) : (
              /* Session Initiation Form */
              <form onSubmit={handleStartSession} style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Session Focus Title
                  </label>
                  <input
                    type="text"
                    value={sessionForm.title}
                    onChange={e => setSessionForm({ ...sessionForm, title: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Target Duration
                    </label>
                    <select
                      value={sessionForm.targetDurationMinutes}
                      onChange={e => setSessionForm({ ...sessionForm, targetDurationMinutes: parseInt(e.target.value, 10) })}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                    >
                      <option value={15}>15 Minutes (Sprint)</option>
                      <option value={25}>25 Minutes (Pomodoro)</option>
                      <option value={45}>45 Minutes (Lecture)</option>
                      <option value={60}>60 Minutes (Deep Work)</option>
                      <option value={90}>90 Minutes (Ultra Focus)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Category
                    </label>
                    <select
                      value={sessionForm.sessionCategory}
                      onChange={e => setSessionForm({ ...sessionForm, sessionCategory: e.target.value })}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                    >
                      <option value="coding">Coding & Labs</option>
                      <option value="revision">Exam Revision</option>
                      <option value="exam_prep">Placement Prep</option>
                      <option value="reading">Reading & Research</option>
                      <option value="deep_work">Deep Work</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isStartingSession}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Play size={18} /> {isStartingSession ? 'Initiating Session...' : 'Start Focus Session'}
                </button>
              </form>
            )}
          </div>

          {/* Quick Stats & Nudges Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Quick KPI summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.1rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Total Focus Time
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                  {analyticsData?.summary?.activeFocusMinutes || 0} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>mins</span>
                </div>
              </div>

              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.1rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Context Switches
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#3B82F6', marginTop: '0.25rem' }}>
                  {analyticsData?.summary?.totalContextSwitches || 0}
                </div>
              </div>
            </div>

            {/* Mindful Nudge Box */}
            {analyticsData?.nudges && analyticsData.nudges.length > 0 && (
              <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '14px', padding: '1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
                  <Coffee size={18} color="#3B82F6" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {analyticsData.nudges[0].title}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {analyticsData.nudges[0].message}
                </p>
              </div>
            )}

            {/* Fast Action to Simulator */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Sparkles size={16} color="#8B5CF6" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Synthetic Activity Simulator
                </span>
              </div>
              <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Demonstrate realistic student browsing patterns across focused study and social media distractions with reproducible seeds.
              </p>
              <button
                onClick={() => setActiveTab('simulator')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Open Event Generator →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ACTIVITY INSIGHTS & ANALYTICS                                      */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div>
          {/* Time Filter Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Focus Habit Telemetry</h3>
            <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              {['today', 'week', 'all'].map(r => (
                <button
                  key={r}
                  onClick={() => setAnalyticsRange(r)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: analyticsRange === r ? '#10B981' : 'transparent',
                    color: analyticsRange === r ? '#FFFFFF' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {r === 'all' ? 'All-Time' : r === 'today' ? 'Today' : 'Past 7 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* 4 Core KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Focus Duration</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10B981', marginTop: '0.35rem' }}>
                {analyticsData?.summary?.activeFocusMinutes || 0} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>mins</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                {analyticsData?.summary?.hasExtensionData ? (
                  <span>
                    <strong>{analyticsData?.summary?.extensionActiveMinutes || 0}m</strong> via Extension · <strong>{analyticsData?.summary?.webActiveMinutes || 0}m</strong> via Web
                  </span>
                ) : (
                  <span>Across {analyticsData?.summary?.completedSessions || 0} completed session(s)</span>
                )}
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Context Switches</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#3B82F6', marginTop: '0.35rem' }}>
                {analyticsData?.summary?.totalContextSwitches || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                Transitions between distinct categories
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Time on Distracting Sites</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#F59E0B', marginTop: '0.35rem' }}>
                {analyticsData?.summary?.distractingMinutes || 0} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>mins</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                Estimated from synthetic demo events
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Goal Progress Index</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#8B5CF6', marginTop: '0.35rem' }}>
                {analyticsData?.summary?.goalCompletionPercent || 0}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                Productivity index: {analyticsData?.summary?.productivityScore || 85}/100
              </div>
            </div>
          </div>

          {/* Category Distribution SVG Bars */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700 }}>Activity Category Breakdown</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {analyticsData?.categoryBreakdown?.map(item => {
                const style = getCategoryColor(item.category);
                return (
                  <div key={item.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      <span style={{ textTransform: 'capitalize', color: style.text }}>
                        ● {item.category} ({item.count} events)
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {item.durationMinutes} mins ({item.percent}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.percent}%`, height: '100%', background: style.text, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CATEGORIZATION RULES                                               */}
      {/* ========================================================================= */}
      {activeTab === 'rules' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Rules List */}
          <div>
            <h3 style={{ margin: '0 0 0.85rem 0', fontSize: '1.05rem', fontWeight: 700 }}>Active Categorization Rules</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
              User rules take priority over system presets. You decide which platforms are learning vs distracting.
            </p>

            {/* Custom Rules */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Your Custom Rules ({rulesData.customRules.length})
              </div>
              {rulesData.customRules.length === 0 ? (
                <div style={{ padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '10px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  No custom rules yet. Create one on the right to customize classifications!
                </div>
              ) : (
                rulesData.customRules.map(r => {
                  const style = getCategoryColor(r.category);
                  return (
                    <div key={r._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{r.ruleName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Pattern: <code>{r.pattern}</code> ({r.matchType}) • Priority: {r.priority}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: style.bg, color: style.text }}>
                          {r.category.toUpperCase()}
                        </span>
                        <button
                          onClick={() => handleToggleRule(r._id)}
                          style={{ padding: '4px 8px', fontSize: '0.72rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: r.isEnabled ? '#10B981' : '#9CA3AF', color: '#FFFFFF', cursor: 'pointer', fontWeight: 600 }}
                        >
                          {r.isEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(r._id)}
                          style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* System Presets Accordion */}
            <details style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.75rem 1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                View Built-in Campus System Presets ({rulesData.systemDefaults.length})
              </summary>
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {rulesData.systemDefaults.map((r, idx) => {
                  const style = getCategoryColor(r.category);
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <span>{r.ruleName} (<code>{r.pattern}</code>)</span>
                      <span style={{ fontWeight: 700, color: style.text, textTransform: 'capitalize' }}>{r.category}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>

          {/* Add Rule Form & Previewer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Create Rule */}
            <form onSubmit={handleCreateRule} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.25rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700 }}>Create Categorization Rule</h4>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. SPIT Lab Materials"
                  value={newRuleForm.ruleName}
                  onChange={e => setNewRuleForm({ ...newRuleForm, ruleName: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Domain or Hostname Pattern</label>
                <input
                  type="text"
                  placeholder="e.g. coursera.org, stackoverflow.com"
                  value={newRuleForm.pattern}
                  onChange={e => setNewRuleForm({ ...newRuleForm, pattern: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Category</label>
                  <select
                    value={newRuleForm.category}
                    onChange={e => setNewRuleForm({ ...newRuleForm, category: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  >
                    <option value="learning">Learning</option>
                    <option value="productive">Productive</option>
                    <option value="distracting">Distracting</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Match Type</label>
                  <select
                    value={newRuleForm.matchType}
                    onChange={e => setNewRuleForm({ ...newRuleForm, matchType: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  >
                    <option value="domain_suffix">Domain Suffix</option>
                    <option value="exact_host">Exact Host</option>
                    <option value="contains">Contains Substring</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#10B981',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                + Save Rule
              </button>
            </form>

            {/* Test / Preview Box */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700 }}>Test Rule Classification</h4>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Test any web domain to verify how your custom and system rules classify it.
              </p>
              <form onSubmit={handlePreviewDomain} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="e.g. https://leetcode.com/problemset"
                  value={previewInput}
                  onChange={e => setPreviewInput(e.target.value)}
                  style={{ flex: 1, padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                />
                <button
                  type="submit"
                  style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', background: '#3B82F6', color: '#FFFFFF', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Test
                </button>
              </form>

              {previewResult && (
                <div style={{ padding: '0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.8rem' }}>
                  <div>Normalized: <code>{previewResult.normalizedDomain}</code></div>
                  <div style={{ marginTop: '0.25rem' }}>
                    Result: <strong style={{ color: getCategoryColor(previewResult.classification.category).text, textTransform: 'uppercase' }}>{previewResult.classification.category}</strong>
                    {' '}(via: {previewResult.classification.ruleName})
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SYNTHETIC ACTIVITY EVENT GENERATOR                                 */}
      {/* ========================================================================= */}
      {activeTab === 'simulator' && (
        <div>
          {/* Explicit Disclosure Header */}
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Sparkles size={22} color="#D97706" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#B45309' }}>
                DEMO EVENT GENERATOR · 100% REPRODUCIBLE SYNTHETIC ACTIVITY
              </div>
              <div style={{ fontSize: '0.78rem', color: '#92400E', marginTop: '2px' }}>
                Generates realistic browsing-like study sequences using a seeded pseudo-random engine. Zero real browser telemetry or background extension required.
              </div>
            </div>
          </div>

          <form onSubmit={handleGenerateSynthetic} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.75rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700 }}>Configure Scenario Simulation</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Study Scenario
                </label>
                <select
                  value={simulatorConfig.scenario}
                  onChange={e => setSimulatorConfig({ ...simulatorConfig, scenario: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                >
                  <option value="focused_study">🎯 Focused Study (High Learning, Minimal Switches)</option>
                  <option value="mixed_study">🔀 Mixed Study & Entertainment (Alternating Media)</option>
                  <option value="frequent_switching">⚡ Frequent Switching (High Multitasking Fatigue)</option>
                  <option value="minimal_activity">🧘 Minimal Sustained Activity (Long Focus Blocks)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Event Count (Volume)
                </label>
                <input
                  type="number"
                  min="3"
                  max="30"
                  value={simulatorConfig.eventCount}
                  onChange={e => setSimulatorConfig({ ...simulatorConfig, eventCount: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  PRNG Seed (Reproducibility)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    value={simulatorConfig.seed}
                    onChange={e => setSimulatorConfig({ ...simulatorConfig, seed: parseInt(e.target.value, 10) })}
                    style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setSimulatorConfig({ ...simulatorConfig, seed: Math.floor(Math.random() * 9000 + 1000) })}
                    style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    title="Randomize Seed"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isGeneratingEvents}
              style={{
                padding: '0.85rem 1.75rem',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)'
              }}
            >
              <Sparkles size={16} /> {isGeneratingEvents ? 'Generating Synthetic Stream...' : 'Generate Simulated Activity'}
            </button>
          </form>

          {/* Generated Events Inspection Table */}
          {activityEventsList.length > 0 && (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Inspectable Event Stream ({activityEventsList.length} events)</h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Each record is independently deletable</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.5rem' }}>Time</th>
                      <th style={{ padding: '0.5rem' }}>Domain</th>
                      <th style={{ padding: '0.5rem' }}>Activity Label</th>
                      <th style={{ padding: '0.5rem' }}>Category</th>
                      <th style={{ padding: '0.5rem' }}>Est. Duration</th>
                      <th style={{ padding: '0.5rem' }}>Source</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityEventsList.slice(0, 15).map(ev => {
                      const style = getCategoryColor(ev.category);
                      return (
                        <tr key={ev._id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                          <td style={{ padding: '0.55rem 0.5rem', whiteSpace: 'nowrap' }}>
                            {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem', fontWeight: 600 }}><code>{ev.domain}</code></td>
                          <td style={{ padding: '0.55rem 0.5rem', color: 'var(--text-secondary)' }}>{ev.label || '-'}</td>
                          <td style={{ padding: '0.55rem 0.5rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: style.bg, color: style.text, textTransform: 'capitalize' }}>
                              {ev.category}
                            </span>
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem' }}>{ev.durationSeconds}s</td>
                          <td style={{ padding: '0.55rem 0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            {ev.source === 'chrome_extension' ? (
                              <span style={{ background: '#EDE9FE', color: '#6D28D9', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>EXTENSION</span>
                            ) : (
                              <span style={{ background: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: '4px' }}>SIMULATED</span>
                            )}
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>
                            <button
                              onClick={() => handleDeleteEvent(ev._id)}
                              style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px 6px' }}
                              title="Delete record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SESSION HISTORY                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 700 }}>Past Focus Sessions</h3>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Complete audit trail of user-initiated focus blocks with duration, context switches, and self-ratings.
          </p>

          {sessionsHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <Clock size={32} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600 }}>No focus sessions recorded yet.</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Start your first session from the Focus Controller!</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Date</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Title</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Category</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Source</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Status</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Active Duration</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Switches</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Quality</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Reflection</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionsHistory.map(s => (
                    <tr key={s._id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700 }}>{s.title}</td>
                      <td style={{ padding: '0.65rem 0.5rem', textTransform: 'capitalize' }}>{s.sessionCategory}</td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        {s.source === 'chrome_extension' ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#EDE9FE', color: '#6D28D9', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            🌐 Extension
                          </span>
                        ) : s.source === 'synthetic_demo' || s.isSimulated ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#F3F4F6', color: '#6B7280' }}>
                            Synthetic
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#ECFDF5', color: '#047857' }}>
                            💻 Web App
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: s.status === 'completed' ? '#DCFCE7' : (s.status === 'active' ? '#ECFDF5' : '#FEF3C7'),
                          color: s.status === 'completed' ? '#15803D' : (s.status === 'active' ? '#047857' : '#B45309')
                        }}>
                          {s.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>
                        {Math.round((s.accumulatedActiveSeconds || 0) / 60)} mins (Goal: {s.targetDurationMinutes}m)
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>{s.contextSwitchCount || 0}</td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>{s.focusQualityScore || 8}/10 ⭐</td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.reflectionNotes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: PRIVACY CENTER & DATA PURGE                                        */}
      {/* ========================================================================= */}
      {activeTab === 'privacy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Privacy Status & Principles */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
              <ShieldCheck size={24} color="#10B981" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Student Data Privacy Commitments</h3>
            </div>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              UniVerse treats student attention and browsing telemetry as deeply sensitive personal information.
              Unlike commercial tracking extensions, this module is strictly opt-in and operates without background snooping.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#10B981', marginBottom: '0.25rem' }}>✓ What We Store</div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <li>Your user-initiated focus session timestamps.</li>
                  <li>Custom categorization rules you create.</li>
                  <li>Synthetic demonstration browsing events you trigger.</li>
                  <li>Salted SHA-256 pseudonymized hash for research export.</li>
                </ul>
              </div>

              <div style={{ padding: '1rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#EF4444', marginBottom: '0.25rem' }}>✕ What We NEVER Collect</div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <li>No keystrokes, form inputs, or search queries.</li>
                  <li>No passwords, auth tokens, or private messages.</li>
                  <li>No silent background browser history scraping.</li>
                  <li>No selling or sharing of data with third parties.</li>
                </ul>
              </div>
            </div>

            {/* Export JSON Button */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleExportJson}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <Download size={16} /> Export My Data (JSON)
              </button>
            </div>
          </div>

          {/* Right to be forgotten (Danger Zone) */}
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '16px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
              <AlertTriangle size={20} color="#DC2626" />
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#B91C1C' }}>
                Right to be Forgotten · Purge All History
              </h4>
            </div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: '#991B1B', lineHeight: 1.45 }}>
              Permanently and irreversibly delete all your focus sessions, activity events, and analytics records from MongoDB Atlas. Custom categorization rules are preserved.
            </p>

            {purgeConfirmOpen ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#991B1B' }}>
                  Are you absolutely sure? This cannot be undone.
                </span>
                <button
                  onClick={handlePurgeAllHistory}
                  style={{
                    padding: '0.55rem 1.1rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#DC2626',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Yes, Permanently Purge Everything
                </button>
                <button
                  onClick={() => setPurgeConfirmOpen(false)}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: '#FFFFFF',
                    color: '#374151',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setPurgeConfirmOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '10px',
                  border: '1px solid #F87171',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={16} /> Purge All My Wellbeing History
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMPLETION MODAL                                                          */}
      {/* ========================================================================= */}
      {completionModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '2rem',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 800 }}>Complete Focus Session</h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Total Active Time: <strong>{Math.floor(elapsedSeconds / 60)} minutes</strong>. How was your focus?
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Self-Rated Quality ({completionForm.focusQualityScore}/10)
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={completionForm.focusQualityScore}
                onChange={e => setCompletionForm({ ...completionForm, focusQualityScore: parseInt(e.target.value, 10) })}
                style={{ width: '100%', accentColor: '#10B981' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <span>1 - Highly Distracted</span>
                <span>5 - Moderate</span>
                <span>10 - Deep Flow</span>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Reflection Notes (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Completed AST visitor pattern and resolved Dijkstra heap test."
                value={completionForm.reflectionNotes}
                onChange={e => setCompletionForm({ ...completionForm, reflectionNotes: e.target.value })}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setCompletionModalOpen(false)}
                style={{ padding: '0.65rem 1.1rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStopSession}
                style={{ padding: '0.65rem 1.4rem', borderRadius: '10px', border: 'none', background: '#10B981', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
              >
                Save & Finalize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
