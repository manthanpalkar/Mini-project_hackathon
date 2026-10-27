import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity, Server, Database, HardDrive, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, RefreshCw, Search, FileText, Layers,
  ArrowUpDown, Terminal, Info, Zap
} from 'lucide-react';
import { getSystemHealthDiagnostics, verifyDatabaseWrite, formatBytes } from '../utils/db';

export default function SystemHealthDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState(null);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Collections search and sort state
  const [collectionSearch, setCollectionSearch] = useState('');
  const [collectionSortKey, setCollectionSortKey] = useState('storageSize'); // 'storageSize' | 'documentCount' | 'name'
  const [collectionSortAsc, setCollectionSortAsc] = useState(false);

  // Migration checklist filter
  const [checklistFilter, setChecklistFilter] = useState('all'); // 'all' | 'pass' | 'warning' | 'fail'
  const [showMigrationGuide, setShowMigrationGuide] = useState(false);

  const fetchDiagnostics = useCallback(async (forceFresh = false) => {
    try {
      if (forceFresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const res = await getSystemHealthDiagnostics(forceFresh);
      setData(res);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load system diagnostics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics(false);
  }, [fetchDiagnostics]);

  // If in fallback mode (waiting for Render deployment), automatically check every 15s
  useEffect(() => {
    if (!data?._isFallback) return;
    const timer = setInterval(() => {
      fetchDiagnostics(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [data?._isFallback, fetchDiagnostics]);

  const handleRunWriteProbe = async () => {
    try {
      setProbing(true);
      const res = await verifyDatabaseWrite();
      setProbeResult(res);
      await fetchDiagnostics(true);
    } catch (err) {
      setProbeResult({ success: false, message: err.message });
    } finally {
      setProbing(false);
    }
  };

  // Filtered and sorted collections
  const sortedCollections = useMemo(() => {
    if (!data?.collections) return [];
    let list = [...data.collections];

    if (collectionSearch.trim()) {
      const q = collectionSearch.trim().toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let valA = a[collectionSortKey];
      let valB = b[collectionSortKey];

      if (valA === null || valA === undefined) valA = 0;
      if (valB === null || valB === undefined) valB = 0;

      if (typeof valA === 'string') {
        return collectionSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return collectionSortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [data?.collections, collectionSearch, collectionSortKey, collectionSortAsc]);

  // Filtered migration checks
  const filteredChecks = useMemo(() => {
    if (!data?.migrationReadiness?.checks) return [];
    if (checklistFilter === 'all') return data.migrationReadiness.checks;
    return data.migrationReadiness.checks.filter(
      c => c.status.toLowerCase() === checklistFilter.toLowerCase()
    );
  }, [data?.migrationReadiness?.checks, checklistFilter]);

  const getAlertColor = (level) => {
    switch (level) {
      case 'Near limit': return '#d70015';
      case 'Critical': return '#ff453a';
      case 'Warning': return '#ff9500';
      default: return '#30d158';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pass':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'rgba(48, 209, 88, 0.12)', color: '#30d158' }}>
            <CheckCircle2 size={13} /> Pass
          </span>
        );
      case 'Warning':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'rgba(255, 149, 0, 0.12)', color: '#ff9500' }}>
            <AlertTriangle size={13} /> Warning
          </span>
        );
      case 'Fail':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'rgba(255, 69, 58, 0.12)', color: '#ff453a' }}>
            <XCircle size={13} /> Fail
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            <Info size={13} /> {status || 'Not checked'}
          </span>
        );
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds && seconds !== 0) return 'Unavailable';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m ${seconds % 60}s`;
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
        {[1, 2, 3].map(n => (
          <div key={n} className="loop-card skeleton-pulse" style={{ padding: '2rem', borderRadius: '16px', minHeight: '130px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }} />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="loop-card" style={{ padding: '2.5rem', textAlign: 'center', borderRadius: '16px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
        <AlertTriangle size={36} color="#ff453a" style={{ marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Failed to Load System Diagnostics</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{error}</p>
        <button onClick={() => fetchDiagnostics(true)} className="btn btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
          Retry Diagnostics
        </button>
      </div>
    );
  }

  const { storage, backend, gridfs, performance, migrationReadiness } = data || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Deploying Notice Banner (When Render deployment is in progress) */}
      {data?._isFallback && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem 1.25rem',
          borderRadius: '16px',
          backgroundColor: 'rgba(255, 149, 0, 0.08)',
          border: '1px solid rgba(255, 149, 0, 0.25)',
          color: 'var(--text-primary)',
          fontSize: '0.85rem'
        }}>
          <AlertTriangle size={20} color="#ff9500" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, lineHeight: 1.5 }}>
            <strong style={{ color: '#ff9500' }}>Render Backend Deploying: </strong>
            The latest system diagnostics build is currently queued or compiling on Render. The dashboard is streaming live connectivity, database state, server uptime, and migration checks from <code>/health</code>. Per-collection disk space will automatically populate once Render finishes compiling.
          </div>
          <button
            onClick={() => fetchDiagnostics(true)}
            disabled={refreshing}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={12} className={refreshing ? 'spin-animation' : ''} />
            <span>{refreshing ? 'Checking...' : 'Check Status'}</span>
          </button>
        </div>
      )}

      {/* 1. Overall System Header & Quick Actions */}
      <div className="loop-card" style={{ padding: '1.75rem 2rem', borderRadius: '20px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>System Health & Database Diagnostics</h2>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                backgroundColor: data?.overallStatus === 'Healthy' ? 'rgba(48, 209, 88, 0.12)' : 'rgba(255, 149, 0, 0.12)',
                color: data?.overallStatus === 'Healthy' ? '#30d158' : '#ff9500',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: data?.overallStatus === 'Healthy' ? '#30d158' : '#ff9500' }} />
                {data?.overallStatus || 'Active'}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
              Live telemetry for MongoDB Atlas storage, collections breakdown, GridFS integrity, and college server migration readiness.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => fetchDiagnostics(true)}
              disabled={refreshing}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1.1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: '10px'
              }}
              title="Poll latest MongoDB and runtime telemetry"
            >
              <RefreshCw size={14} className={refreshing ? 'spin-animation' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={handleRunWriteProbe}
              disabled={probing}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1.1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: '10px'
              }}
              title="Verify live database read/write integrity without modifying records"
            >
              <Zap size={14} />
              <span>{probing ? 'Probing...' : 'Verify DB Probe'}</span>
            </button>
          </div>
        </div>

        {lastRefreshed && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span>Last polled: {lastRefreshed.toLocaleTimeString()} ({lastRefreshed.toLocaleDateString()})</span>
            {probeResult && (
              <span style={{ color: probeResult.success ? '#30d158' : '#ff453a', fontWeight: 600 }}>
                {probeResult.success ? `✓ ${probeResult.message} (${probeResult.durationMs}ms)` : `✗ ${probeResult.message}`}
              </span>
            )}
          </div>
        )}

        {/* High-Level Status Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
          {/* Card: DB Connection */}
          <div style={{ padding: '1.1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Database</span>
              <Database size={16} color="var(--accent-color)" />
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: storage?.connected ? '#30d158' : '#ff453a' }}>
              {storage?.connected ? 'Connected' : 'Disconnected'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Ping: {backend?.databaseConnection?.pingLatencyMs !== null ? `${backend?.databaseConnection?.pingLatencyMs}ms` : 'Unavailable'}
            </div>
          </div>

          {/* Card: Storage Quota */}
          <div style={{ padding: '1.1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Storage Quota</span>
              <HardDrive size={16} color={getAlertColor(storage?.alertLevel)} />
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: getAlertColor(storage?.alertLevel) }}>
              {storage?.usedPercentage ?? 0}%
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {storage?.formattedTotalAllocated || '0 B'} / {storage?.formattedQuota || '512 MB'}
            </div>
          </div>

          {/* Card: Server Uptime */}
          <div style={{ padding: '1.1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Uptime</span>
              <Server size={16} color="var(--accent-color)" />
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
              {formatUptime(backend?.uptimeSeconds)}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Node {backend?.nodeVersion || 'v18+'} ({backend?.environment})
            </div>
          </div>

          {/* Card: Migration Readiness */}
          <div style={{ padding: '1.1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Migration Readiness</span>
              <ShieldCheck size={16} color="#30d158" />
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#30d158' }}>
              {migrationReadiness?.score || 100}%
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {migrationReadiness?.passCount || 0} / {migrationReadiness?.totalChecks || 0} Checks Passing
            </div>
          </div>
        </div>
      </div>

      {/* 2. Database Storage — MongoDB Atlas */}
      <div className="loop-card" style={{ padding: '2rem', borderRadius: '20px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HardDrive size={18} />
              <span>MongoDB Atlas Storage Consumption</span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
              Cluster storage breakdown, free tier quota thresholds, and physical disk headroom.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              padding: '0.3rem 0.8rem',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 700,
              backgroundColor: `${getAlertColor(storage?.alertLevel)}1A`,
              color: getAlertColor(storage?.alertLevel)
            }}>
              Tier: {storage?.alertLevel || 'Normal'}
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.45rem' }}>
            <span>Allocated Disk Usage ({storage?.usedPercentage ?? 0}%)</span>
            <span>{storage?.formattedTotalAllocated || '0 B'} used of {storage?.formattedQuota || '512 MB'}</span>
          </div>
          <div style={{ height: '12px', width: '100%', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.max(2, storage?.usedPercentage || 0))}%`,
              backgroundColor: getAlertColor(storage?.alertLevel),
              borderRadius: '8px',
              transition: 'width 0.4s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            <span>0 MB</span>
            <span>Normal (&lt;70%)</span>
            <span>Warning (70-84%)</span>
            <span>Critical (85-94%)</span>
            <span>512 MB Quota</span>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Logical Data Size</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{storage?.formattedDataSize || '0 B'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Uncompressed document data</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Storage Size (Allocated)</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{storage?.formattedStorageSize || '0 B'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>WiredTiger blocks on disk</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Index Size</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{storage?.formattedIndexSize || '0 B'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>B-Tree index memory & disk</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Remaining Headroom</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#30d158', marginTop: '0.25rem' }}>{storage?.formattedRemaining || '512 MB'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Available until Atlas quota cap</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Collections</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{storage?.collectionsCount || 0}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>App & GridFS namespaces</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Objects</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{storage?.objectsCount || 0}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Total documents & chunks</div>
          </div>
        </div>

        {/* Clear Storage Discrepancy Explanation Note */}
        <div style={{ padding: '1rem 1.25rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <Info size={16} color="var(--accent-color)" style={{ marginTop: '0.2rem', flexShrink: 0 }} />
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Storage Architecture Note: </strong>
            In MongoDB WiredTiger, <em>Logical Data Size</em> represents raw uncompressed BSON bytes, whereas <em>Storage Size</em> represents actual allocated blocks on disk after compression. MongoDB Atlas measures cluster quota against allocated storage plus index size. Neither metric represents empty cluster headroom.
          </div>
        </div>
      </div>

      {/* 3. Database Collections Explorer */}
      <div className="loop-card" style={{ padding: '2rem', borderRadius: '20px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} />
              <span>Database Collections Explorer ({sortedCollections.length})</span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
              Dynamically discovered database namespaces ranked by storage size and document volume.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search collection..."
                value={collectionSearch}
                onChange={(e) => setCollectionSearch(e.target.value)}
                className="input-field"
                style={{ height: '36px', paddingLeft: '2.2rem', fontSize: '0.82rem', borderRadius: '8px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                onClick={() => {
                  if (collectionSortKey === 'storageSize') setCollectionSortAsc(!collectionSortAsc);
                  else { setCollectionSortKey('storageSize'); setCollectionSortAsc(false); }
                }}
                className={`btn ${collectionSortKey === 'storageSize' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.45rem 0.8rem', fontSize: '0.78rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <ArrowUpDown size={12} />
                <span>By Storage</span>
              </button>

              <button
                onClick={() => {
                  if (collectionSortKey === 'documentCount') setCollectionSortAsc(!collectionSortAsc);
                  else { setCollectionSortKey('documentCount'); setCollectionSortAsc(false); }
                }}
                className={`btn ${collectionSortKey === 'documentCount' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.45rem 0.8rem', fontSize: '0.78rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <ArrowUpDown size={12} />
                <span>By Docs</span>
              </button>
            </div>
          </div>
        </div>

        {/* Collections Table */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Collection Namespace</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Documents</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Logical Data Size</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Allocated Storage</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Index Size</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Avg Doc Size</th>
              </tr>
            </thead>
            <tbody>
              {sortedCollections.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No collections match your filter query.
                  </td>
                </tr>
              ) : (
                sortedCollections.map((c, idx) => {
                  const isTopStorage = idx < 3 && c.storageSize > 0;
                  const isGridFS = c.name.includes('.files') || c.name.includes('.chunks');
                  return (
                    <tr key={c.name} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isTopStorage ? 'rgba(0, 122, 255, 0.02)' : 'transparent' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: isGridFS ? '#ff9500' : 'var(--text-primary)' }}>
                          {isGridFS ? '📦' : '📄'}
                        </span>
                        <span>{c.name}</span>
                        {isTopStorage && (
                          <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(0, 122, 255, 0.12)', color: 'var(--accent-color)', fontWeight: 700 }}>
                            Top Storage
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{(c.documentCount ?? 0).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{c.formattedDataSize}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: isTopStorage ? 700 : 500 }}>{c.formattedStorageSize}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{c.formattedIndexSize}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{c.avgObjSize ? formatBytes(c.avgObjSize) : 'Unavailable'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. GridFS & File Storage Diagnostics */}
      <div className="loop-card" style={{ padding: '2rem', borderRadius: '20px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} />
              <span>GridFS & Large Academic Files Monitoring</span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
              Parallel chunk storage consistency, largest uploaded files, and category distribution.
            </p>
          </div>

          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#30d158', backgroundColor: 'rgba(48, 209, 88, 0.1)', padding: '0.3rem 0.75rem', borderRadius: '20px' }}>
            ✓ Read-Only Diagnostics Active
          </span>
        </div>

        {/* GridFS Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>GridFS Files</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{gridfs?.totalFiles || 0}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Total files stored</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Aggregate Size</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{gridfs?.formattedTotalBytes || '0 B'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Raw file payloads</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>GridFS Chunks</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{gridfs?.totalChunks || 0}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>4MB storage segments</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Orphaned Chunks</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: gridfs?.orphanedChunksCount > 0 ? '#ff9500' : '#30d158', marginTop: '0.25rem' }}>
              {gridfs?.orphanedChunksCount || 0}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Chunks without parent file</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Incomplete Sessions</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: gridfs?.incompleteUploadsCount > 0 ? '#ff9500' : '#30d158', marginTop: '0.25rem' }}>
              {gridfs?.incompleteUploadsCount || 0}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Expired upload sessions</div>
          </div>
        </div>

        {/* Category Breakdown Badges */}
        {gridfs?.categoryBreakdown && Object.keys(gridfs.categoryBreakdown).length > 0 && (
          <div style={{ marginBottom: '1.5rem', padding: '1.25rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              Storage Breakdown by Category
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              {Object.entries(gridfs.categoryBreakdown).map(([cat, info]) => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.85rem', borderRadius: '10px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
                  <span style={{ fontWeight: 600 }}>{cat}:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{info.count} files ({info.formattedBytes})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top 10 Largest Files */}
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Top 10 Largest Uploaded Files
          </h4>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 0.9rem', color: 'var(--text-secondary)' }}>File Name</th>
                  <th style={{ padding: '0.65rem 0.9rem', color: 'var(--text-secondary)' }}>Category</th>
                  <th style={{ padding: '0.65rem 0.9rem', color: 'var(--text-secondary)' }}>Size</th>
                  <th style={{ padding: '0.65rem 0.9rem', color: 'var(--text-secondary)' }}>Upload Date</th>
                  <th style={{ padding: '0.65rem 0.9rem', color: 'var(--text-secondary)' }}>Linked Resource</th>
                </tr>
              </thead>
              <tbody>
                {(!gridfs?.largestFiles || gridfs.largestFiles.length === 0) ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No files currently stored in GridFS bucket.
                    </td>
                  </tr>
                ) : (
                  gridfs.largestFiles.map((file) => (
                    <tr key={file.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.65rem 0.9rem', fontWeight: 600 }}>{file.filename}</td>
                      <td style={{ padding: '0.65rem 0.9rem' }}>
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                          {file.category}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem', fontWeight: 600 }}>{file.formattedSize}</td>
                      <td style={{ padding: '0.65rem 0.9rem', color: 'var(--text-secondary)' }}>
                        {file.uploadDate ? new Date(file.uploadDate).toLocaleDateString() : 'Unavailable'}
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem', color: 'var(--text-secondary)' }}>
                        {file.associatedTitle || 'Resource Document'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. Backend Health & Runtime Monitoring */}
      <div className="loop-card" style={{ padding: '2rem', borderRadius: '20px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={18} />
            <span>Backend Runtime & Memory Health</span>
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
            Process metrics, memory footprint, event-loop lag, and database read/write health checks.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Resident Memory (RSS)</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{backend?.memory?.rss_mb || '0'} MB</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Total process footprint</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>V8 Heap Used</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{backend?.memory?.heapUsed_mb || '0'} MB</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Allocated active objects</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>V8 Heap Total</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{backend?.memory?.heapTotal_mb || '0'} MB</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Current V8 committed pool</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Event Loop Lag</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: (backend?.eventLoopLagMs || 0) < 50 ? '#30d158' : '#ff9500', marginTop: '0.25rem' }}>
              {backend?.eventLoopLagMs !== undefined ? `${backend?.eventLoopLagMs} ms` : 'Unavailable'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Async queue latency</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>DB Read Check</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: backend?.databaseConnection?.readVerified ? '#30d158' : '#ff453a', marginTop: '0.25rem' }}>
              {backend?.databaseConnection?.readVerified ? 'Verified' : 'Failed'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {backend?.databaseConnection?.readDurationMs !== null ? `${backend?.databaseConnection?.readDurationMs}ms latency` : 'Unavailable'}
            </div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Last Write Verification</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem' }}>
              {backend?.databaseConnection?.lastWriteVerifiedAt ? new Date(backend.databaseConnection.lastWriteVerifiedAt).toLocaleTimeString() : 'Pending'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Via safe admin probe</div>
          </div>
        </div>
      </div>

      {/* 6. Application Performance & Telemetry */}
      <div className="loop-card" style={{ padding: '2rem', borderRadius: '20px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} />
            <span>Application Performance & Rate Limiting Telemetry</span>
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
            Sliding-window request metrics, P95 response times, UserAuthCache hit rates, and error rate tracking.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Requests</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{(performance?.totalRequests || 0).toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Since process startup</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Requests / Min</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{performance?.requestsPerMinute || 0} req/m</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Current 60s window</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Avg API Response</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{performance?.avgResponseTimeMs || 0} ms</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Sliding window average</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>P95 Response Time</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>{performance?.p95ResponseTimeMs || 0} ms</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>95th percentile latency</div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Auth Cache Hit Rate</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#30d158', marginTop: '0.25rem' }}>{performance?.cacheStats?.hitRate || '0.0%'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {performance?.cacheStats?.hits || 0} hits / {performance?.cacheStats?.misses || 0} misses
            </div>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rate Limit Throttles</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: (performance?.rateLimitEvents || 0) > 0 ? '#ff9500' : 'var(--text-primary)', marginTop: '0.25rem' }}>
              {performance?.rateLimitEvents || 0}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>429 Too Many Requests</div>
          </div>
        </div>

        {/* Slowest API Endpoints Table */}
        {performance?.slowestEndpoints && performance.slowestEndpoints.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Top Monitored API Routes by Latency
            </h4>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.6rem 0.9rem', color: 'var(--text-secondary)' }}>Route</th>
                    <th style={{ padding: '0.6rem 0.9rem', color: 'var(--text-secondary)' }}>Calls</th>
                    <th style={{ padding: '0.6rem 0.9rem', color: 'var(--text-secondary)' }}>Average Latency</th>
                    <th style={{ padding: '0.6rem 0.9rem', color: 'var(--text-secondary)' }}>Max Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.slowestEndpoints.map((ep, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.6rem 0.9rem', fontWeight: 600 }}><code>{ep.route}</code></td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>{ep.count}</td>
                      <td style={{ padding: '0.6rem 0.9rem', color: ep.avgDurationMs > 200 ? '#ff9500' : 'inherit' }}>{ep.avgDurationMs} ms</td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>{ep.maxDurationMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Sanitized Error Telemetry */}
        {performance?.recentErrors && performance.recentErrors.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Recent Backend HTTP Errors (Sanitized)
            </h4>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.55rem 0.85rem', color: 'var(--text-secondary)' }}>Timestamp</th>
                    <th style={{ padding: '0.55rem 0.85rem', color: 'var(--text-secondary)' }}>Method</th>
                    <th style={{ padding: '0.55rem 0.85rem', color: 'var(--text-secondary)' }}>Path</th>
                    <th style={{ padding: '0.55rem 0.85rem', color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '0.55rem 0.85rem', color: 'var(--text-secondary)' }}>Sanitized Message</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.recentErrors.slice(0, 8).map((err, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.55rem 0.85rem', color: 'var(--text-muted)' }}>{new Date(err.timestamp).toLocaleTimeString()}</td>
                      <td style={{ padding: '0.55rem 0.85rem', fontWeight: 600 }}>{err.method}</td>
                      <td style={{ padding: '0.55rem 0.85rem' }}><code>{err.path}</code></td>
                      <td style={{ padding: '0.55rem 0.85rem', color: '#ff453a', fontWeight: 700 }}>{err.status}</td>
                      <td style={{ padding: '0.55rem 0.85rem' }}>{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 7. College Server Migration Readiness Matrix */}
      <div className="loop-card" style={{ padding: '2rem', borderRadius: '20px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>College Server Migration Readiness</h3>
              <span style={{
                padding: '0.2rem 0.65rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: migrationReadiness?.overallStatus === 'Ready for Migration' ? 'rgba(48, 209, 88, 0.12)' : 'rgba(255, 149, 0, 0.12)',
                color: migrationReadiness?.overallStatus === 'Ready for Migration' ? '#30d158' : '#ff9500'
              }}>
                {migrationReadiness?.overallStatus || 'Ready for Migration'}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              Audit checklist required before transferring LOOP from cloud hosting to SPIT on-premise infrastructure.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setShowMigrationGuide(!showMigrationGuide)}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Terminal size={13} />
              <span>{showMigrationGuide ? 'Hide Migration Steps' : 'View Migration Guide'}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {['all', 'pass', 'warning', 'fail'].map(tab => (
            <button
              key={tab}
              onClick={() => setChecklistFilter(tab)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: checklistFilter === tab ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                color: checklistFilter === tab ? 'var(--accent-inverse)' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                textTransform: 'capitalize'
              }}
            >
              {tab} ({tab === 'all' ? migrationReadiness?.totalChecks || 0 : (migrationReadiness?.[`${tab}Count`] || 0)})
            </button>
          ))}
        </div>

        {/* Checklist Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {filteredChecks.map(check => (
            <div
              key={check.id}
              style={{
                padding: '1.1rem 1.25rem',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.65rem'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{check.title}</span>
                  {getStatusBadge(check.status)}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  {check.description}
                </p>
              </div>

              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                <strong>Diagnostic:</strong> {check.detail}
              </div>
            </div>
          ))}
        </div>

        {/* Practical Step-by-Step College Migration Guide (Collapsible) */}
        {showMigrationGuide && (
          <div style={{ padding: '1.5rem', borderRadius: '14px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={16} />
              <span>Step-by-Step College Server Deployment Guide</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>1. Host Server Requirements:</strong>
                <p style={{ margin: '0.2rem 0' }}>Ubuntu 22.04 LTS / Debian 12, Node.js &gt;= 18.x LTS, MongoDB &gt;= 6.0 with WiredTiger, minimum 2GB RAM & 20GB SSD storage.</p>
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>2. Export Cloud Database to Local Storage:</strong>
                <pre style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.78rem', overflowX: 'auto', border: '1px solid var(--border-color)' }}>
{`# Create complete BSON archive of MongoDB Atlas database
mongodump --uri="\$MONGO_URI" --archive="loop_backup_\$(date +%Y%m%d).archive" --gzip

# Restore archive to on-premise college MongoDB replica set
mongorestore --uri="mongodb://localhost:27017/loop" --archive="loop_backup_*.archive" --gzip`}
                </pre>
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>3. Production Process Management (PM2):</strong>
                <pre style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.78rem', overflowX: 'auto', border: '1px solid var(--border-color)' }}>
{`npm install -g pm2
pm2 start server.js --name "loop-backend" -i max
pm2 startup && pm2 save`}
                </pre>
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>4. Reverse Proxy & SSL Termination (Nginx):</strong>
                <p style={{ margin: '0.2rem 0' }}>Configure Nginx with <code>client_max_body_size 200M;</code>, enable HTTP Range streaming headers for GridFS, and route <code>/api</code> to localhost:5001 with <code>proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;</code>.</p>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
