import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import * as notificationService from './notificationService.js';
import * as auditService from './auditService.js';
import * as ticketRepo from '../repository/ticketRepository.js';
import { sendSLANearDeadlineEmail } from './emailService.js';
import { broadcastTicketEvent } from './socketService.js';

const ACTIVE_STATUSES = [
  'open', 'assigned', 'in_progress', 'pending',
  'waiting_tenant', 'waiting_vendor', 'escalated',
];

let timer = null;

const isActive = (status) => !['resolved', 'closed', 'completed', 'rejected', 'cancelled'].includes(status);

export const startSlaMonitor = (intervalMs = 60000) => {
  if (timer) return;

  const tick = async () => {
    try {
      await checkSlaDeadlines();
    } catch (err) {
      console.error('[SLA] Monitor check failed:', err.message);
    }
  };

  timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 5000);
  console.log(`[SLA] Monitor started (every ${intervalMs / 1000}s).`);
};

export const stopSlaMonitor = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

export const checkSlaDeadlines = async () => {
  try {
    await processNearDeadlineWarnings();
    await processResponseBreaches();
    await processEscalationBreaches();
    await processOverdueTickets();
  } catch (err) {
    console.error('[SLA] checkSlaDeadlines failed:', err.message);
  }
};

const processNearDeadlineWarnings = async () => {
  const warnings = [];

  const [responseRows] = await pool.query(
    `SELECT id, reference_number, title, priority, status, assigned_to, created_by, department_id, response_due_date
      FROM tickets
      WHERE response_due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 HOUR)
        AND status NOT IN ('resolved','closed','completed','rejected','cancelled')
        AND response_sla_breached IS NULL
        AND (last_sla_warning_at IS NULL OR last_sla_warning_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE))`
  );

  const [escalationRows] = await pool.query(
    `SELECT id, reference_number, title, priority, status, assigned_to, created_by, department_id, escalation_due_date
      FROM tickets
      WHERE escalation_due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 HOUR)
        AND status NOT IN ('resolved','closed','completed','rejected','cancelled','escalated')
        AND escalation_sla_breached IS NULL
        AND (last_sla_warning_at IS NULL OR last_sla_warning_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE))`
  );

  const [resolutionRows] = await pool.query(
    `SELECT id, reference_number, title, priority, status, assigned_to, created_by, department_id, due_date
      FROM tickets
      WHERE due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 HOUR)
        AND status NOT IN ('resolved','closed','completed','rejected','cancelled')
        AND is_overdue IS NULL
        AND (last_sla_warning_at IS NULL OR last_sla_warning_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE))`
  );

  for (const ticket of responseRows) {
    warnings.push({ ...ticket, breachType: 'response', dueDate: ticket.response_due_date });
  }
  for (const ticket of escalationRows) {
    warnings.push({ ...ticket, breachType: 'escalation', dueDate: ticket.escalation_due_date });
  }
  for (const ticket of resolutionRows) {
    warnings.push({ ...ticket, breachType: 'resolution', dueDate: ticket.due_date });
  }

  for (const ticket of warnings) {
    const dueDate = new Date(ticket.dueDate);
    const now = new Date();
    const remainingMs = dueDate.getTime() - now.getTime();
    const remainingHours = Math.max(0, remainingMs / (1000 * 60 * 60)).toFixed(1);

    await pool.query(
      'UPDATE tickets SET last_sla_warning_at = NOW(), updated_at = NOW() WHERE id = :id',
      { id: ticket.id }
    );

    await notificationService.notifySLANearDeadline(
      { ...ticket, id: ticket.id, reference_number: ticket.reference_number, title: ticket.title, priority: ticket.priority, status: ticket.status, assigned_to: ticket.assigned_to, created_by: ticket.created_by, department_id: ticket.department_id },
      ticket.breachType,
      remainingHours
    );

    if (ticket.assigned_to) {
      const [staffRows] = await pool.query('SELECT email, first_name FROM users WHERE id = :id LIMIT 1', { id: ticket.assigned_to });
      if (staffRows.length) {
        await sendSLANearDeadlineEmail({
          email: staffRows[0].email,
          firstName: staffRows[0].first_name,
          ticket: { ...ticket, reference_number: ticket.reference_number, title: ticket.title, priority: ticket.priority, status: ticket.status },
          breachType: ticket.breachType,
          remainingHours,
        }).catch(() => {});
      }
    }

    await auditService.logAction(
      null, 'sla_warning', 'ticket', ticket.id, null,
      { type: ticket.breachType, field: 'last_sla_warning_at', dueDate: ticket.dueDate, remainingHours },
      { role: 'system' }
    );
  }
};

