import pool from './config/db.js';
import * as ticketService from './services/ticketService.js';
import * as slaService from './services/slaService.js';
import * as ticketRepo from './repository/ticketRepository.js';
import * as notificationRepo from './repository/notificationRepository.js';
import { v4 as uuidv4 } from 'uuid';

// Helper assertion function
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE TICKET REOPEN TEST SUITE');
  console.log('====================================================\n');

  try {
    // 0. Setup mock/test users and departments
    const [adminRows] = await pool.query("SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.status = 'active' LIMIT 1");
    const [managerRows] = await pool.query("SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'manager' AND u.status = 'active' LIMIT 1");
    const [staffRows] = await pool.query("SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'staff' AND u.status = 'active' LIMIT 1");
    const [tenantRows] = await pool.query("SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'tenant' AND u.status = 'active' LIMIT 1");

    if (!adminRows.length || !managerRows.length || !staffRows.length || !tenantRows.length) {
      throw new Error('Required test users (admin, manager, staff, tenant) not found in database');
    }

    const admin = adminRows[0];
    const manager = managerRows[0];
    const staff = staffRows[0];
    const tenant = tenantRows[0];
    const otherTenant = { id: uuidv4(), tenant_id: uuidv4(), role: 'tenant' };

    console.log(`Test users initialized:`);
    console.log(`- Admin: ${admin.email} (${admin.id})`);
    console.log(`- Manager: ${manager.email} (${manager.id})`);
    console.log(`- Staff: ${staff.email} (${staff.id})`);
    console.log(`- Tenant: ${tenant.email} (${tenant.id}, tenant_id: ${tenant.tenant_id})\n`);

    // ── TEST SUITE 1: SLA Option B Math & Calculation Tests ──
    console.log('--- Test Suite 1: SLA Option B Remaining Time Calculation ---');
    {
      const policy = { priority: 'medium', resolution_hours: 24, escalation_hours: 12 };
      const createdAt = new Date('2026-10-20T08:00:00Z');
      const resolvedAt = new Date('2026-10-20T14:00:00Z'); // 6 hours elapsed
      const reopenedAt = new Date('2026-10-20T16:00:00Z');

      const result = slaService.computeReopenDueDates(policy, createdAt, resolvedAt, reopenedAt);
      assert(result.elapsedHours === 6, `Elapsed active hours calculated correctly as 6h (got ${result.elapsedHours}h)`);
      assert(result.effectiveRemainingHours === 18, `Remaining resolution SLA time is 24 - 6 = 18h (got ${result.effectiveRemainingHours}h)`);
      assert(result.resolutionDueDate > reopenedAt, 'New resolution due date is in the future');

      const expectedDueDateMs = reopenedAt.getTime() + 18 * 60 * 60 * 1000;
      assert(Math.abs(result.resolutionDueDate.getTime() - expectedDueDateMs) < 1000, 'Resolution due date is reopenedAt + 18 hours');
    }

    {
      // Case: SLA already expired before resolution (elapsed > resolution_hours)
      const policy = { priority: 'urgent', resolution_hours: 4, escalation_hours: 2 };
      const createdAt = new Date('2026-10-20T08:00:00Z');
      const resolvedAt = new Date('2026-10-20T14:00:00Z'); // 6 hours elapsed > 4h
      const reopenedAt = new Date('2026-10-20T16:00:00Z');

      const result = slaService.computeReopenDueDates(policy, createdAt, resolvedAt, reopenedAt);
      assert(result.elapsedHours === 6, `Elapsed active hours is 6h`);
      assert(result.effectiveRemainingHours >= 2, `Minimum safety buffer applied when remaining time is <= 0 (got ${result.effectiveRemainingHours}h)`);
      assert(result.resolutionDueDate > reopenedAt, 'New resolution due date with safety buffer is strictly in the future');
    }

    // ── TEST SUITE 2: Valid Reopening & History Preservation ──
    console.log('\n--- Test Suite 2: Valid Ticket Reopening & History Preservation ---');
    const ticketId = uuidv4();
    const refNum = `TEST-${Date.now().toString().slice(-6)}`;
    const originalFirstResponse = new Date(Date.now() - 5 * 3600 * 1000);
    const initialResolutionTime = new Date(Date.now() - 2 * 3600 * 1000);

    // Create a resolved test ticket
    await pool.query(
      `INSERT INTO tickets
       (id, reference_number, track_number, tenant_id, created_by, assigned_to, department_id,
        title, description, priority, category, status, created_at, first_response_at,
        resolved_at, tenant_confirmation_status, due_date, is_overdue)
       VALUES
       (:id, :refNum, :track, :tenantId, :createdBy, :assignedTo, :deptId,
        'Test Reopen Ticket', 'Test description for ticket lifecycle verification',
        'medium', 'Software', 'resolved', :createdAt, :firstResponseAt,
        :resolvedAt, 'pending', :dueDate, 1)`,
      {
        id: ticketId,
        refNum,
        track: `TRK-${Date.now()}`,
        tenantId: tenant.tenant_id,
        createdBy: tenant.id,
        assignedTo: staff.id,
        deptId: null,
        createdAt: new Date(Date.now() - 10 * 3600 * 1000),
        firstResponseAt: originalFirstResponse,
        resolvedAt: initialResolutionTime,
        dueDate: new Date(Date.now() - 1 * 3600 * 1000), // was overdue
      }
    );

    // Log initial history
    await ticketRepo.logStatusHistory({
      id: uuidv4(),
      ticketId,
      fromStatus: 'open',
      toStatus: 'in_progress',
      changedBy: staff.id,
      notes: 'Staff started work',
      role: 'staff',
    });
    await ticketRepo.logStatusHistory({
      id: uuidv4(),
      ticketId,
      fromStatus: 'in_progress',
      toStatus: 'resolved',
      changedBy: staff.id,
      notes: 'First resolution provided',
      role: 'staff',
    });

    // 2.1 Reopen ticket by Tenant
    const reopenReason = 'Issue persists: software still crashes on launch';
    const reopenedTicket = await ticketService.reopenTicket(tenant, ticketId, reopenReason, { browser: 'TestRunner' });

    assert(reopenedTicket.status === 'reopened', `Ticket transitioned to status 'reopened' (got '${reopenedTicket.status}')`);
    assert(reopenedTicket.reopenReason === reopenReason, `Reopen reason saved correctly: '${reopenedTicket.reopenReason}'`);
    assert(reopenedTicket.reopenedBy === tenant.id, `ReopenedBy recorded as tenant ID ${tenant.id}`);
    assert(reopenedTicket.tenantConfirmationStatus === 'rejected', `tenantConfirmationStatus reset to 'rejected' (got '${reopenedTicket.tenantConfirmationStatus}')`);
    assert(reopenedTicket.isOverdue === false, `Overdue flag reset to false (got ${reopenedTicket.isOverdue})`);
    assert(new Date(reopenedTicket.dueDate) > new Date(), `Resumed SLA resolution due date is in the future (${reopenedTicket.dueDate})`);

    // Verify preservation of original first_response_at and historical resolution
    const [ticketDbRows] = await pool.query('SELECT first_response_at, resolved_at FROM tickets WHERE id = :id', { id: ticketId });
    assert(ticketDbRows[0].first_response_at !== null, 'Original first_response_at is preserved in tickets table');
    assert(
      Math.abs(new Date(ticketDbRows[0].first_response_at).getTime() - originalFirstResponse.getTime()) < 2000,
      'first_response_at timestamp was NOT overwritten or wiped'
    );
    assert(ticketDbRows[0].resolved_at !== null, 'Previous resolved_at timestamp is preserved');

    // Verify history table contains all events
    const historyEntries = await ticketRepo.getStatusHistory(ticketId);
    assert(historyEntries.length === 3, `History contains 3 entries (got ${historyEntries.length})`);
    const reopenHistory = historyEntries.find((h) => h.to_status === 'reopened');
    assert(reopenHistory !== undefined, 'Ticket status history contains reopened transition');
    assert(reopenHistory?.from_status === 'resolved', `Reopen history shows from_status 'resolved'`);
    assert(reopenHistory?.notes === reopenReason, `Reopen history contains exact reason`);
    assert(reopenHistory?.changed_by === tenant.id, `Reopen history records correct actor ID`);

    // ── TEST SUITE 3: Unauthorized Reopen Attempts ──
    console.log('\n--- Test Suite 3: Unauthorized Reopen Attempts ---');

    // 3.1 Staff attempting to reopen
    let staffBlocked = false;
    try {
      await ticketService.reopenTicket(staff, ticketId, 'Staff attempting reopen');
    } catch (err) {
      staffBlocked = err.statusCode === 403;
      assert(err.statusCode === 403, `Staff reopening forbidden with 403 (got ${err.statusCode}: ${err.message})`);
    }
    assert(staffBlocked, 'Staff cannot reopen tickets');

    // 3.2 Another tenant attempting to reopen
    let otherTenantBlocked = false;
    try {
      await ticketService.reopenTicket(otherTenant, ticketId, 'Intruder tenant reopening');
    } catch (err) {
      otherTenantBlocked = err.statusCode === 403 || err.statusCode === 404;
      assert(err.statusCode === 403 || err.statusCode === 404, `Cross-tenant reopen denied with 403/404 (got ${err.statusCode})`);
    }
    assert(otherTenantBlocked, 'Unauthorized tenant cannot access or reopen another tenant ticket');

    // ── TEST SUITE 4: Invalid Status Transitions ──
    console.log('\n--- Test Suite 4: Invalid Status Transitions ---');

    // 4.1 Reopening an already reopened ticket
    let doubleReopenBlocked = false;
    try {
      await ticketService.reopenTicket(admin, ticketId, 'Attempting double reopen');
    } catch (err) {
      doubleReopenBlocked = err.statusCode === 400;
      assert(err.statusCode === 400, `Reopening already reopened ticket blocked with 400: "${err.message}"`);
    }
    assert(doubleReopenBlocked, 'Cannot reopen an already reopened ticket');

    // 4.2 Reopening a ticket that is currently 'open' or 'in_progress'
    const openTicketId = uuidv4();
    await pool.query(
      `INSERT INTO tickets (id, reference_number, track_number, tenant_id, created_by, title, description, priority, category, status)
       VALUES (:id, :ref, :track, :tenantId, :createdBy, 'Open Ticket', 'Description', 'low', 'IT', 'open')`,
      { id: openTicketId, ref: `TEST-${Date.now().toString().slice(-6)}B`, track: `TRK-${Date.now()}B`, tenantId: tenant.tenant_id, createdBy: tenant.id }
    );
    let openReopenBlocked = false;
    try {
      await ticketService.reopenTicket(admin, openTicketId, 'Trying to reopen brand new ticket');
    } catch (err) {
      openReopenBlocked = err.statusCode === 400;
      assert(err.statusCode === 400, `Reopening open ticket blocked with 400: "${err.message}"`);
    }
    assert(openReopenBlocked, 'Cannot reopen an open/unresolved ticket');

    // 4.3 Missing reopen reason
    let missingReasonBlocked = false;
    try {
      // Transition ticket back to resolved first to test missing reason
      await pool.query("UPDATE tickets SET status = 'resolved' WHERE id = :id", { id: ticketId });
      await ticketService.reopenTicket(admin, ticketId, '   '); // empty spaces
    } catch (err) {
      missingReasonBlocked = err.statusCode === 400;
      assert(err.statusCode === 400, `Reopening without reason blocked with 400: "${err.message}"`);
    }
    assert(missingReasonBlocked, 'Reopening requires a non-empty reason');

    // Reopen with valid reason so it is cleanly in reopened state for subsequent workflow test
    await ticketService.reopenTicket(admin, ticketId, 'Valid reason for workflow resumption test');

    // ── TEST SUITE 5: Repeated Reopening Lifecycle & Cumulative SLA ──
    console.log('\n--- Test Suite 5: Repeated Reopening Lifecycle & Cumulative SLA ---');
    const [mgrDeptRows] = await pool.query('SELECT department_id FROM user_departments WHERE user_id = :userId', { userId: manager.id });
    const managerDeptId = mgrDeptRows[0]?.department_id || null;
    let repeatedTicketId;

    {
      repeatedTicketId = uuidv4();
      const t0 = new Date(Date.now() - 12 * 3600 * 1000); // Created 12h ago
      const t1 = new Date(Date.now() - 8 * 3600 * 1000);  // Resolved at t0+4h (4h active)
      const t2 = new Date(Date.now() - 6 * 3600 * 1000);  // Reopened at t0+6h
      const t3 = new Date(Date.now() - 3 * 3600 * 1000);  // Resolved again at t0+9h (+3h active = 7h total active)

      await pool.query(
        `INSERT INTO tickets
         (id, reference_number, track_number, tenant_id, created_by, assigned_to, department_id,
          title, description, priority, category, status, created_at, resolved_at)
         VALUES
         (:id, :ref, :track, :tenantId, :createdBy, :assignedTo, :deptId,
          'Repeated Reopen Test', 'Testing cumulative active calculation', 'medium', 'Software', 'resolved', :t0, :t3)`,
        {
          id: repeatedTicketId,
          ref: `REP-${Date.now().toString().slice(-6)}`,
          track: `TRK-REP-${Date.now()}`,
          tenantId: tenant.tenant_id,
          createdBy: tenant.id,
          assignedTo: staff.id,
          deptId: managerDeptId,
          t0,
          t3,
        }
      );

      // Simulate status history for 2 full resolve/reopen cycles
      await pool.query(
        `INSERT INTO ticket_status_history (id, ticket_id, from_status, to_status, changed_by, notes, role, created_at)
         VALUES
         (UUID(), :id, 'open', 'resolved', :staffId, 'Cycle 1 resolution', 'staff', :t1),
         (UUID(), :id, 'resolved', 'reopened', :tenantId, 'Cycle 1 reopen: recurring fault', 'tenant', :t2),
         (UUID(), :id, 'reopened', 'resolved', :staffId, 'Cycle 2 resolution: patch applied', 'staff', :t3)`,
        { id: repeatedTicketId, staffId: staff.id, tenantId: tenant.id, t1, t2, t3 }
      );

      // Verify cumulative active calculation helper
      const fullHistory = await ticketRepo.getStatusHistory(repeatedTicketId);
      const testTicket = await ticketRepo.findById(repeatedTicketId);
      const activeMs = ticketService.calculateActiveElapsedMs(testTicket, fullHistory);
      const activeHours = Number((activeMs / (3600 * 1000)).toFixed(1));

      assert(activeHours === 7.0, `Cumulative active elapsed hours across 2 cycles is exactly 7.0h (4h + 3h) (got ${activeHours}h)`);

      // Reopen for the second time
      const secondReopen = await ticketService.reopenTicket(manager, repeatedTicketId, 'Cycle 2 reopen: patch failed QA regression');
      assert(secondReopen.status === 'reopened', `Ticket reopened successfully on repeated cycle (status: '${secondReopen.status}')`);
      assert(secondReopen.reopenedBy === manager.id, `Second reopen attributed to Manager`);

      const updatedHistory = await ticketRepo.getStatusHistory(repeatedTicketId);
      assert(updatedHistory.length === 4, `All 4 status transitions preserved in history (got ${updatedHistory.length})`);
    }

    // ── TEST SUITE 6: Notification Dispatch Behavior ──
    console.log('\n--- Test Suite 6: Notification Dispatch on Reopen ---');
    let notifTicketId;
    {
      notifTicketId = uuidv4();
      await pool.query(
        `INSERT INTO tickets
         (id, reference_number, track_number, tenant_id, created_by, assigned_to, department_id,
          title, description, priority, category, status, resolved_at)
         VALUES
         (:id, :ref, :track, :tenantId, :createdBy, :assignedTo, :deptId,
          'Notif Test Ticket', 'Testing notification dispatch', 'medium', 'Network', 'resolved', NOW())`,
        {
          id: notifTicketId,
          ref: `NOTIF-${Date.now().toString().slice(-6)}`,
          track: `TRK-NTF-${Date.now()}`,
          tenantId: tenant.tenant_id,
          createdBy: tenant.id,
          assignedTo: staff.id,
          deptId: manager.departments?.[0]?.id || null,
        }
      );

      // Reopen as Tenant -> should notify assigned staff
      await ticketService.reopenTicket(tenant, notifTicketId, 'Testing notification dispatch on reopen');

      const [staffNotifs] = await pool.query(
        `SELECT * FROM notifications WHERE user_id = :userId AND ticket_id = :ticketId ORDER BY created_at DESC LIMIT 1`,
        { userId: staff.id, ticketId: notifTicketId }
      );
      assert(staffNotifs.length > 0, 'Assigned staff received notification on ticket reopen');
      assert(staffNotifs[0]?.type === 'reopen', `Notification type is 'reopen' (got '${staffNotifs[0]?.type}')`);
      assert(staffNotifs[0]?.message.includes('Testing notification dispatch on reopen'), 'Notification text includes reopen reason');
    }

    // ── TEST SUITE 7: Active Workflow & Work Resumption ──
    console.log('\n--- Test Suite 7: Active Workflow & Work Resumption ---');
    {
      // A reopened ticket must permit transition back to in_progress by assigned staff
      const reopenedTicket = await ticketRepo.findById(ticketId);
      assert(reopenedTicket.status === 'reopened', 'Ticket is currently reopened');

      const resumedTicket = await ticketService.changeStatus(staff, ticketId, {
        status: 'in_progress',
        notes: 'Staff resumed debugging after reopen',
      });
      assert(resumedTicket.status === 'in_progress', `Assigned staff resumed ticket into 'in_progress' (got '${resumedTicket.status}')`);
    }

    // Clean up test tickets
    await pool.query('DELETE FROM ticket_status_history WHERE ticket_id IN (:t1, :t2, :t3, :t4)', {
      t1: ticketId,
      t2: openTicketId,
      t3: repeatedTicketId,
      t4: notifTicketId,
    }).catch(() => {});
    await pool.query('DELETE FROM notifications WHERE ticket_id IN (:t1, :t2, :t3, :t4)', {
      t1: ticketId,
      t2: openTicketId,
      t3: repeatedTicketId,
      t4: notifTicketId,
    }).catch(() => {});
    await pool.query('DELETE FROM tickets WHERE id IN (:t1, :t2, :t3, :t4)', {
      t1: ticketId,
      t2: openTicketId,
      t3: repeatedTicketId,
      t4: notifTicketId,
    }).catch(() => {});

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
