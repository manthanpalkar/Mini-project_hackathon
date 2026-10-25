const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-super-secret-key-32-chars-minimum-loop-platform!';

const { app, JWT_SECRET } = require('../server');
const { User, Story, Resource, Achievement, Folder, SystemSetting } = require('../models');

test.describe('Login-Required Platform Architecture & Access Control Tests', () => {
  let server;
  let baseUrl;
  let originalReadyState;
  let originalUserFindOne;
  let originalUserFind;
  let originalStoryFind;
  let originalStoryFindOne;
  let originalResourceFind;
  let originalResourceFindOne;
  let originalFolderFind;
  let originalFolderFindOne;
  let originalAchievementFind;
  let originalSettingFindOne;

  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    email: 'admin@spit.ac.in',
    name: 'College Admin',
    role: 'Administrator',
    status: 'Active',
    onboarded: true,
    isAdmin: true
  };

  const studentUser = {
    _id: new mongoose.Types.ObjectId(),
    email: 'student@spit.ac.in',
    name: 'Active Student',
    branch: 'CSE',
    role: 'Student',
    status: 'Active',
    onboarded: true,
    isAdmin: false
  };

  const unonboardedUser = {
    _id: new mongoose.Types.ObjectId(),
    email: 'newbie@spit.ac.in',
    name: '',
    branch: '',
    role: 'Student',
    status: 'Active',
    onboarded: false,
    isAdmin: false
  };

  const adminToken = jwt.sign(
    { email: adminUser.email, role: adminUser.role, status: adminUser.status, id: adminUser._id.toString() },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const studentToken = jwt.sign(
    { email: studentUser.email, role: studentUser.role, status: studentUser.status, id: studentUser._id.toString() },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const unonboardedToken = jwt.sign(
    { email: unonboardedUser.email, role: unonboardedUser.role, status: unonboardedUser.status, id: unonboardedUser._id.toString() },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  function createMockQuery(data) {
    const q = {
      sort: () => q,
      select: () => q,
      skip: () => q,
      limit: () => q,
      lean: async () => data
    };
    return q;
  }

  test.before(async () => {
    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    originalUserFindOne = User.findOne;
    User.findOne = async function(query) {
      if (!query || !query.email) return null;
      const em = query.email instanceof RegExp
        ? [adminUser.email, studentUser.email, unonboardedUser.email].find(e => query.email.test(e))
        : String(query.email);

      if (em === adminUser.email) return adminUser;
      if (em === studentUser.email) return studentUser;
      if (em === unonboardedUser.email) return unonboardedUser;
      return null;
    };

    originalUserFind = User.find;
    User.find = () => createMockQuery([adminUser, studentUser]);

    originalStoryFind = Story.find;
    Story.find = () => createMockQuery([{ id: 'story-1', title: 'Barclays Journey', company: 'Barclays', status: 'approved', createdAt: new Date() }]);

    originalStoryFindOne = Story.findOne;
    Story.findOne = () => ({ lean: async () => ({ id: 'story-1', title: 'Barclays Journey', company: 'Barclays', status: 'approved' }) });

    originalResourceFind = Resource.find;
    Resource.find = () => createMockQuery([{ id: 'res-1', title: 'DSA Notes', type: 'PDF', status: 'approved', folderId: 'folder-1', createdAt: new Date() }]);

    originalResourceFindOne = Resource.findOne;
    Resource.findOne = () => ({ lean: async () => ({ id: 'res-1', title: 'DSA Notes', type: 'PDF', status: 'approved', folderId: 'folder-1' }) });

    originalFolderFind = Folder.find;
    Folder.find = () => createMockQuery([{ id: 'folder-1', name: 'Semester 5', folderType: 'system', visibility: 'public' }]);

    originalFolderFindOne = Folder.findOne;
    Folder.findOne = () => ({ lean: async () => ({ id: 'folder-1', name: 'Semester 5', folderType: 'system', visibility: 'public' }) });

    originalAchievementFind = Achievement.find;
    Achievement.find = () => createMockQuery([{ id: 'ach-1', title: 'Smart India Hackathon Winners', date: '2026-03-15' }]);

    originalSettingFindOne = SystemSetting.findOne;
    SystemSetting.findOne = () => ({
      lean: async () => ({
        key: 'section_visibility',
        value: { stories: true, resources: true, achievements: true }
      })
    });

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  test.after(async () => {
    Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState });
    User.findOne = originalUserFindOne;
    User.find = originalUserFind;
    Story.find = originalStoryFind;
    Story.findOne = originalStoryFindOne;
    Resource.find = originalResourceFind;
    Resource.findOne = originalResourceFindOne;
    Folder.find = originalFolderFind;
    Folder.findOne = originalFolderFindOne;
    Achievement.find = originalAchievementFind;
    SystemSetting.findOne = originalSettingFindOne;
    await new Promise((resolve) => server.close(resolve));
  });

  test('1. Unauthenticated request to /api/stories is strictly rejected with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/stories`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, 'TOKEN_MISSING');
  });

  test('2. Unauthenticated request to /api/stories/:id is strictly rejected with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/stories/story-1`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, 'TOKEN_MISSING');
  });

  test('3. Unauthenticated request to /api/resources is strictly rejected with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/resources`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, 'TOKEN_MISSING');
  });

  test('4. Unauthenticated request to /api/resources/:id is strictly rejected with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/resources/res-1`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, 'TOKEN_MISSING');
  });

  test('5. Unauthenticated request to /api/folders is strictly rejected with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/folders`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, 'TOKEN_MISSING');
  });

  test('6. Unauthenticated request to /api/achievements is strictly rejected with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/achievements`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, 'TOKEN_MISSING');
  });

  test('7. Public endpoints continue to be accessible without authentication', async () => {
    const rootRes = await fetch(`${baseUrl}/`);
    assert.equal(rootRes.status, 200);

    const visRes = await fetch(`${baseUrl}/api/settings/visibility`);
    assert.equal(visRes.status, 200);

    const storageLimitsRes = await fetch(`${baseUrl}/api/storage/limits`);
    assert.equal(storageLimitsRes.status, 200);
  });

  test('8. Authenticated onboarded student accesses protected endpoints with HTTP 200', async () => {
    const storiesRes = await fetch(`${baseUrl}/api/stories`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert.equal(storiesRes.status, 200);

    const resourcesRes = await fetch(`${baseUrl}/api/resources`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert.equal(resourcesRes.status, 200);

    const foldersRes = await fetch(`${baseUrl}/api/folders`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert.equal(foldersRes.status, 200);

    const achievementsRes = await fetch(`${baseUrl}/api/achievements`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert.equal(achievementsRes.status, 200);
  });

  test('9. Authenticated student is rejected from administrative endpoints with HTTP 403', async () => {
    const adminUsersRes = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert.equal(adminUsersRes.status, 403);

    const adminVisRes = await fetch(`${baseUrl}/api/admin/settings/visibility`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ stories: false })
    });
    assert.equal(adminVisRes.status, 403);
  });

  test('10. Campus Administrator has full access to all protected and administrative endpoints', async () => {
    const storiesRes = await fetch(`${baseUrl}/api/stories`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(storiesRes.status, 200);

    const usersRes = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(usersRes.status, 200);
  });

  test('11. Unonboarded student is rejected from content endpoints with HTTP 403 ONBOARDING_REQUIRED', async () => {
    const storiesRes = await fetch(`${baseUrl}/api/stories`, {
      headers: { 'Authorization': `Bearer ${unonboardedToken}` }
    });
    assert.equal(storiesRes.status, 403);
    const data = await storiesRes.json();
    assert.equal(data.code, 'ONBOARDING_REQUIRED');
  });
});