const processResponseBreaches = async () => {
  const [rows] = await pool.query(
    `SELECT id, reference_number, title, priority, status, assigned_to, created_by, department_id, response_due_date
      FROM tickets
      WHERE response_due_date < NOW()
        AND status NOT IN ('resolved','closed','completed','rejected','cancelled')
        AND response_sla_breached IS NULL`
  );

  for (const ticket of rows) {
    await pool.query(
      'UPDATE tickets SET response_sla_breached = 1, updated_at = NOW() WHERE id = :id',
      { id: ticket.id }
    );
    await auditService.logAction(
      null, 'sla_breach', 'ticket', ticket.id, null,
      { type: 'response', field: 'response_sla_breached', dueDate: ticket.response_due_date },
      { role: 'system' }
    );
    await notificationService.notifySLABreached({ ...ticket, id: ticket.id, reference_number: ticket.reference_number, title: ticket.title, priority: ticket.priority, status: ticket.status, assigned_to: ticket.assigned_to, created_by: ticket.created_by, department_id: ticket.department_id, response_due_date: ticket.response_due_date }, 'response');
    broadcastTicketEvent(ticket.id, 'ticket:updated', { ticketId: ticket.id });
  }
};

const processEscalationBreaches = async () => {
  const [rows] = await pool.query(
    `SELECT id, reference_number, title, priority, status, assigned_to, created_by, department_id, escalation_due_date
      FROM tickets
      WHERE escalation_due_date < NOW()
        AND status NOT IN ('resolved','closed','completed','rejected','cancelled','escalated')
        AND escalation_sla_breached IS NULL`
  );

  for (const ticket of rows) {
    const prevStatus = ticket.status;
    await pool.query(
      `UPDATE tickets
       SET status = 'escalated', escalation_sla_breached = 1, is_escalated = 1, escalated_at = NOW(), updated_at = NOW()
       WHERE id = :id`,
      { id: ticket.id }
    );
    await ticketRepo.logStatusHistory({
      id: uuidv4(),
      ticketId: ticket.id,
      fromStatus: prevStatus,
      toStatus: 'escalated',
      notes: `Ticket automatically escalated due to Escalation SLA policy breach (due: ${ticket.escalation_due_date})`,
      role: 'system',
    }).catch(() => {});

    await auditService.logAction(
      null, 'sla_escalation', 'ticket', ticket.id, null,
      { type: 'escalation', field: 'escalation_sla_breached', dueDate: ticket.escalation_due_date, fromStatus: prevStatus, newStatus: 'escalated' },
      { role: 'system' }
    );
    await notificationService.notifySLABreached({ ...ticket, id: ticket.id, reference_number: ticket.reference_number, title: ticket.title, priority: ticket.priority, status: 'escalated', assigned_to: ticket.assigned_to, created_by: ticket.created_by, department_id: ticket.department_id, escalation_due_date: ticket.escalation_due_date }, 'escalation');
    broadcastTicketEvent(ticket.id, 'ticket:updated', { ticketId: ticket.id, status: 'escalated', isEscalated: true });
  }
};

const processOverdueTickets = async () => {
  const [rows] = await pool.query(
    `SELECT id, reference_number, title, priority, status, assigned_to, created_by, department_id, due_date
      FROM tickets
      WHERE due_date < NOW()
        AND status NOT IN ('resolved','closed','completed','rejected','cancelled','escalated')
        AND (is_overdue IS NULL OR is_overdue = 0)`
  );

  for (const ticket of rows) {
    const prevStatus = ticket.status;
    await pool.query(
      `UPDATE tickets
       SET status = 'escalated', is_overdue = 1, is_escalated = 1, escalated_at = NOW(), updated_at = NOW()
       WHERE id = :id`,
      { id: ticket.id }
    );
    await ticketRepo.logStatusHistory({
      id: uuidv4(),
      ticketId: ticket.id,
      fromStatus: prevStatus,
      toStatus: 'escalated',
      notes: `Ticket automatically escalated due to Resolution SLA deadline breach (due: ${ticket.due_date})`,
      role: 'system',
    }).catch(() => {});

    await auditService.logAction(
      null, 'ticket_overdue', 'ticket', ticket.id, null,
      { type: 'resolution', field: 'is_overdue', dueDate: ticket.due_date, fromStatus: prevStatus, newStatus: 'escalated' },
      { role: 'system' }
    );
    await notificationService.notifySLABreached({ ...ticket, id: ticket.id, reference_number: ticket.reference_number, title: ticket.title, priority: ticket.priority, status: 'escalated', assigned_to: ticket.assigned_to, created_by: ticket.created_by, department_id: ticket.department_id, due_date: ticket.due_date }, 'resolution');
    broadcastTicketEvent(ticket.id, 'ticket:updated', { ticketId: ticket.id, status: 'escalated', isEscalated: true, isOverdue: true });
  }
};

