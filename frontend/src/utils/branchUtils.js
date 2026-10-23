// Shared Branch Utilities for LOOP Placement Portal

// Filter categories in exact specified order: 1. CSE, 2. CE, 3. EXTC
export const BRANCH_FILTER_CATEGORIES = ['CSE', 'CE', 'EXTC'];

/**
 * Maps a story to its high-level sidebar filter category:
 * - CSE: CSE, CSE-DS, CSE-AIML, AI, DS, and IT
 * - CE: CE, COMPS, and MCA
 * - EXTC: EXTC
 */
export function getFilterCategory(story) {
  if (!story) return 'CSE';
  const b = (story.branch || '').trim().toUpperCase();
  const sb = (story.subBranch || '').trim().toUpperCase();

  // 1. CE / COMPS / MCA (MCA maps to CE)
  if (b === 'CE' || b.includes('COMPUTER ENGINEERING') || b.includes('COMPS') || b === 'MCA' || sb === 'MCA') {
    return 'CE';
  }

  // 2. EXTC / Electronics
  if (b === 'EXTC' || b.includes('ELECTRONICS') || b.includes('TELECOMMUNICATION') || b.includes('ETRX')) {
    return 'EXTC';
  }

  // 3. IT, CSE-DS, CSE-AIML, AI, DS, and pure CSE all map to 'CSE' filter category
  if (b === 'IT' || b.includes('INFORMATION TECHNOLOGY')) {
    return 'CSE';
  }

  if (
    b.startsWith('CSE') ||
    b.includes('COMPUTER SCIENCE') ||
    b === 'CS' ||
    ['AI', 'DS', 'AIML'].includes(sb) ||
    b.includes('DATA SCIENCE') ||
    b.includes('MACHINE LEARNING') ||
    b.includes('ARTIFICIAL INTELLIGENCE') ||
    b.includes('AI')
  ) {
    return 'CSE';
  }

  return 'CSE';
}

/**
 * Returns the display badge for story cards and story detail pages:
 * Stored Branch               Display Badge
 * CSE                         CSE
 * CSE-DS / DS                 CSE (DS)
 * CSE-AIML / AI / AIML        CSE (AI/ML)
 * IT                          IT
 * CE                          CE
 * EXTC                        EXTC
 * MCA                         CE
 */
export function formatDisplayBranch(story) {
  if (!story) return 'CSE';
  const b = (story.branch || '').trim().toUpperCase();
  const sb = (story.subBranch || '').trim().toUpperCase();

  // MCA -> CE
  if (b === 'MCA' || sb === 'MCA') {
    return 'CE';
  }

  // IT
  if (b === 'IT' || b.includes('INFORMATION TECHNOLOGY')) {
    return 'IT';
  }

  // EXTC
  if (b === 'EXTC' || b.includes('ELECTRONICS') || b.includes('TELECOMMUNICATION') || b.includes('ETRX')) {
    return 'EXTC';
  }

  // CE
  if (b === 'CE' || b.includes('COMPUTER ENGINEERING') || b.includes('COMPS')) {
    return 'CE';
  }

  // CSE-DS / DS
  if (
    b === 'CSE-DS' ||
    sb === 'DS' ||
    b.includes('DATA SCIENCE') ||
    b.includes('CSE DS') ||
    b.includes('CSE_DS') ||
    b.includes('CSE - DS')
  ) {
    return 'CSE (DS)';
  }

  // CSE-AIML / AI / AIML (handles AIML, AI&ML, AI/ML, Machine Learning, Artificial Intelligence)
  if (
    b === 'CSE-AIML' ||
    ['AI', 'AIML'].includes(sb) ||
    b.includes('AIML') ||
    b.includes('AI&ML') ||
    b.includes('AI/ML') ||
    b.includes('AI & ML') ||
    b.includes('MACHINE LEARNING') ||
    b.includes('ARTIFICIAL INTELLIGENCE') ||
    b.includes('CSE AI') ||
    b.includes('CSE_AIML') ||
    b.includes('CSE - AIML')
  ) {
    return 'CSE (AI/ML)';
  }

  // Core CSE
  if (b === 'CSE' || b.includes('COMPUTER SCIENCE') || b === 'CS') {
    return 'CSE';
  }

  return story.branch || 'CSE';
}

/**
 * Checks if a story matches the selected filter categories.
 */
export function matchesBranchFilter(story, selectedBranches) {
  if (!selectedBranches || selectedBranches.length === 0) return true;
  const category = getFilterCategory(story);
  return selectedBranches.includes(category);
}

// Backwards-compatible helper for legacy imports
export function normalizeBranch(b) {
  if (!b) return 'CSE';
  return getFilterCategory({ branch: b });
}
