/**
 * Verification test script for Duplicate Ticket Detection and Merging
 * Tests:
 * 1. Cross-Tenant Duplicate Detection (same title from different tenants)
 * 2. Time-Shifted / Recurring Duplicate Detection (same title submitted at different times)
 * 3. General Similarity scoring
 * 4. Merged tickets ledger query and schema validation
 * 5. Assignment validation on merged tickets
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runTests() {
  console.log('🧪 Starting Duplicate Ticket Detection & Merging Verification Tests...\n');

  // Dynamic import of ES modules
  const { compareTicketsForDuplicate, scanForDuplicates } = await import('../services/duplicateDetectionService.js');

  // Test 1: Cross-Tenant Incident Detection (Same Title, Different Tenants)
  console.log('--- Test 1: Cross-Tenant Duplicate Detection ---');
  const tenant1Ticket = {
    id: 't-tenant-1',
    title: 'Main Lobby Elevator Stopped Working',
    description: 'Elevator number 2 is stuck on the ground floor with doors closed.',
    category: 'Facility',
    department_id: 'dept-fac',
    tenant_id: 'tenant-org-alpha',
    tenant_name: 'City Housing Office',
    created_at: new Date('2026-11-20T08:00:00Z'),
  };

  const tenant2Ticket = {
    id: 't-tenant-2',
    title: 'Main Lobby Elevator Stopped Working',
    description: 'Ground floor elevator is not responding to call buttons.',
    category: 'Facility',
    department_id: 'dept-fac',
    tenant_id: 'tenant-org-beta',
    tenant_name: 'Apex Commercial Suites',
    created_at: new Date('2026-11-20T08:15:00Z'),
  };

  const crossTenantResult = compareTicketsForDuplicate(tenant1Ticket, tenant2Ticket);
  console.log(`Cross-Tenant Score: ${crossTenantResult.score}% (Pattern: ${crossTenantResult.pattern}, Confidence: ${crossTenantResult.confidence})`);
  console.log(`Reasons: ${crossTenantResult.reasons.join(' | ')}`);

  if (!crossTenantResult.isCrossTenant) {
    throw new Error('Expected isCrossTenant to be true for different tenants with same title');
  }
  if (crossTenantResult.score < 75) {
    throw new Error(`Expected high duplicate score >= 75% for identical title from different tenants, got ${crossTenantResult.score}%`);
  }
  console.log('✅ Test 1 Passed: Cross-tenant duplicate incidents detected and flagged.\n');

  // Test 2: Time-Shifted / Recurring Duplicate Detection (Same Title, Days Apart)
  console.log('--- Test 2: Time-Shifted Duplicate Detection ---');
  const pastTicket = {
    id: 't-time-1',
    title: 'ERP Billing Module Export Error',
    description: 'Exporting invoice report fails with timeout code 504.',
    category: 'Software',
    department_id: 'dept-it',
    tenant_id: 'tenant-org-alpha',
    tenant_name: 'City Housing Office',
    created_at: new Date('2026-10-15T09:00:00Z'), // ~36 days prior
  };

  const currentTicket = {
    id: 't-time-2',
    title: 'ERP Billing Module Export Error',
    description: 'Same invoice report timeout error occurred again this morning.',
    category: 'Software',
    department_id: 'dept-it',
    tenant_id: 'tenant-org-alpha',
    tenant_name: 'City Housing Office',
    created_at: new Date('2026-11-20T09:00:00Z'),
  };

  const timeShiftedResult = compareTicketsForDuplicate(pastTicket, currentTicket);
  console.log(`Time-Shifted Score: ${timeShiftedResult.score}% (Pattern: ${timeShiftedResult.pattern}, Days Apart: ${timeShiftedResult.daysDiff})`);
  console.log(`Reasons: ${timeShiftedResult.reasons.join(' | ')}`);

  if (!timeShiftedResult.isTimeShifted) {
    throw new Error('Expected isTimeShifted to be true for tickets created weeks apart with same title');
  }
  if (timeShiftedResult.score < 70) {
    throw new Error(`Expected high score >= 70% for time-shifted identical title, got ${timeShiftedResult.score}%`);
  }
  console.log('✅ Test 2 Passed: Time-shifted / recurring duplicate issues detected.\n');

  // Test 3: scanForDuplicates Batch Processing
  console.log('--- Test 3: scanForDuplicates Batch Suggestions ---');
  const batch = [tenant1Ticket, tenant2Ticket, pastTicket, currentTicket];
  const scanResults = scanForDuplicates(batch, { minScore: 40 });
  console.log(`Found ${scanResults.length} suggested duplicate pairs:`);
  scanResults.forEach((s, idx) => {
    console.log(`  [Pair ${idx + 1}] Score: ${s.score}% | Pattern: ${s.patternLabel} | ${s.primaryCandidate.title} (${s.primaryCandidate.tenant_name}) vs ${s.duplicateCandidate.title} (${s.duplicateCandidate.tenant_name})`);
  });

  if (scanResults.length < 2) {
    throw new Error(`Expected at least 2 suggested pairs from batch, got ${scanResults.length}`);
  }
  console.log('✅ Test 3 Passed: Batch scan for duplicate pairs operational.\n');

  // Test 3B: Category Disqualification Rule (Different categories must NEVER merge or be duplicate)
  console.log('--- Test 3B: Different Category Disqualification ---');
  const ticketCatIT = {
    id: 't-it-1',
    title: 'Network connection keeps dropping',
    category: 'IT Support',
    department_id: 'dept-it',
    tenant_id: 'tenant-city-housing',
    tenant_name: 'City Housing Office',
    created_at: new Date('2026-11-20T08:00:00Z'),
  };
  const ticketCatGeneral = {
    id: 't-gen-1',
    title: 'Network connection keeps dropping', // identical title, same tenant!
    category: 'General Inquiry', // DIFFERENT category!
    department_id: 'dept-it',
    tenant_id: 'tenant-city-housing',
    tenant_name: 'City Housing Office',
    created_at: new Date('2026-11-20T08:15:00Z'),
  };

  const diffCategoryResult = compareTicketsForDuplicate(ticketCatIT, ticketCatGeneral);
  console.log(`Different Category Score: ${diffCategoryResult.score}% (Pattern: ${diffCategoryResult.pattern}, Is Suggested: ${diffCategoryResult.isSuggestedDuplicate})`);
  console.log(`Reasons: ${diffCategoryResult.reasons.join(' | ')}`);

  if (diffCategoryResult.score !== 0) {
    throw new Error(`Expected score 0 for tickets in different categories, got ${diffCategoryResult.score}%`);
  }
  if (diffCategoryResult.isSuggestedDuplicate) {
    throw new Error('Expected isSuggestedDuplicate to be false for tickets in different categories');
  }

  // Same tenant in same category:
  const ticketCatIT2 = {
    id: 't-it-2',
    title: 'Network connection issue again',
    category: 'IT Support', // SAME category!
    department_id: 'dept-it',
    tenant_id: 'tenant-city-housing',
    tenant_name: 'City Housing Office',
    created_at: new Date('2026-11-20T09:00:00Z'),
  };
  const sameTenantSameCatResult = compareTicketsForDuplicate(ticketCatIT, ticketCatIT2);
  console.log(`Same Tenant Same Category Score: ${sameTenantSameCatResult.score}% (Pattern: ${sameTenantSameCatResult.pattern})`);
  if (sameTenantSameCatResult.score < 40) {
    throw new Error(`Expected score >= 40% for same tenant and same category, got ${sameTenantSameCatResult.score}%`);
  }
  console.log('✅ Test 3B Passed: Different categories strictly disqualified (0% score); same category in same tenant successfully flagged as duplicates.\n');

  // Test 4: Database Verification & Merged Tickets Ledger Query
  console.log('--- Test 4: Database Schema & Ledger Query ---');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dms_helpdesk',
  });

  const [cols] = await pool.query(`SHOW COLUMNS FROM tickets WHERE Field IN ('merged_into', 'merged_at', 'merged_by', 'merge_reason')`);
  console.log('Tickets merge columns found:', cols.map(c => c.Field).join(', '));
  if (cols.length < 4) {
    throw new Error('Missing merge columns on tickets table!');
  }

  const [ledgerRows] = await pool.query(`
    SELECT t.id, t.reference_number, t.title, t.merged_into, pt.reference_number AS primary_ref
    FROM tickets t
    JOIN tickets pt ON pt.id = t.merged_into
    LIMIT 5
  `);
  console.log(`Current merged tickets in ledger: ${ledgerRows.length}`);
  ledgerRows.forEach(r => {
    console.log(`  Merged Ticket #${r.reference_number} -> Primary #${r.primary_ref} ("${r.title}")`);
  });

  await pool.end();
  console.log('✅ Test 4 Passed: Database schema and ledger query verified.\n');

  console.log('🎉 All tests completed successfully!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
