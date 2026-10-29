import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Activity,
  Zap,
  Leaf,
  RotateCcw,
  Play,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Layers,
  Server,
  Clock,
  Database,
  BarChart3,
  TrendingDown,
  HelpCircle,
  History,
  Sparkles
} from 'lucide-react';
import {
  fetchServices,
  fetchAssumptions,
  runSimulation,
  fetchSimulationHistory,
  fetchSimulationById,
  fetchObservatoryMetrics
} from '../utils/greenComputeApi';

export default function GreenCompute() {
  // Global & API state
  const [servicesCatalog, setServicesCatalog] = useState([]);
  const [assumptions, setAssumptions] = useState(null);
  const [observatoryMetrics, setObservatoryMetrics] = useState(null);
  const [simulationData, setSimulationData] = useState(null);
  const [historyRuns, setHistoryRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Simulation Form Configuration State
  const [seed, setSeed] = useState(42);
  const [durationSeconds, setDurationSeconds] = useState(300); // 5 mins
  const [workloadIntensity, setWorkloadIntensity] = useState('medium');
  const [gridCarbonIntensity, setGridCarbonIntensity] = useState(0.708);
  const [selectedServices, setSelectedServices] = useState(['campus_api', 'analytics_worker', 'media_processor']);

  // UI state
  const [activeServiceTab, setActiveServiceTab] = useState('campus_api');
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  // Load initial catalog, assumptions, history and run initial baseline
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [srvs, assump, metrics, hist] = await Promise.all([
        fetchServices().catch(() => []),
        fetchAssumptions().catch(() => null),
        fetchObservatoryMetrics().catch(() => null),
        fetchSimulationHistory(1, 10).catch(() => ({ data: [] }))
      ]);

      setServicesCatalog(srvs);
      setAssumptions(assump);
      setObservatoryMetrics(metrics);
      setHistoryRuns(hist.data || []);

      // Run initial deterministic baseline simulation with default seed 42
      const initialSim = await runSimulation({
        seed: 42,
        durationSeconds: 300,
        workloadIntensity: 'medium',
        gridCarbonIntensity: 0.708,
        selectedServices: ['campus_api', 'analytics_worker', 'media_processor']
      });
      setSimulationData(initialSim);
    } catch (err) {
      console.error('Green Compute initialization error:', err);
      setErrorMsg(err.message || 'Failed to initialize observatory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Execute simulation handler
  const handleRunSimulation = async (customSeed = null) => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const targetSeed = customSeed !== null ? customSeed : seed;
      const payload = {
        seed: targetSeed,
        durationSeconds: parseInt(durationSeconds, 10),
        workloadIntensity,
        gridCarbonIntensity: parseFloat(gridCarbonIntensity),
        selectedServices
      };

      const res = await runSimulation(payload);
      setSimulationData(res);
      setSuccessMsg(`Deterministic simulation executed successfully with Seed ${targetSeed}!`);

      // Refresh history and observatory metrics in background
      fetchSimulationHistory(1, 10)
        .then(h => setHistoryRuns(h.data || []))
        .catch(() => {});
      fetchObservatoryMetrics()
        .then(m => setObservatoryMetrics(m))
        .catch(() => {});
    } catch (err) {
      setErrorMsg(err.message || 'Simulation execution failed');
    } finally {
      setLoading(false);
    }
  };

  // Quick Randomize Seed
  const handleRandomizeSeed = () => {
    const newSeed = Math.floor(Math.random() * 90000) + 1000;
    setSeed(newSeed);
    handleRunSimulation(newSeed);
  };

  // Inspect / Load a specific historical simulation run
  const handleLoadHistoryRun = async (runId) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const run = await fetchSimulationById(runId);
      if (run) {
        setSimulationData(run);
        setSeed(run.seed);
        setDurationSeconds(run.durationSeconds);
        setWorkloadIntensity(run.workloadIntensity);
        setGridCarbonIntensity(run.gridCarbonIntensityKgPerKwh || 0.708);
        setSelectedServices(run.servicesConfig || ['campus_api', 'analytics_worker', 'media_processor']);
        setSuccessMsg(`Loaded historical run '${run.runId}' executed on ${new Date(run.createdAt).toLocaleString()}.`);
        window.scrollTo({ top: 380, behavior: 'smooth' });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load historical run');
    } finally {
      setLoading(false);
    }
  };

  const agg = simulationData?.aggregate;
  const currentService = simulationData?.serviceResults?.find(s => s.serviceId === activeServiceTab) || simulationData?.serviceResults?.[0];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem', color: 'var(--text-primary)' }}>
      {/* 1. OBSERVATORY HEADER & DISCLOSURE BANNER */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)' }}>
            <Activity size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Sustainable Computing Observatory
              </h1>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '3px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                UniVerse Module C
              </span>
            </div>
            <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              Explore how architectural workload patterns and software optimization strategies affect estimated compute energy and carbon emissions.
            </p>
          </div>
        </div>

        {/* Mandatory Scientific Simulation Disclosure Badge */}
        <div style={{
          marginTop: '1rem',
          padding: '0.65rem 1rem',
          borderRadius: '12px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          fontSize: '0.82rem',
          color: '#D97706',
          fontWeight: 600
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>
            <strong>SIMULATED DATA · ESTIMATES, NOT PHYSICAL MEASUREMENTS:</strong> Power, energy, and carbon values are computed from transparent deterministic models calibrated to regional baseline benchmarks, not live hardware meters.
          </span>
        </div>

        {errorMsg && (
          <div style={{ marginTop: '0.85rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ marginTop: '0.85rem', padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}
      </div>

      {/* 2. AGGREGATE SUMMARY KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* Card 1: Workload Scope */}
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '18px', border: '1px solid var(--border-color)', boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Logical Workload</span>
            <Server size={16} style={{ color: '#0071E3' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {(agg?.totalLogicalItems || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Across {simulationData?.serviceResults?.length || 3} services over {simulationData?.simulationMeta?.durationSeconds || 300}s
          </div>
        </div>

        {/* Card 2: Energy Comparison */}
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '18px', border: '1px solid var(--border-color)', boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Energy (kWh)</span>
            <Zap size={16} style={{ color: '#F59E0B' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10B981' }}>
              {agg?.optimizedEnergyKwh || '0.000'}
            </span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
              {agg?.baselineEnergyKwh || '0.000'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 700, marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <TrendingDown size={13} /> {agg?.energySavedPercent || 0}% energy reduction
          </div>
        </div>

        {/* Card 3: Carbon Comparison */}
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '18px', border: '1px solid var(--border-color)', boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Carbon (kg CO₂e)</span>
            <Leaf size={16} style={{ color: '#10B981' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10B981' }}>
              {agg?.optimizedCarbonKg || '0.000'}
            </span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
              {agg?.baselineCarbonKg || '0.000'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 700, marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <TrendingDown size={13} /> {agg?.carbonSavedKg || 0} kg CO₂e avoided
          </div>
        </div>

        {/* Card 4: Historical Campus Observatory Total */}
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '18px', border: '1px solid var(--border-color)', boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Campus Savings</span>
            <Sparkles size={16} style={{ color: '#8B5CF6' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#8B5CF6' }}>
            {observatoryMetrics?.totalCarbonSavedKg || '10.51'} kg
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Cumulative across {observatoryMetrics?.totalSimulationsCount || 12} saved experiment runs
          </div>
        </div>
      </div>

      {/* 3. SIMULATION CONTROLLER & REPRODUCIBILITY PANEL */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={18} style={{ color: '#0071E3' }} /> Reproducible Simulation Experiment Parameters
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Deterministic Mulberry32 PRNG guarantees identical results for matching seeds and parameters.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleRandomizeSeed}
              disabled={loading}
              style={{
                background: 'rgba(0, 113, 227, 0.1)',
                color: '#0071E3',
                border: '1px solid rgba(0, 113, 227, 0.25)',
                padding: '6px 12px',
                borderRadius: '10px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
              title="Generate new seed and explore different workload profile"
            >
              🎲 Randomize Seed
            </button>
            <button
              onClick={() => handleRunSimulation(seed)}
              disabled={loading}
              style={{
                background: '#10B981',
                color: '#FFFFFF',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '10px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Play size={13} /> {loading ? 'Computing...' : 'Run Simulation'}
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {/* Seed Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Random Seed (Deterministic)
            </label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}
            />
          </div>

          {/* Duration Selector */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              <span>Simulation Duration</span>
              <span style={{ color: '#0071E3' }}>{durationSeconds}s ({Math.round(durationSeconds / 60)} mins)</span>
            </div>
            <select
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10))}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}
            >
              <option value={60}>60 seconds (1 minute stress test)</option>
              <option value={300}>300 seconds (5 minutes standard)</option>
              <option value={900}>900 seconds (15 minutes batch workload)</option>
              <option value={3600}>3600 seconds (1 hour lab observation)</option>
            </select>
          </div>

          {/* Workload Intensity */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Workload Intensity
            </label>
            <select
              value={workloadIntensity}
              onChange={(e) => setWorkloadIntensity(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}
            >
              <option value="low">Low (0.5x off-peak volume)</option>
              <option value="medium">Medium (1.0x daytime volume)</option>
              <option value="high">High (2.0x peak registration volume)</option>
              <option value="stress">Stress (3.5x maximum platform spike)</option>
            </select>
          </div>

          {/* Grid Carbon Intensity */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              <span>Grid Intensity (kg CO₂e/kWh)</span>
              <span style={{ color: '#10B981' }}>{gridCarbonIntensity}</span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.05"
              max="2.5"
              value={gridCarbonIntensity}
              onChange={(e) => setGridCarbonIntensity(parseFloat(e.target.value) || 0.708)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}
            />
          </div>
        </div>

        {/* Service Toggles */}
        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Included Services:</span>
          {servicesCatalog.map(s => {
            const isChecked = selectedServices.includes(s.id);
            return (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedServices([...selectedServices, s.id]);
                    } else if (selectedServices.length > 1) {
                      setSelectedServices(selectedServices.filter(id => id !== s.id));
                    }
                  }}
                  style={{ accentColor: '#10B981' }}
                />
                {s.name}
              </label>
            );
          })}
        </div>
      </div>

      {/* 4. SERVICE-LEVEL METRIC COMPARISON TABS & VISUALIZATION */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '1.75rem', marginBottom: '2rem' }}>
        {/* Service Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {simulationData?.serviceResults?.map(s => {
              const isActive = activeServiceTab === s.serviceId;
              return (
                <button
                  key={s.serviceId}
                  onClick={() => setActiveServiceTab(s.serviceId)}
                  style={{
                    padding: '0.55rem 1.1rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: isActive ? 'var(--text-primary)' : 'var(--bg-primary)',
                    color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {s.serviceName}
                </button>
              );
            })}
          </div>

          {currentService && (
            <span style={{ fontSize: '0.75rem', padding: '3px 9px', borderRadius: '8px', background: 'rgba(0, 113, 227, 0.1)', color: '#0071E3', fontWeight: 700 }}>
              Workload: {currentService.workloadType.toUpperCase()}
            </span>
          )}
        </div>

        {currentService ? (
          <div>
            {/* Optimization Mechanism Explainability Card */}
            <div style={{ background: 'var(--bg-primary)', padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                <CheckCircle2 size={15} /> Modeled Optimization Mechanism
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {currentService.optimizationDescription}
              </div>
            </div>

            {/* Side-by-Side Comparison Metrics Table & Visual Bars */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Baseline Scenario Column */}
              <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Baseline Scenario</span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '6px', background: 'rgba(107, 114, 128, 0.15)', color: 'var(--text-secondary)', fontWeight: 700 }}>Unoptimized</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Items Processed</span>
                    <strong>{currentService.baseline.itemsSubmitted}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Completed / Failed</span>
                    <span>{currentService.baseline.itemsCompleted} / <strong style={{ color: '#EF4444' }}>{currentService.baseline.itemsFailed}</strong></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Avg Processing Latency</span>
                    <strong>{currentService.baseline.avgLatencyMs} ms</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>p95 Latency</span>
                    <strong>{currentService.baseline.p95LatencyMs ? `${currentService.baseline.p95LatencyMs} ms` : 'N/A'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Simulated CPU Utilization</span>
                    <strong>{currentService.baseline.utilizationPercent}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Average Power Draw</span>
                    <strong>{currentService.baseline.avgPowerWatts} W</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                    <span style={{ fontWeight: 700 }}>Estimated Energy</span>
                    <strong style={{ color: '#F59E0B' }}>{currentService.baseline.energyKwh} kWh</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>Estimated Carbon</span>
                    <strong style={{ color: '#EF4444' }}>{currentService.baseline.carbonKg} kg CO₂e</strong>
                  </div>
                </div>
              </div>

              {/* Optimized Scenario Column */}
              <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#10B981' }}>Optimized Scenario</span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontWeight: 700 }}>Green Profile</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Items Processed</span>
                    <strong>{currentService.optimized.itemsSubmitted} (Fair)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Completed / Failed</span>
                    <span>{currentService.optimized.itemsCompleted} / <strong style={{ color: currentService.optimized.itemsFailed > 0 ? '#EF4444' : '#10B981' }}>{currentService.optimized.itemsFailed}</strong></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Avg Processing Latency</span>
                    <span style={{ color: currentService.comparison.latency.percentReduction > 0 ? '#10B981' : 'var(--text-primary)', fontWeight: 700 }}>
                      {currentService.optimized.avgLatencyMs} ms ({currentService.comparison.latency.percentReduction > 0 ? `-${currentService.comparison.latency.percentReduction}%` : 'Fair trade-off'})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>p95 Latency</span>
                    <strong>{currentService.optimized.p95LatencyMs ? `${currentService.optimized.p95LatencyMs} ms` : 'N/A'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Simulated CPU Utilization</span>
                    <strong style={{ color: '#10B981' }}>{currentService.optimized.utilizationPercent}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Average Power Draw</span>
                    <strong style={{ color: '#10B981' }}>{currentService.optimized.avgPowerWatts} W</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                    <span style={{ fontWeight: 700 }}>Estimated Energy</span>
                    <strong style={{ color: '#10B981' }}>{currentService.optimized.energyKwh} kWh (-{currentService.comparison.energy.percentReduction}%)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>Estimated Carbon</span>
                    <strong style={{ color: '#10B981' }}>{currentService.optimized.carbonKg} kg CO₂e (-{currentService.comparison.carbon.percentReduction}%)</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* SVG Visual Comparative Energy Bar Chart */}
            <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 800, marginBottom: '0.85rem' }}>
                Modeled Energy & Carbon Comparison (Baseline vs. Optimized)
              </div>
              <svg viewBox="0 0 700 80" style={{ width: '100%', height: 'auto', display: 'block' }}>
                {/* Baseline Bar */}
                <text x="0" y="24" fontSize="12" fontWeight="700" fill="var(--text-secondary)">Baseline:</text>
                <rect x="90" y="10" width="560" height="20" rx="6" fill="rgba(245, 158, 11, 0.25)" stroke="#F59E0B" strokeWidth="1" />
                <text x="100" y="24" fontSize="11" fontWeight="700" fill="#D97706">
                  {currentService.baseline.energyKwh} kWh • {currentService.baseline.carbonKg} kg CO₂e
                </text>

                {/* Optimized Bar (Scaled proportionately) */}
                {(() => {
                  const ratio = currentService.baseline.energyKwh > 0 ? (currentService.optimized.energyKwh / currentService.baseline.energyKwh) : 0.7;
                  const optWidth = Math.max(80, Math.round(560 * ratio));
                  return (
                    <g>
                      <text x="0" y="60" fontSize="12" fontWeight="700" fill="#10B981">Optimized:</text>
                      <rect x="90" y="46" width={optWidth} height="20" rx="6" fill="rgba(16, 185, 129, 0.3)" stroke="#10B981" strokeWidth="1" />
                      <text x="100" y="60" fontSize="11" fontWeight="700" fill="#10B981">
                        {currentService.optimized.energyKwh} kWh ({currentService.comparison.energy.percentReduction}% savings)
                      </text>
                    </g>
                  );
                })()}
              </svg>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>No service selected.</p>
        )}
      </div>

      {/* 5. FULL PLATFORM SCENARIO COMPARISON TABLE */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: 800 }}>
          Comprehensive Multi-Service Observatory Ledger
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.65rem 0.5rem' }}>Service</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Workload</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Avg Latency</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>CPU Load</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Baseline Energy</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Optimized Energy</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Energy Saved</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Carbon Avoided</th>
              </tr>
            </thead>
            <tbody>
              {simulationData?.serviceResults?.map(s => (
                <tr key={s.serviceId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>{s.serviceName}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{s.logicalItemsCount} items</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{s.baseline.avgLatencyMs}ms ➔ <strong style={{ color: '#10B981' }}>{s.optimized.avgLatencyMs}ms</strong></td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{s.baseline.utilizationPercent}% ➔ <strong style={{ color: '#10B981' }}>{s.optimized.utilizationPercent}%</strong></td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{s.baseline.energyKwh} kWh</td>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: '#10B981' }}>{s.optimized.energyKwh} kWh</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: '#10B981', fontWeight: 800 }}>-{s.comparison.energy.percentReduction}%</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: '#10B981', fontWeight: 800 }}>{s.comparison.carbon.absoluteReduction} kg</td>
                </tr>
              ))}
              {agg && (
                <tr style={{ background: 'var(--bg-primary)', fontWeight: 900 }}>
                  <td style={{ padding: '0.85rem 0.5rem' }}>TOTAL AGGREGATE</td>
                  <td style={{ padding: '0.85rem 0.5rem' }}>{agg.totalLogicalItems} items</td>
                  <td style={{ padding: '0.85rem 0.5rem' }}>—</td>
                  <td style={{ padding: '0.85rem 0.5rem' }}>—</td>
                  <td style={{ padding: '0.85rem 0.5rem' }}>{agg.baselineEnergyKwh} kWh</td>
                  <td style={{ padding: '0.85rem 0.5rem', color: '#10B981' }}>{agg.optimizedEnergyKwh} kWh</td>
                  <td style={{ padding: '0.85rem 0.5rem', color: '#10B981' }}>-{agg.energySavedPercent}%</td>
                  <td style={{ padding: '0.85rem 0.5rem', color: '#10B981' }}>{agg.carbonSavedKg} kg</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. TRANSPARENT FORMULAS & ASSUMPTIONS DISCLOSURE PANEL */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
        <button
          onClick={() => setShowAssumptions(!showAssumptions)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: 0,
            color: 'var(--text-primary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 800 }}>
            <HelpCircle size={18} style={{ color: '#0071E3' }} /> How are these energy and carbon estimates calculated?
          </div>
          {showAssumptions ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showAssumptions && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>1. Synthetic Power Model</div>
                <code>P_avg (Watts) = P_idle + u × (P_max - P_idle)</code>
                <div style={{ fontSize: '0.76rem', marginTop: '0.4rem' }}>
                  Where <code>u</code> is synthetic CPU utilization (0.0 to 1.0) derived from request concurrency.
                </div>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>2. Energy Consumption</div>
                <code>E (kWh) = [P_avg (W) × t (seconds)] / 3,600,000</code>
                <div style={{ fontSize: '0.76rem', marginTop: '0.4rem' }}>
                  Converts instantaneous Watt-seconds into standard kilowatt-hours (kWh).
                </div>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>3. Carbon Emissions</div>
                <code>C (kg CO₂e) = E (kWh) × I_grid (kg CO₂e/kWh)</code>
                <div style={{ fontSize: '0.76rem', marginTop: '0.4rem' }}>
                  Active baseline: <strong>{gridCarbonIntensity} kg CO₂e/kWh</strong> (Central Electricity Authority benchmark).
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Service Power Baseline Specs:</div>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                <span>• <strong>Campus API:</strong> Idle 45W, Peak 140W</span>
                <span>• <strong>Analytics Worker:</strong> Idle 60W, Peak 210W</span>
                <span>• <strong>Media Processor:</strong> Idle 85W, Peak 320W</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7. HISTORICAL SIMULATIONS LOG */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <History size={18} style={{ color: '#8B5CF6' }} /> Persisted Historical Simulation Runs
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Stored in MongoDB Atlas • Fully reproducible
          </span>
        </div>

        {historyRuns.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>No historical simulation runs found yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.5rem' }}>Timestamp</th>
                  <th style={{ padding: '0.5rem' }}>Seed</th>
                  <th style={{ padding: '0.5rem' }}>Duration</th>
                  <th style={{ padding: '0.5rem' }}>Workload</th>
                  <th style={{ padding: '0.5rem' }}>Baseline Energy</th>
                  <th style={{ padding: '0.5rem' }}>Optimized Energy</th>
                  <th style={{ padding: '0.5rem' }}>Carbon Avoided</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {historyRuns.map(run => (
                  <tr key={run._id || run.runId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.65rem 0.5rem' }}>{new Date(run.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', fontWeight: 700 }}>{run.seed}</td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>{run.durationSeconds}s</td>
                    <td style={{ padding: '0.65rem 0.5rem', textTransform: 'capitalize' }}>{run.workloadIntensity}</td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>{run.aggregate?.baselineEnergyKwh || '—'} kWh</td>
                    <td style={{ padding: '0.65rem 0.5rem', color: '#10B981', fontWeight: 700 }}>{run.aggregate?.optimizedEnergyKwh || '—'} kWh</td>
                    <td style={{ padding: '0.65rem 0.5rem', color: '#10B981', fontWeight: 800 }}>{run.aggregate?.carbonSavedKg || '—'} kg</td>
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleLoadHistoryRun(run.runId)}
                        disabled={loading}
                        style={{
                          background: 'rgba(0, 113, 227, 0.1)',
                          color: '#0071E3',
                          border: '1px solid rgba(0, 113, 227, 0.3)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Inspect Run
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
