const mysql = require('../node_modules/mysql2/promise');
const dotenv = require('../node_modules/dotenv');
const path = require('path');
const assert = require('assert');

dotenv.config({ path: path.join(__dirname, '../.env') });

let pool;

// Helper to dynamically import ESM modules
async function loadModules() {
  const { default: dbPool } = await import('../config/db.js');
  pool = dbPool;
  const operationalService = await import('../services/operationalEscalationService.js');
  const collaborationService = await import('../services/collaborationService.js');
  const slaMonitorService = await import('../services/slaMonitorService.js');
  const ticketService = await import('../services/ticketService.js');
  const ticketRepo = await import('../repository/ticketRepository.js');
  return { pool, operationalService, collaborationService, slaMonitorService, ticketService, ticketRepo };
}

let passed = 0;
let failed = 0;

function report(testName, ok, err = null) {
  if (ok) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}:`, err?.message || err);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log(' RUNNING 10-STAGE TWO-TIER ESCALATION VERIFICATION');
  console.log('======================================================\n');

  const { operationalService, collaborationService, slaMonitorService, ticketService, ticketRepo } = await loadModules();

  const adminUser = { id: '1001', role: 'admin', first_name: 'Admin', last_name: 'User' };
  const managerUser = { id: '1008', role: 'manager', first_name: 'IT', last_name: 'Manager' };
  const otherDeptManager = { id: '1007', role: 'manager', first_name: 'Facility', last_name: 'Manager' };
  const assignedStaff = { id: '1009', role: 'staff', first_name: 'Yesuf', last_name: 'Staff' };
  const otherStaff = { id: '1003', role: 'staff', first_name: 'Other', last_name: 'Staff' };
  const collaboratorStaff = { id: '1006', role: 'staff', first_name: 'Alemayehu', last_name: 'Staff' };
  const tenantUser = { id: '1005', role: 'tenant', tenant_id: '3001', first_name: 'Diribe', last_name: 'Tenant' };

  // Helper to create a clean test ticket
  async function createTestTicket(overrides = {}) {
    const id = 'test-esc-' + Math.random().toString(36).substring(2, 9);
    const ref = 'HD-TEST-' + Math.floor(10000 + Math.random() * 90000);
    const trk = 'TRK-TEST-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const defaults = {
      id,
      reference_number: ref,
      track_number: trk,
      tenant_id: '3001',
      created_by: '1005',
      department_id: '2002', // IT Support
      assigned_to: '1009',   // Yesuf
      title: 'Automated Test Ticket ' + id,
      description: 'Testing two-tier escalation and collaboration',
      priority: 'high',
      category: 'Hardware',
      status: 'assigned',
      sla_status: 'within_target',
      operational_escalation_status: 'none',
      is_escalated: 0,
      escalation_sla_breached: 0,
      is_overdue: 0,
      response_due_date: new Date(Date.now() + 3600000),
      escalation_due_date: new Date(Date.now() + 7200000),
      due_date: new Date(Date.now() + 14400000),
    };

    const finalData = { ...defaults, ...overrides };

    await pool.query(
      `INSERT INTO tickets
        (id, reference_number, track_number, tenant_id, created_by, department_id, assigned_to,
         title, description, priority, category, status, sla_status, operational_escalation_status,
         is_escalated, escalation_sla_breached, is_overdue, response_due_date, escalation_due_date, due_date, created_at, updated_at)
       VALUES
        (:id, :reference_number, :track_number, :tenant_id, :created_by, :department_id, :assigned_to,
         :title, :description, :priority, :category, :status, :sla_status, :operational_escalation_status,
         :is_escalated, :escalation_sla_breached, :is_overdue, :response_due_date, :escalation_due_date, :due_date, NOW(), NOW())`,
      finalData
    );

    return id;
  }

  // --- SCENARIO 1: Automatic SLA escalation at the configured threshold ---
  try {
    const pastEscDueDate = new Date(Date.now() - 3600000); // 1 hour ago
    const t1Id = await createTestTicket({
      escalation_due_date: pastEscDueDate,
      status: 'assigned',
    });

    await slaMonitorService.checkSlaDeadlines();

    const [rows] = await pool.query('SELECT status, sla_status, escalation_sla_breached, is_escalated FROM tickets WHERE id = ?', [t1Id]);
    assert.strictEqual(rows[0].escalation_sla_breached, 1, 'escalation_sla_breached must be 1');
    assert.strictEqual(rows[0].sla_status, 'escalation_triggered', 'sla_status must be escalation_triggered');

    const [slaEvents] = await pool.query('SELECT * FROM ticket_sla_escalations WHERE ticket_id = ? AND breach_status = "escalation_triggered"', [t1Id]);
    assert.ok(slaEvents.length > 0, 'Must record SLA escalation in ticket_sla_escalations');

    report('1. Automatic SLA escalation triggers at configured threshold and logs record', true);
  } catch (err) {
    report('1. Automatic SLA escalation triggers at configured threshold and logs record', false, err);
  }

  // --- SCENARIO 2: Resolution deadline breach ---
  try {
    const pastDueDate = new Date(Date.now() - 7200000); // 2 hours ago
    const t2Id = await createTestTicket({
      due_date: pastDueDate,
      status: 'in_progress',
    });

    await slaMonitorService.checkSlaDeadlines();

    const [rows] = await pool.query('SELECT status, sla_status, is_overdue FROM tickets WHERE id = ?', [t2Id]);
    assert.strictEqual(rows[0].is_overdue, 1, 'is_overdue must be 1');
    assert.strictEqual(rows[0].sla_status, 'resolution_breached', 'sla_status must be resolution_breached');

    const [slaEvents] = await pool.query('SELECT * FROM ticket_sla_escalations WHERE ticket_id = ? AND breach_status = "resolution_breached"', [t2Id]);
    assert.ok(slaEvents.length > 0, 'Must record resolution deadline breach in ticket_sla_escalations');

    report('2. Resolution deadline breach triggers overdue state and logs record', true);
  } catch (err) {
    report('2. Resolution deadline breach triggers overdue state and logs record', false, err);
  }

  // --- SCENARIO 3: Manual operational escalation by Staff to Department Manager ---
  let t3Id;
  let escalation1;
  try {
    t3Id = await createTestTicket({ status: 'in_progress', assigned_to: assignedStaff.id });

    escalation1 = await operationalService.requestOperationalEscalation(
      assignedStaff,
      t3Id,
      {
        escalationReason: 'Component Failure Requires Vendor Warranty Replacement',
        problemDescription: 'Power supply burned out on core server rack.',
        actionsAttempted: 'Replaced power cable and tested secondary UPS outlet. Unit does not power on.',
        assistanceRequired: 'Authorization to purchase vendor spare part or replacement chassis.',
        destination: 'manager',
      }
    );

    assert.ok(escalation1.id, 'Escalation ID must be generated');
    assert.strictEqual(escalation1.status, 'pending_manager');
    assert.strictEqual(escalation1.destination, 'manager');
    assert.strictEqual(escalation1.requesting_user_id, assignedStaff.id);

    const [tRows] = await pool.query('SELECT status, operational_escalation_status, operational_escalation_reason FROM tickets WHERE id = ?', [t3Id]);
    assert.strictEqual(tRows[0].operational_escalation_status, 'pending_manager');
    assert.strictEqual(tRows[0].operational_escalation_reason, 'Component Failure Requires Vendor Warranty Replacement');
    assert.strictEqual(tRows[0].status, 'in_progress', 'Ticket status must remain in_progress and not closed');

    report('3. Staff initiates manual operational escalation to Department Manager', true);
  } catch (err) {
    report('3. Staff initiates manual operational escalation to Department Manager', false, err);
  }

  // --- SCENARIO 4: Department Manager review and intervention (Guidance) ---
  try {
    const reviewed = await operationalService.reviewByManager(
      managerUser,
      t3Id,
      escalation1.id,
      {
        decision: 'guidance',
        notes: 'Check backup inventory in Room 302 first before placing procurement order.',
      }
    );

    assert.strictEqual(reviewed.manager_decision, 'guidance');
    assert.strictEqual(reviewed.status, 'guidance_provided');
    assert.ok(reviewed.manager_notes.includes('Room 302'));

    const [tRows] = await pool.query('SELECT operational_escalation_status, status FROM tickets WHERE id = ?', [t3Id]);
    assert.strictEqual(tRows[0].operational_escalation_status, 'guidance_provided');
    assert.strictEqual(tRows[0].status, 'in_progress', 'Ticket remains open for staff to execute guidance');

    report('4. Department Manager reviews operational escalation and provides guidance', true);
  } catch (err) {
    report('4. Department Manager reviews operational escalation and provides guidance', false, err);
  }

  // --- SCENARIO 5: Department Manager escalation to Admin ---
  let escalation2;
  try {
    // Staff reports backup inventory also depleted, manager escalates to Admin for capital procurement
    escalation2 = await operationalService.reviewByManager(
      managerUser,
      t3Id,
      escalation1.id,
      {
        decision: 'escalate_to_admin',
        notes: 'Spare stock depleted across campus. Needs executive authorization for emergency purchase.',
      }
    );

    assert.strictEqual(escalation2.destination, 'admin');
    assert.strictEqual(escalation2.status, 'pending_admin');
    assert.strictEqual(escalation2.manager_decision, 'escalate_to_admin');

    const [tRows] = await pool.query('SELECT operational_escalation_status FROM tickets WHERE id = ?', [t3Id]);
    assert.strictEqual(tRows[0].operational_escalation_status, 'pending_admin');

    report('5. Department Manager escalates operational issue to Admin', true);
  } catch (err) {
    report('5. Department Manager escalates operational issue to Admin', false, err);
  }

  // --- SCENARIO 6: Admin review and decision ---
  try {
    const adminDecision = await operationalService.reviewByAdmin(
      adminUser,
      t3Id,
      escalation2.id,
      {
        decision: 'resource_allocated',
        notes: 'Emergency procurement of 2 redundant power supplies approved under capital budget line #4402.',
      }
    );

    assert.strictEqual(adminDecision.admin_decision, 'resource_allocated');
    assert.strictEqual(adminDecision.status, 'resolved');
    assert.ok(adminDecision.admin_notes.includes('4402'));

    const [tRows] = await pool.query('SELECT status, operational_escalation_status FROM tickets WHERE id = ?', [t3Id]);
    assert.strictEqual(tRows[0].operational_escalation_status, 'resolved');
    assert.strictEqual(tRows[0].status, 'in_progress', 'Ticket returned to working team, active until tenant confirmation');

    report('6. Admin reviews and provides executive resource decision, returning ticket to team', true);
  } catch (err) {
    report('6. Admin reviews and provides executive resource decision, returning ticket to team', false, err);
  }

  // --- SCENARIO 7: Team collaboration and additional staff assignment ---
  try {
    const t7Id = await createTestTicket({ status: 'in_progress', assigned_to: assignedStaff.id });

    // Manager adds additional collaborator staff member
    const collaborators = await collaborationService.addCollaborators(
      managerUser,
      t7Id,
      {
        userIds: [collaboratorStaff.id],
        role: 'Hardware Specialist',
        notes: 'Please assist Yesuf with server motherboards diagnostics.',
      }
    );

    assert.ok(collaborators.some(c => c.user_id === collaboratorStaff.id), 'Collaborator must be added');

    // Collaborator records technical contribution & in-person coordination
    const updatedContrib = await collaborationService.recordContribution(
      collaboratorStaff,
      t7Id,
      {
        contributionNotes: 'Completed multimeter continuity test on bus bar. Capacitors intact.',
        inPersonNotes: 'Met with Yesuf at Data Center Rack 4 at 10:30 AM to unrack server together.',
      }
    );

    assert.ok(updatedContrib.contribution_notes.includes('multimeter continuity'));
    assert.ok(updatedContrib.in_person_notes.includes('Data Center Rack 4'));

    // Check internal note was created in ticket replies
    const [replies] = await pool.query('SELECT message, is_internal FROM ticket_replies WHERE ticket_id = ? AND user_id = ?', [t7Id, collaboratorStaff.id]);
    assert.ok(replies.length > 0, 'Internal reply must be recorded');
    assert.strictEqual(replies[0].is_internal, 1, 'Must be internal note to avoid exposing confidential technical data to tenants');

    report('7. Team collaboration assigns staff, records technical findings and in-person coordination', true);
  } catch (err) {
    report('7. Team collaboration assigns staff, records technical findings and in-person coordination', false, err);
  }

  // --- SCENARIO 8: Both escalation mechanisms occurring on the same ticket ---
  try {
    // Ticket with SLA escalation due date in the past, plus staff operational escalation
    const pastEscDueDate = new Date(Date.now() - 3600000);
    const t8Id = await createTestTicket({
      escalation_due_date: pastEscDueDate,
      status: 'in_progress',
      assigned_to: assignedStaff.id,
      sla_status: 'within_target',
      operational_escalation_status: 'none',
    });

    // 1. Staff requests operational escalation
    await operationalService.requestOperationalEscalation(
      assignedStaff,
      t8Id,
      {
        escalationReason: 'Database index corruption requiring schema migration lock',
        problemDescription: 'Queries timing out under peak load.',
        actionsAttempted: 'Optimized query plan, restarted read replica.',
        assistanceRequired: 'Manager decision to schedule 15min maintenance window.',
        destination: 'manager',
      }
    );

    // 2. SLA Monitor runs time-based automatic escalation
    await slaMonitorService.checkSlaDeadlines();

    const [tRows] = await pool.query(
      'SELECT sla_status, operational_escalation_status, escalation_sla_breached, is_escalated FROM tickets WHERE id = ?',
      [t8Id]
    );

    assert.strictEqual(tRows[0].sla_status, 'escalation_triggered', 'Time-based SLA status must be escalation_triggered');
    assert.strictEqual(tRows[0].operational_escalation_status, 'pending_manager', 'Issue-based operational status must be pending_manager');
    assert.strictEqual(tRows[0].escalation_sla_breached, 1);

    // Verify separate records exist in both tables
    const [slaRecords] = await pool.query('SELECT * FROM ticket_sla_escalations WHERE ticket_id = ?', [t8Id]);
    const [opRecords] = await pool.query('SELECT * FROM ticket_operational_escalations WHERE ticket_id = ?', [t8Id]);

    assert.ok(slaRecords.length > 0, 'SLA escalation record exists in ticket_sla_escalations');
    assert.ok(opRecords.length > 0, 'Operational escalation record exists in ticket_operational_escalations');

    report('8. Both SLA automatic escalation and manual operational escalation coexist independently', true);
  } catch (err) {
    report('8. Both SLA automatic escalation and manual operational escalation coexist independently', false, err);
  }

  // --- SCENARIO 9: Unauthorized users attempting to escalate or review tickets ---
  try {
    const t9Id = await createTestTicket({ status: 'in_progress', assigned_to: assignedStaff.id });

    // 1. Tenant attempting to initiate operational escalation -> MUST REJECT
    let tenantBlocked = false;
    try {
      await operationalService.requestOperationalEscalation(tenantUser, t9Id, {
        escalationReason: 'Tenant wanting bypass',
        problemDescription: 'Tenant trying internal escalation',
        actionsAttempted: 'None',
        assistanceRequired: 'None',
      });
    } catch (e) {
      if (e.statusCode === 403) tenantBlocked = true;
    }
    assert.ok(tenantBlocked, 'Tenant must be forbidden (403) from initiating internal operational escalation');

    // 2. Unassigned staff attempting to escalate another staff member\'s ticket -> MUST REJECT
    let unassignedStaffBlocked = false;
    try {
      await operationalService.requestOperationalEscalation(otherStaff, t9Id, {
        escalationReason: 'Other staff stepping in',
        problemDescription: 'Not assigned to me',
        actionsAttempted: 'None',
        assistanceRequired: 'None',
      });
    } catch (e) {
      if (e.statusCode === 403) unassignedStaffBlocked = true;
    }
    assert.ok(unassignedStaffBlocked, 'Staff not assigned to ticket must be forbidden (403)');

    // 3. Manager of DIFFERENT department reviewing IT ticket -> MUST REJECT
    const validEsc = await operationalService.requestOperationalEscalation(assignedStaff, t9Id, {
      escalationReason: 'Valid reason',
      problemDescription: 'Valid problem',
      actionsAttempted: 'Valid action',
      assistanceRequired: 'Valid assistance',
    });

    let wrongManagerBlocked = false;
    try {
      await operationalService.reviewByManager(otherDeptManager, t9Id, validEsc.id, {
        decision: 'guidance',
        notes: 'Wrong department manager attempting review',
      });
    } catch (e) {
      if (e.statusCode === 403) wrongManagerBlocked = true;
    }
    assert.ok(wrongManagerBlocked, 'Manager of different department must be forbidden (403)');

    // 4. Staff attempting to issue Admin decision -> MUST REJECT
    let staffAdminBlocked = false;
    try {
      await operationalService.reviewByAdmin(assignedStaff, t9Id, validEsc.id, {
        decision: 'approved',
        notes: 'Staff trying admin decision',
      });
    } catch (e) {
      if (e.statusCode === 403) staffAdminBlocked = true;
    }
    assert.ok(staffAdminBlocked, 'Staff attempting admin decision must be forbidden (403)');

    report('9. Backend strictly enforces RBAC authorization and rejects unauthorized attempts', true);
  } catch (err) {
    report('9. Backend strictly enforces RBAC authorization and rejects unauthorized attempts', false, err);
  }

  // --- SCENARIO 10: Ensuring neither escalation mechanism closes a ticket automatically ---
  try {
    const t10Id = await createTestTicket({
      status: 'in_progress',
      assigned_to: assignedStaff.id,
      escalation_due_date: new Date(Date.now() - 3600000),
      due_date: new Date(Date.now() - 1800000),
    });

    // Run SLA checks (both escalation threshold and resolution deadline breached)
    await slaMonitorService.checkSlaDeadlines();

    let [tRows] = await pool.query('SELECT status, sla_status, is_overdue FROM tickets WHERE id = ?', [t10Id]);
    assert.notStrictEqual(tRows[0].status, 'closed', 'SLA breach must NOT close ticket');
    assert.notStrictEqual(tRows[0].status, 'resolved', 'SLA breach must NOT mark ticket resolved');
    assert.notStrictEqual(tRows[0].status, 'completed', 'SLA breach must NOT mark ticket completed');

    // Run operational escalation to Admin and resolve the operational request
    const opEsc = await operationalService.requestOperationalEscalation(assignedStaff, t10Id, {
      escalationReason: 'Emergency hardware failure',
      problemDescription: 'Switch failed',
      actionsAttempted: 'Cycled power',
      assistanceRequired: 'Procure replacement',
      destination: 'admin',
    });

    await operationalService.reviewByAdmin(adminUser, t10Id, opEsc.id, {
      decision: 'approved',
      notes: 'New switch dispatched to team',
    });

    [tRows] = await pool.query('SELECT status, operational_escalation_status FROM tickets WHERE id = ?', [t10Id]);
    assert.strictEqual(tRows[0].operational_escalation_status, 'resolved', 'Operational escalation request is resolved');
    assert.notStrictEqual(tRows[0].status, 'closed', 'Admin decision must NOT close ticket');
    assert.notStrictEqual(tRows[0].status, 'completed', 'Admin decision must NOT falsely mark ticket completed');

    report('10. Neither SLA escalation nor operational escalation closes or falsely completes tickets', true);
  } catch (err) {
    report('10. Neither SLA escalation nor operational escalation closes or falsely completes tickets', false, err);
  }

  console.log('\n------------------------------------------------------');
  console.log(` RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('------------------------------------------------------\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Fatal error in test runner:', e);
  process.exit(1);
});
