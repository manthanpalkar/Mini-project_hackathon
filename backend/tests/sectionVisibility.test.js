const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-super-secret-key-32-chars-minimum-loop-platform!';

const { app, JWT_SECRET, getSectionVisibility, DEFAULT_SECTION_VISIBILITY } = require('../server');
const { User, Story, Resource, Achievement, Folder, SystemSetting, ActivityLog } = require('../models');
const cacheService = require('../services/cacheService');

test.describe('Global Public Section Visibility Controls Test Suite', () => {
  let server;
  let baseUrl;
  let originalReadyState;
  let originalUserFindOne;
  let originalStoryFind;
  let originalStoryFindOne;
  let originalStoryCount;
  let originalResourceFind;
  let originalResourceFindOne;
  let originalFolderFindOne;
  let originalAchievementFind;
  let originalSettingFindOne;
  let originalSettingFindOneAndUpdate;
  let originalActivityLogCreate;

  let inMemorySetting = null; // null represents new installation / no setting in DB
  let loggedActivities = [];

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
    role: 'Student',
    status: 'Active',
    onboarded: true,
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
        ? [adminUser.email, studentUser.email].find(e => query.email.test(e))
        : String(query.email);

      if (em === adminUser.email) return adminUser;
      if (em === studentUser.email) return studentUser;
      return null;
    };

    originalStoryFind = Story.find;
    Story.find = function() {
      const sample = [
        { id: 'story-1', title: 'Barclays Journey', company: 'Barclays', status: 'approved', createdAt: new Date() }
      ];
      return {
        sort: () => ({
          select: () => ({
            lean: async () => sample
          })
        }),
        select: () => ({
          lean: async () => sample
        })
      };
    };

    originalStoryFindOne = Story.findOne;
    Story.findOne = function(query) {
      return {
        lean: async () => ({
          id: 'story-1',
          title: 'Barclays Journey',
          company: 'Barclays',
          status: 'approved',
          journey: { howSecured: 'Hard work and practice' }
        })
      };
    };

    originalStoryCount = Story.countDocuments;
    Story.countDocuments = async () => 1;

    originalResourceFind = Resource.find;
    Resource.find = function() {
      const sample = [
        { id: 'res-1', title: 'DSA Notes', type: 'PDF', status: 'approved', folderId: 'folder-1', createdAt: new Date() }
      ];
      const queryObj = {
        select: () => queryObj,
        sort: () => queryObj,
        skip: () => queryObj,
        limit: () => queryObj,
        lean: async () => sample
      };
      return queryObj;
    };

    originalResourceFindOne = Resource.findOne;
    Resource.findOne = function() {
      return {
        lean: async () => ({
          id: 'res-1',
          title: 'DSA Notes',
          type: 'PDF',
          status: 'approved',
          folderId: 'folder-1'
        })
      };
    };

    originalFolderFindOne = Folder.findOne;
    Folder.findOne = function() {
      return {
        lean: async () => ({
          id: 'folder-1',
          title: 'General',
          visibility: 'public'
        })
      };
    };

    originalAchievementFind = Achievement.find;
    Achievement.find = function() {
      const sample = [
        { id: 'ach-1', title: 'Smart India Hackathon Winner', date: '2026-01-15', createdAt: new Date() }
      ];
      return {
        sort: () => ({
          lean: async () => sample
        }),
        select: () => ({
          lean: async () => sample
        })
      };
    };

    originalSettingFindOne = SystemSetting.findOne;
    SystemSetting.findOne = function(query) {
      return {
        lean: async () => {
          if (query && query.key === 'section_visibility') {
            return inMemorySetting;
          }
          return null;
        }
      };
    };

    originalSettingFindOneAndUpdate = SystemSetting.findOneAndUpdate;
    SystemSetting.findOneAndUpdate = async function(filter, update, opts) {
      if (filter.key === 'section_visibility') {
        inMemorySetting = {
          key: 'section_visibility',
          value: { ...update.value }
        };
        return inMemorySetting;
      }
      return null;
    };

    originalActivityLogCreate = ActivityLog.create;
    ActivityLog.create = async function(doc) {
      loggedActivities.push(doc);
      return doc;
    };

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  test.after(async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: originalReadyState,
      configurable: true
    });
    User.findOne = originalUserFindOne;
    Story.find = originalStoryFind;
    Story.findOne = originalStoryFindOne;
    Story.countDocuments = originalStoryCount;
    Resource.find = originalResourceFind;
    Resource.findOne = originalResourceFindOne;
    Folder.findOne = originalFolderFindOne;
    Achievement.find = originalAchievementFind;
    SystemSetting.findOne = originalSettingFindOne;
    SystemSetting.findOneAndUpdate = originalSettingFindOneAndUpdate;
    ActivityLog.create = originalActivityLogCreate;
    if (server) await new Promise((r) => server.close(r));
  });

  test.beforeEach(async () => {
    inMemorySetting = null; // Reset to default "no setting exists"
    loggedActivities = [];
    await cacheService.del(cacheService.makeKey('settings', 'section_visibility')).catch(() => {});
    await cacheService.del(cacheService.makeKey('seo', 'sitemap_xml')).catch(() => {});
  });

  test('1. Default Behavior: All three sections default to OFF (false) when no setting exists', async () => {
    const visibility = await getSectionVisibility();
    assert.deepEqual(visibility, {
      stories: false,
      resources: false,
      achievements: false
    });
    assert.equal(DEFAULT_SECTION_VISIBILITY.stories, false);
    assert.equal(DEFAULT_SECTION_VISIBILITY.resources, false);
    assert.equal(DEFAULT_SECTION_VISIBILITY.achievements, false);
  });

  test('2. Public endpoint GET /api/settings/visibility returns default false without auth', async () => {
    const res = await fetch(`${baseUrl}/api/settings/visibility`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data, {
      stories: false,
      resources: false,
      achievements: false
    });
  });

  test('3. When Stories is OFF: public & student requests to /api/stories return HTTP 404 SECTION_DISABLED', async () => {
    // Unauthenticated public request
    const pubRes = await fetch(`${baseUrl}/api/stories`);
    assert.equal(pubRes.status, 404);
    const pubData = await pubRes.json();
    assert.equal(pubData.code, 'SECTION_DISABLED');
    assert.match(pubData.error, /stories/i);

    // Authenticated student request
    const stuRes = await fetch(`${baseUrl}/api/stories`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert.equal(stuRes.status, 404);
    const stuData = await stuRes.json();
    assert.equal(stuData.code, 'SECTION_DISABLED');

    // Single story access
    const singleRes = await fetch(`${baseUrl}/api/stories/story-1`);
    assert.equal(singleRes.status, 404);
    const singleData = await singleRes.json();
    assert.equal(singleData.code, 'SECTION_DISABLED');
  });

  test('4. When Resources is OFF: public & student requests to /api/resources return HTTP 404 SECTION_DISABLED', async () => {
    // Public listing
    const resList = await fetch(`${baseUrl}/api/resources`);
    assert.equal(resList.status, 404);
    const listData = await resList.json();
    assert.equal(listData.code, 'SECTION_DISABLED');

    // Single resource metadata
    const resDetail = await fetch(`${baseUrl}/api/resources/res-1`);
    assert.equal(resDetail.status, 404);
    const detailData = await resDetail.json();
    assert.equal(detailData.code, 'SECTION_DISABLED');

    // Download URL endpoint
    const resDownload = await fetch(`${baseUrl}/api/resources/res-1/download-url`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert.equal(resDownload.status, 404);
    const downloadData = await resDownload.json();
    assert.equal(downloadData.code, 'SECTION_DISABLED');
  });

  test('5. When Achievements is OFF: public & student requests to /api/achievements return HTTP 404 SECTION_DISABLED', async () => {
    const resAch = await fetch(`${baseUrl}/api/achievements`);
    assert.equal(resAch.status, 404);
    const achData = await resAch.json();
    assert.equal(achData.code, 'SECTION_DISABLED');
  });

  test('6. Administrators bypass visibility blocks to preview and moderate content', async () => {
    // Stories access as admin
    const adminStories = await fetch(`${baseUrl}/api/stories`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(adminStories.status, 200);

    // Resources access as admin
    const adminResources = await fetch(`${baseUrl}/api/resources`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(adminResources.status, 200);

    // Achievements access as admin
    const adminAchievements = await fetch(`${baseUrl}/api/achievements`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(adminAchievements.status, 200);
  });

  test('7. PUT /api/admin/settings/visibility requires administrator authentication', async () => {
    // Unauthenticated
    const unauthRes = await fetch(`${baseUrl}/api/admin/settings/visibility`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stories: true, resources: true, achievements: true })
    });
    assert.equal(unauthRes.status, 401);

    // Non-admin student
    const studentRes = await fetch(`${baseUrl}/api/admin/settings/visibility`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ stories: true, resources: true, achievements: true })
    });
    assert.equal(studentRes.status, 403);
  });

  test('8. PUT /api/admin/settings/visibility validates input types and rejects invalid bodies', async () => {
    const badRes = await fetch(`${baseUrl}/api/admin/settings/visibility`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ stories: 'yes', resources: 1, achievements: null })
    });
    assert.equal(badRes.status, 400);
    const data = await badRes.json();
    assert.match(data.error, /boolean/i);
  });

  test('9. Admin can update section visibility persistently and audit log is recorded', async () => {
    const updateRes = await fetch(`${baseUrl}/api/admin/settings/visibility`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ stories: true, resources: false, achievements: true })
    });
    assert.equal(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.deepEqual(updateData.visibility, {
      stories: true,
      resources: false,
      achievements: true
    });

    // Verify GET endpoint reflects persisted setting
    const getRes = await fetch(`${baseUrl}/api/settings/visibility`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.deepEqual(getData, {
      stories: true,
      resources: false,
      achievements: true
    });
  });

  test('10. Independent toggling: turning Stories ON allows public stories while Resources remains 404', async () => {
    // Set Stories = ON, Resources = OFF, Achievements = OFF
    await fetch(`${baseUrl}/api/admin/settings/visibility`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ stories: true, resources: false, achievements: false })
    });

    // Public stories succeeds
    const storiesRes = await fetch(`${baseUrl}/api/stories`);
    assert.equal(storiesRes.status, 200);

    // Public story detail succeeds
    const storyDetailRes = await fetch(`${baseUrl}/api/stories/story-1`);
    assert.equal(storyDetailRes.status, 200);

    // Resources still returns 404
    const resourcesRes = await fetch(`${baseUrl}/api/resources`);
    assert.equal(resourcesRes.status, 404);

    // Achievements still returns 404
    const achievementsRes = await fetch(`${baseUrl}/api/achievements`);
    assert.equal(achievementsRes.status, 404);
  });

  test('11. Sitemap generation excludes disabled sections and detail routes', async () => {
    // When all OFF
    inMemorySetting = {
      key: 'section_visibility',
      value: { stories: false, resources: false, achievements: false }
    };
    await cacheService.del(cacheService.makeKey('settings', 'section_visibility'));
    await cacheService.del(cacheService.makeKey('seo', 'sitemap_xml'));

    const sitemapOffRes = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemapOffRes.status, 200);
    const xmlOff = await sitemapOffRes.text();
    assert.ok(!xmlOff.includes('<loc>https://loop-seven-delta.vercel.app/stories</loc>'));
    assert.ok(!xmlOff.includes('<loc>https://loop-seven-delta.vercel.app/resources</loc>'));
    assert.ok(!xmlOff.includes('<loc>https://loop-seven-delta.vercel.app/achievements</loc>'));
    assert.ok(!xmlOff.includes('/stories/story-1'));

    // When Stories is ON
    inMemorySetting = {
      key: 'section_visibility',
      value: { stories: true, resources: false, achievements: false }
    };
    await cacheService.del(cacheService.makeKey('settings', 'section_visibility'));
    await cacheService.del(cacheService.makeKey('seo', 'sitemap_xml'));

    const sitemapOnRes = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemapOnRes.status, 200);
    const xmlOn = await sitemapOnRes.text();
    assert.ok(xmlOn.includes('<loc>https://loop-seven-delta.vercel.app/stories</loc>'));
    assert.ok(xmlOn.includes('/stories/story-1'));
    assert.ok(!xmlOn.includes('<loc>https://loop-seven-delta.vercel.app/resources</loc>'));
    assert.ok(!xmlOn.includes('<loc>https://loop-seven-delta.vercel.app/achievements</loc>'));
  });
});
