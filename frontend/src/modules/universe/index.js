import React from 'react';

/**
 * UniVerse Platform Modules Registry
 * Prepares the frontend for Modules B, C, D, and E alongside Module A (LOOP Placement Intelligence)
 */

export const UNIVERSE_MODULES = [
  {
    id: 'module-a',
    title: 'Placement Intelligence & Academic Vault',
    code: 'Module A',
    status: 'Active (LOOP Core)',
    route: '/stories',
    description: 'Verified 4-year senior roadmaps, interview debriefs, and MongoDB GridFS study material vault.'
  },
  {
    id: 'module-b',
    title: 'Smart Campus Ride-Pooling',
    code: 'Module B',
    status: 'Active',
    route: '/campus-rides',
    apiEndpoint: '/api/modules/b',
    description: 'Graph-based campus mobility, peer ride-matching with constrained detour insertion, and carbon savings analytics.'
  },
  {
    id: 'module-c',
    title: 'Sustainable Computing Observatory',
    code: 'Module C',
    status: 'Active',
    route: '/green-compute',
    apiEndpoint: '/api/modules/c',
    description: 'Reproducible workload telemetry simulation, baseline vs. optimized carbon reduction modeling, and lab cluster energy observatory.'
  },
  {
    id: 'module-d',
    title: 'Privacy-Aware Digital Wellbeing',
    code: 'Module D',
    status: 'Ready for Implementation',
    apiEndpoint: '/api/modules/d',
    description: 'Differential-privacy focus tracking, study session logging, and non-intrusive mindful rest nudges.'
  },
  {
    id: 'module-e',
    title: 'Responsible Examination Monitoring',
    code: 'Module E',
    status: 'Ready for Implementation',
    apiEndpoint: '/api/modules/e',
    description: 'Ethical proctor telemetry, tamper-evident exam session logs, and transparent student dispute resolution.'
  }
];

export default UNIVERSE_MODULES;
