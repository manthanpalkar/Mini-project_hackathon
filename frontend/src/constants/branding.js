/**
 * LOOP — Centralized Brand Identity Source of Truth
 * 
 * Copyright (c) 2026 The Lawful Rights Holders
 * Swapnil Patil, The LOOP Student Engineering Team, and Sardar Patel Institute of Technology (SPIT).
 * All Rights Reserved. Proprietary and Confidential.
 * 
 * Official Product Name: LOOP
 * Official Full Form: Limitless Opportunities, One Platform
 * Primary Tagline: Their Journey. Your Opportunity.
 */

export const BRAND = {
  name: 'LOOP',
  fullForm: 'Limitless Opportunities, One Platform',
  tagline: 'Their Journey. Your Opportunity.',
  fullName: 'LOOP — Limitless Opportunities, One Platform',
  shortDescription: 'Connect with seniors and alumni, learn from placement experiences, and discover career opportunities with LOOP.',
  description: 'LOOP connects college juniors, seniors, and alumni by turning shared placement experiences into guidance and opportunities for the next generation.',
  college: 'Sardar Patel Institute of Technology (SPIT), Mumbai',
  collegeShort: 'SPIT Mumbai',
  portalUrl: (typeof process !== 'undefined' && process.env?.VITE_SITE_URL) || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL) || 'https://loop-seven-delta.vercel.app',
  apiBaseUrl: 'https://loop-qnh9.onrender.com'
};

export default BRAND;
