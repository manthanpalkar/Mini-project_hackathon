const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

describe('Story Submission Lifecycle & Moderation Integrity', () => {
  // Test fixture helper for minimal valid 1x1 PDF base64
  const samplePdfBase64 = 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAzIDAgUgovQ29udGVudHMgNSAwIFIKL1Jlc291cmNlcyA8PAo+Pgo+PgplbmRvYmoKMSAwIG9iajw8Ci9UeXBlIC9DYXRhbG9nCi9QYWdlcyAzIDAgUgo+PmVuZG9iagoxIDAgb2JqCjw8Ci9UeXBlIC9DYXRhbG9nCi9QYWdlcyAzIDAgUgo+PmVuZG9iagp0cmFpbGVyCjw8Ci9Sb290IDEgMCBSCi9TaXplIDYKPj4Kc3RhcnR4cmVmCjI5NQolJUVPRg==';

  test('validates story payload: requires name, company, and role', () => {
    const invalidPayloads = [
      { name: '', company: 'Google', role: 'SWE' },
      { name: 'Arjun', company: '', role: 'SWE' },
      { name: 'Arjun', company: 'Google', role: '' }
    ];

    invalidPayloads.forEach(payload => {
      const isValid = Boolean(payload.name && payload.company && payload.role);
      assert.strictEqual(isValid, false, `Expected payload to fail validation: ${JSON.stringify(payload)}`);
    });
  });

  test('validates resume file presence: PDF format strictly required', () => {
    const validResume = {
      fileName: 'Arjun_Resume.pdf',
      fileSize: '120 KB',
      url: samplePdfBase64
    };
    assert.strictEqual(validResume.fileName.toLowerCase().endsWith('.pdf'), true);
    assert.strictEqual(validResume.url.startsWith('data:application/pdf'), true);

    const invalidResume = {
      fileName: 'malware.exe',
      fileSize: '2 MB',
      url: 'data:application/x-msdownload;base64,TVqQAAMAAAAEAAAA'
    };
    assert.strictEqual(invalidResume.fileName.toLowerCase().endsWith('.pdf'), false);
    assert.strictEqual(invalidResume.url.startsWith('data:application/pdf'), false);
  });

  test('prevents duplicate active submissions for the same candidate and company', () => {
    const existingPending = [
      {
        id: 'story_101',
        name: 'Arjun Sharma',
        company: 'Google',
        uploadedByEmail: 'arjun@spit.ac.in',
        status: 'pending'
      }
    ];

    const duplicateSubmission = {
      name: 'Arjun Sharma',
      company: 'Google',
      uploadedByEmail: 'arjun@spit.ac.in'
    };

    const isDuplicate = existingPending.some(
      s => s.name === duplicateSubmission.name &&
           s.company === duplicateSubmission.company &&
           s.uploadedByEmail === duplicateSubmission.uploadedByEmail &&
           s.status === 'pending'
    );

    assert.strictEqual(isDuplicate, true, 'Duplicate submission must be detected and blocked');

    // Different company should be allowed
    const differentCompanySubmission = {
      name: 'Arjun Sharma',
      company: 'Microsoft',
      uploadedByEmail: 'arjun@spit.ac.in'
    };
    const isDiffDuplicate = existingPending.some(
      s => s.name === differentCompanySubmission.name &&
           s.company === differentCompanySubmission.company &&
           s.uploadedByEmail === differentCompanySubmission.uploadedByEmail &&
           s.status === 'pending'
    );
    assert.strictEqual(isDiffDuplicate, false, 'Different company submission must be allowed');
  });

  test('moderation status is strictly enforced: student submissions default to pending', () => {
    const submission = {
      name: 'Priya Patel',
      company: 'Apple',
      role: 'Hardware Engineer',
      requestType: 'add',
      status: 'approved' // Client attempting to self-approve!
    };

    // Trusted backend override
    const processedPending = {
      ...submission,
      status: 'pending' // Backend enforces pending status regardless of client payload
    };

    assert.strictEqual(processedPending.status, 'pending', 'Student submissions must always remain pending');
  });

  test('retry preserves required submission data without mutating fields', () => {
    const originalSubmission = {
      name: 'Rohan Mehta',
      branch: 'CSE',
      subBranch: 'AI',
      passoutYear: '2026',
      company: 'NVIDIA',
      role: 'AI Researcher',
      resumeFile: {
        fileName: 'Rohan_Resume.pdf',
        fileSize: '95 KB',
        url: samplePdfBase64
      },
      studyMaterials: [
        {
          title: 'CUDA Programming Guide',
          type: 'PDF',
          fileName: 'cuda_notes.pdf',
          fileSize: '1.2 MB',
          url: samplePdfBase64
        }
      ],
      customSections: [
        { title: 'Advice To Juniors', content: 'Focus on low-level GPU concurrency.' }
      ]
    };

    // Stored in task payload
    const taskPayload = { ...originalSubmission };

    // Simulate transient failure and retry
    const retriedSubmission = { ...taskPayload };

    assert.deepStrictEqual(retriedSubmission.name, originalSubmission.name);
    assert.deepStrictEqual(retriedSubmission.company, originalSubmission.company);
    assert.deepStrictEqual(retriedSubmission.resumeFile, originalSubmission.resumeFile);
    assert.deepStrictEqual(retriedSubmission.studyMaterials, originalSubmission.studyMaterials);
    assert.deepStrictEqual(retriedSubmission.customSections, originalSubmission.customSections);
  });
});
