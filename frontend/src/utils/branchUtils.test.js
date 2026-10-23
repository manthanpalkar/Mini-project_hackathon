import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BRANCH_FILTER_CATEGORIES,
  getFilterCategory,
  formatDisplayBranch,
  matchesBranchFilter,
  normalizeBranch
} from './branchUtils.js';

test('Branch Filter Categories: Exact order is [CSE, CE, EXTC, MCA]', () => {
  assert.deepEqual(BRANCH_FILTER_CATEGORIES, ['CSE', 'CE', 'EXTC', 'MCA']);
  assert.equal(BRANCH_FILTER_CATEGORIES.length, 4);
  assert.equal(BRANCH_FILTER_CATEGORIES[0], 'CSE');
  assert.equal(BRANCH_FILTER_CATEGORIES[1], 'CE');
  assert.equal(BRANCH_FILTER_CATEGORIES[2], 'EXTC');
  assert.equal(BRANCH_FILTER_CATEGORIES[3], 'MCA');
});

test('Display Labels: Preserves precise display badges independently of filter category', () => {
  // 1. CSE -> CSE
  assert.equal(formatDisplayBranch({ branch: 'CSE' }), 'CSE');
  assert.equal(formatDisplayBranch({ branch: 'Computer Science' }), 'CSE');
  assert.equal(formatDisplayBranch({ branch: 'CS' }), 'CSE');

  // 2. CSE-DS / DS -> CSE (DS)
  assert.equal(formatDisplayBranch({ branch: 'CSE-DS' }), 'CSE (DS)');
  assert.equal(formatDisplayBranch({ branch: 'CSE', subBranch: 'DS' }), 'CSE (DS)');
  assert.equal(formatDisplayBranch({ branch: 'Computer Science', subBranch: 'DS' }), 'CSE (DS)');
  assert.equal(formatDisplayBranch({ branch: 'CSE-DS', subBranch: 'DS' }), 'CSE (DS)');
  assert.equal(formatDisplayBranch({ branch: 'C.S.E Data Science' }), 'CSE (DS)');

  // 3. CSE-AIML / AI / AIML -> CSE (AI/ML)
  assert.equal(formatDisplayBranch({ branch: 'CSE-AIML' }), 'CSE (AI/ML)');
  assert.equal(formatDisplayBranch({ branch: 'CSE', subBranch: 'AI' }), 'CSE (AI/ML)');
  assert.equal(formatDisplayBranch({ branch: 'CSE', subBranch: 'AIML' }), 'CSE (AI/ML)');
  assert.equal(formatDisplayBranch({ branch: 'CSE-AIML', subBranch: 'AI' }), 'CSE (AI/ML)');
  assert.equal(formatDisplayBranch({ branch: 'Computer Science and Engineering (AI&ML)' }), 'CSE (AI/ML)');

  // 4. IT -> IT
  assert.equal(formatDisplayBranch({ branch: 'IT' }), 'IT');
  assert.equal(formatDisplayBranch({ branch: 'Information Technology' }), 'IT');

  // 5. CE -> CE
  assert.equal(formatDisplayBranch({ branch: 'CE' }), 'CE');
  assert.equal(formatDisplayBranch({ branch: 'COMPS' }), 'CE');
  assert.equal(formatDisplayBranch({ branch: 'Computer Engineering' }), 'CE');

  // 6. EXTC -> EXTC
  assert.equal(formatDisplayBranch({ branch: 'EXTC' }), 'EXTC');
  assert.equal(formatDisplayBranch({ branch: 'Electronics and Telecommunication' }), 'EXTC');

  // 7. MCA -> MCA
  assert.equal(formatDisplayBranch({ branch: 'MCA' }), 'MCA');
  assert.equal(formatDisplayBranch({ branch: 'MCA', subBranch: 'MCA' }), 'MCA');
});

test('Filter Mapping: Maps branches to correct high-level filter categories', () => {
  // CSE family maps to CSE
  assert.equal(getFilterCategory({ branch: 'CSE' }), 'CSE');
  assert.equal(getFilterCategory({ branch: 'CSE-DS', subBranch: 'DS' }), 'CSE');
  assert.equal(getFilterCategory({ branch: 'CSE-AIML', subBranch: 'AI' }), 'CSE');
  assert.equal(getFilterCategory({ branch: 'IT' }), 'CSE', 'IT must be included under CSE filter');
  assert.equal(getFilterCategory({ branch: 'Information Technology' }), 'CSE');

  // CE maps to CE
  assert.equal(getFilterCategory({ branch: 'CE' }), 'CE');
  assert.equal(getFilterCategory({ branch: 'COMPS' }), 'CE');
  assert.equal(getFilterCategory({ branch: 'Computer Engineering' }), 'CE');

  // EXTC maps to EXTC
  assert.equal(getFilterCategory({ branch: 'EXTC' }), 'EXTC');
  assert.equal(getFilterCategory({ branch: 'Electronics' }), 'EXTC');

  // MCA must appear ONLY under MCA filter, NEVER under CE
  assert.equal(getFilterCategory({ branch: 'MCA' }), 'MCA');
  assert.notEqual(getFilterCategory({ branch: 'MCA' }), 'CE');
});

