import pool from './config/db.js';
import * as knowledgeService from './services/knowledgeService.js';
import { v4 as uuidv4 } from 'uuid';

async function runTest() {
  console.log('--- Starting Knowledge Base Automatic Versioning Tests ---');

  // 1. Get an admin user and department for testing
  const [users] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, r.name as role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'admin' AND u.status = 'active'
     LIMIT 1`
  );
  const adminUser = users[0];
  console.log(`Admin user: ${adminUser.first_name} ${adminUser.last_name} (${adminUser.id})`);

  const [depts] = await pool.query('SELECT id FROM departments LIMIT 1');
  const deptId = depts[0]?.id || null;

  // 2. Create a test article in draft state
  const testArticleId = uuidv4();
  const testRef = `KB-TEST-${Date.now().toString().slice(-6)}`;
  await pool.query(
    `INSERT INTO knowledge_base
      (id, article_reference, title, slug, summary, content, category, visibility, version, status, author_id, department_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'restricted', '1.0', 'draft', ?, ?, NOW(), NOW())`,
    [
      testArticleId,
      testRef,
      'Test Versioning Workflow Article',
      `test-versioning-${Date.now()}`,
      'Initial draft summary for testing versioning.',
      'Initial content v1.0: Everything about system setup and operations.',
      'ICT',
      adminUser.id,
      deptId,
    ]
  );
  console.log(`Created test article: ${testRef} (${testArticleId})`);

  // 3. Test: Initial publication (should seal version 1.0 snapshot)
  const reqMock = { ip: '127.0.0.1' };
  const pubRes = await knowledgeService.publishArticle(testArticleId, adminUser, reqMock, {
    changeSummary: 'Initial v1.0 release',
  });
  console.log(`Published article. Status: ${pubRes.status}, Version: ${pubRes.version}`);

  const versionsV1 = await knowledgeService.getVersions(testArticleId);
  console.log(`Versions count after publish: ${versionsV1.length}`);
  if (versionsV1.length !== 1 || versionsV1[0].version_number !== '1.0') {
    throw new Error(`Expected 1 version with number '1.0', got: ${JSON.stringify(versionsV1)}`);
  }
  console.log('✅ PASS: Version 1.0 snapshot automatically created upon initial publication.');
  const v1Snapshot = versionsV1[0];
  console.log(`Snapshot 1.0 details: title="${v1Snapshot.title}", published_at="${v1Snapshot.published_at}", approved_by="${v1Snapshot.approved_by}"`);

  // 4. Test: Edit the published article and approve (should automatically generate 1.1)
  await knowledgeService.updateArticle(
    testArticleId,
    {
      title: 'Test Versioning Workflow Article (Updated)',
      content: 'Updated content v1.1: Added step 2 instructions and diagnostics.',
      summary: 'Updated summary for v1.1',
    },
    adminUser,
    reqMock
  );

  const approveRes = await knowledgeService.approveArticle(testArticleId, adminUser, reqMock, {
    changeSummary: 'Added diagnostics instructions',
    isMajor: false,
  });
  console.log(`Approved edited article. Status: ${approveRes.status}, Version: ${approveRes.version}`);
  if (approveRes.version !== '1.1') {
    throw new Error(`Expected approved version to be '1.1', got '${approveRes.version}'`);
  }

  const versionsV1_1 = await knowledgeService.getVersions(testArticleId);
  console.log(`Versions count after edit + approval: ${versionsV1_1.length}`);
  if (versionsV1_1.length !== 2) {
    throw new Error(`Expected 2 versions, got ${versionsV1_1.length}`);
  }
  const v1_1Snapshot = versionsV1_1.find((v) => v.version_number === '1.1');
  const oldV1 = versionsV1_1.find((v) => v.version_number === '1.0');
  if (!v1_1Snapshot || !oldV1) {
    throw new Error('Missing 1.0 or 1.1 in versions list');
  }
  if (oldV1.content !== 'Initial content v1.0: Everything about system setup and operations.') {
    throw new Error('Old version 1.0 was modified! It must remain untouched.');
  }
  console.log('✅ PASS: Automatic minor version 1.1 created on approval. Version 1.0 preserved untouched.');

  // 5. Test: Major update (isMajor: true) -> should generate 2.0
  await knowledgeService.updateArticle(
    testArticleId,
    {
      title: 'Test Versioning Workflow Article - Major Overhaul',
      content: 'Major content v2.0: Completely rewritten architecture and policy.',
      summary: 'Summary for v2.0 major overhaul',
    },
    adminUser,
    reqMock
  );

  const majorApproveRes = await knowledgeService.approveArticle(testArticleId, adminUser, reqMock, {
    changeSummary: 'Major architecture rewrite',
    isMajor: true,
  });
  console.log(`Major approved. Version: ${majorApproveRes.version}`);
  if (majorApproveRes.version !== '2.0') {
    throw new Error(`Expected approved version to be '2.0', got '${majorApproveRes.version}'`);
  }
  console.log('✅ PASS: Major version 2.0 automatically generated when isMajor: true.');

  // 6. Test: Restore old version (1.0) -> must create a NEW version (2.1) without deleting history
  const restoreRes = await knowledgeService.restoreArticleVersion(
    testArticleId,
    v1Snapshot.id,
    adminUser,
    reqMock,
    {
      reason: 'Rollback to v1.0 for compatibility testing',
      publishImmediately: true,
    }
  );
  console.log(`Restore result: newVersion = ${restoreRes.newVersion}`);
  if (restoreRes.newVersion !== '2.1') {
    throw new Error(`Expected restored version to be '2.1', got '${restoreRes.newVersion}'`);
  }

  const allVersions = await knowledgeService.getVersions(testArticleId);
  console.log(`Total versions in history: ${allVersions.length}`);
  const versionNumbers = allVersions.map((v) => v.version_number);
  console.log(`All version numbers in DB: ${JSON.stringify(versionNumbers)}`);
  if (!versionNumbers.includes('1.0') || !versionNumbers.includes('1.1') || !versionNumbers.includes('2.0') || !versionNumbers.includes('2.1')) {
    throw new Error(`Expected versions [1.0, 1.1, 2.0, 2.1], got: ${JSON.stringify(versionNumbers)}`);
  }

  // Check restored content matches v1.0 content
  const restoredSnap = allVersions.find((v) => v.version_number === '2.1');
  if (restoredSnap.content !== v1Snapshot.content) {
    throw new Error(`Restored content mismatch. Expected: "${v1Snapshot.content}", got: "${restoredSnap.content}"`);
  }
  console.log('✅ PASS: Restoring version 1.0 created new version 2.1 with exact snapshot content. All prior history preserved.');

  // 7. Test: getArticleVersionById
  const singleSnap = await knowledgeService.getArticleVersionById(testArticleId, v1Snapshot.id, adminUser);
  if (singleSnap.versionNumber !== '1.0' || singleSnap.title !== v1Snapshot.title) {
    throw new Error('Failed to fetch individual version snapshot by ID');
  }
  console.log('✅ PASS: Fetching single version snapshot returns complete data.');

  // 8. Clean up test article
  await pool.query('DELETE FROM knowledge_article_versions WHERE article_id = ?', [testArticleId]);
  await pool.query('DELETE FROM knowledge_base WHERE id = ?', [testArticleId]);
  console.log('Cleaned up test data.');

  console.log('🎉 ALL KNOWLEDGE BASE VERSIONING TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