test('Filter Result Inclusion: matchesBranchFilter behaves correctly', () => {
  const cseStory = { branch: 'CSE' };
  const dsStory = { branch: 'CSE-DS', subBranch: 'DS' };
  const aimlStory = { branch: 'CSE-AIML', subBranch: 'AI' };
  const itStory = { branch: 'IT' };
  const ceStory = { branch: 'CE' };
  const extcStory = { branch: 'EXTC' };
  const mcaStory = { branch: 'MCA', subBranch: 'MCA' };

  // 1. When only 'CSE' is selected:
  const cseFilter = ['CSE'];
  assert.equal(matchesBranchFilter(cseStory, cseFilter), true);
  assert.equal(matchesBranchFilter(dsStory, cseFilter), true, 'CSE-DS must match CSE filter');
  assert.equal(matchesBranchFilter(aimlStory, cseFilter), true, 'CSE-AIML must match CSE filter');
  assert.equal(matchesBranchFilter(itStory, cseFilter), true, 'IT must match CSE filter');
  assert.equal(matchesBranchFilter(ceStory, cseFilter), false);
  assert.equal(matchesBranchFilter(extcStory, cseFilter), false);
  assert.equal(matchesBranchFilter(mcaStory, cseFilter), false);

  // 2. When only 'CE' is selected:
  const ceFilter = ['CE'];
  assert.equal(matchesBranchFilter(ceStory, ceFilter), true);
  assert.equal(matchesBranchFilter(mcaStory, ceFilter), false, 'MCA must NEVER match CE filter');
  assert.equal(matchesBranchFilter(cseStory, ceFilter), false);
  assert.equal(matchesBranchFilter(itStory, ceFilter), false);
  assert.equal(matchesBranchFilter(extcStory, ceFilter), false);

  // 3. When only 'MCA' is selected:
  const mcaFilter = ['MCA'];
  assert.equal(matchesBranchFilter(mcaStory, mcaFilter), true, 'MCA must match MCA filter');
  assert.equal(matchesBranchFilter(ceStory, mcaFilter), false);
  assert.equal(matchesBranchFilter(cseStory, mcaFilter), false);
  assert.equal(matchesBranchFilter(itStory, mcaFilter), false);
  assert.equal(matchesBranchFilter(extcStory, mcaFilter), false);

  // 4. When only 'EXTC' is selected:
  const extcFilter = ['EXTC'];
  assert.equal(matchesBranchFilter(extcStory, extcFilter), true);
  assert.equal(matchesBranchFilter(cseStory, extcFilter), false);
  assert.equal(matchesBranchFilter(ceStory, extcFilter), false);
  assert.equal(matchesBranchFilter(mcaStory, extcFilter), false);

  // 5. Default all selected:
  assert.equal(matchesBranchFilter(cseStory, BRANCH_FILTER_CATEGORIES), true);
  assert.equal(matchesBranchFilter(dsStory, BRANCH_FILTER_CATEGORIES), true);
  assert.equal(matchesBranchFilter(aimlStory, BRANCH_FILTER_CATEGORIES), true);
  assert.equal(matchesBranchFilter(itStory, BRANCH_FILTER_CATEGORIES), true);
  assert.equal(matchesBranchFilter(ceStory, BRANCH_FILTER_CATEGORIES), true);
  assert.equal(matchesBranchFilter(extcStory, BRANCH_FILTER_CATEGORIES), true);
  assert.equal(matchesBranchFilter(mcaStory, BRANCH_FILTER_CATEGORIES), true);
});

test('Real Candidate Records: Shubham Karampure & Prashant Tiwari', () => {
  const shubham = { id: 'story_2026_26830791', name: 'Shubham Karampure', branch: 'CSE-DS', subBranch: 'DS' };
  const prashant = { id: 'story_2026_10137144', name: 'Prashant Tiwari', branch: 'MCA', subBranch: 'MCA' };

  // Shubham Karampure
  assert.equal(formatDisplayBranch(shubham), 'CSE (DS)');
  assert.equal(getFilterCategory(shubham), 'CSE');
  assert.equal(matchesBranchFilter(shubham, ['CSE']), true);
  assert.equal(matchesBranchFilter(shubham, ['CE']), false);
  assert.equal(matchesBranchFilter(shubham, ['MCA']), false);

  // Prashant Tiwari
  assert.equal(formatDisplayBranch(prashant), 'MCA');
  assert.equal(getFilterCategory(prashant), 'MCA');
  assert.equal(matchesBranchFilter(prashant, ['MCA']), true);
  assert.equal(matchesBranchFilter(prashant, ['CE']), false, 'Prashant must NOT appear under CE filter');
  assert.equal(matchesBranchFilter(prashant, ['CSE']), false);
});

test('Complete Placement Snapshot Verification: 430 Stories', () => {
  const snapshotPath = path.resolve('../backend/reports/live_stories_snapshot.json');
  if (!fs.existsSync(snapshotPath)) return;

  const stories = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  assert.equal(stories.length, 430);

  let cseCount = 0;
  let ceCount = 0;
  let extcCount = 0;
  let mcaCount = 0;

  for (const s of stories) {
    const cat = getFilterCategory(s);
    assert.ok(BRANCH_FILTER_CATEGORIES.includes(cat), `Category '${cat}' for story ${s.id} must be in [CSE, CE, EXTC, MCA]`);
    if (cat === 'CSE') cseCount++;
    else if (cat === 'CE') ceCount++;
    else if (cat === 'EXTC') extcCount++;
    else if (cat === 'MCA') mcaCount++;

    // When all 4 categories are active, every story matches
    assert.equal(matchesBranchFilter(s, BRANCH_FILTER_CATEGORIES), true);
  }

  // Ensure total sum equals exactly 430
  assert.equal(cseCount + ceCount + extcCount + mcaCount, 430);
  assert.ok(cseCount > 0, 'CSE category must have stories');
  assert.ok(ceCount > 0, 'CE category must have stories');
  assert.ok(extcCount > 0, 'EXTC category must have stories');
  assert.ok(mcaCount > 0, 'MCA category must have stories');
});
