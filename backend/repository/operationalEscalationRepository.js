import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export const create = async ({
  ticketId,
  requestingUserId,
  departmentId,
  escalationReason,
  problemDescription,
  actionsAttempted,
  assistanceRequired,
  destination = 'manager',
  managerId = null,
  status = 'pending_manager',
}) => {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO ticket_operational_escalations
      (id, ticket_id, requesting_user_id, department_id, escalation_reason, problem_description, actions_attempted, assistance_required, destination, manager_id, status, created_at, updated_at)
     VALUES
      (:id, :ticketId, :requestingUserId, :departmentId, :escalationReason, :problemDescription, :actionsAttempted, :assistanceRequired, :destination, :managerId, :status, NOW(), NOW())`,
    {
      id,
      ticketId,
      requestingUserId,
      departmentId,
      escalationReason,
      problemDescription,
      actionsAttempted,
      assistanceRequired,
      destination,
      managerId,
      status,
    }
  );
  return findById(id);
};

export const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT toe.*,
            CONCAT(ru.first_name, ' ', ru.last_name) AS requesting_user_name,
            ru.email AS requesting_user_email,
            d.name AS department_name,
            CONCAT(mu.first_name, ' ', mu.last_name) AS manager_name,
            mu.email AS manager_email,
            CONCAT(au.first_name, ' ', au.last_name) AS admin_name,
            au.email AS admin_email
     FROM ticket_operational_escalations toe
     LEFT JOIN users ru ON ru.id = toe.requesting_user_id
     LEFT JOIN departments d ON d.id = toe.department_id
     LEFT JOIN users mu ON mu.id = toe.manager_id
     LEFT JOIN users au ON au.id = toe.admin_id
     WHERE toe.id = :id
     LIMIT 1`,
    { id }
  );
  return rows[0] || null;
};

export const findByTicketId = async (ticketId) => {
  const [rows] = await pool.query(
    `SELECT toe.*,
            CONCAT(ru.first_name, ' ', ru.last_name) AS requesting_user_name,
            ru.email AS requesting_user_email,
            d.name AS department_name,
            CONCAT(mu.first_name, ' ', mu.last_name) AS manager_name,
            mu.email AS manager_email,
            CONCAT(au.first_name, ' ', au.last_name) AS admin_name,
            au.email AS admin_email
     FROM ticket_operational_escalations toe
     LEFT JOIN users ru ON ru.id = toe.requesting_user_id
     LEFT JOIN departments d ON d.id = toe.department_id
     LEFT JOIN users mu ON mu.id = toe.manager_id
     LEFT JOIN users au ON au.id = toe.admin_id
     WHERE toe.ticket_id = :ticketId
     ORDER BY toe.created_at DESC`,
    { ticketId }
  );
  return rows;
};

export const findActiveByTicketId = async (ticketId) => {
  const [rows] = await pool.query(
    `SELECT toe.*,
            CONCAT(ru.first_name, ' ', ru.last_name) AS requesting_user_name,
            ru.email AS requesting_user_email,
            d.name AS department_name,
            CONCAT(mu.first_name, ' ', mu.last_name) AS manager_name,
            mu.email AS manager_email,
            CONCAT(au.first_name, ' ', au.last_name) AS admin_name,
            au.email AS admin_email
     FROM ticket_operational_escalations toe
     LEFT JOIN users ru ON ru.id = toe.requesting_user_id
     LEFT JOIN departments d ON d.id = toe.department_id
     LEFT JOIN users mu ON mu.id = toe.manager_id
     LEFT JOIN users au ON au.id = toe.admin_id
     WHERE toe.ticket_id = :ticketId
       AND toe.status IN ('pending_manager', 'pending_admin', 'collaborative')
     ORDER BY toe.created_at DESC
     LIMIT 1`,
    { ticketId }
  );
  return rows[0] || null;
};

export const update = async (id, fields) => {
  const allowed = [
    'destination',
    'manager_id',
    'manager_decision',
    'manager_notes',
    'manager_decided_at',
    'admin_id',
    'admin_decision',
    'admin_notes',
    'admin_decided_at',
    'status',
  ];

  const setClauses = [];
  const params = { id };

  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) {
      setClauses.push(`${k} = :${k}`);
      params[k] = v;
    }
  }

  if (setClauses.length === 0) return findById(id);

  setClauses.push('updated_at = NOW()');

  await pool.query(
    `UPDATE ticket_operational_escalations SET ${setClauses.join(', ')} WHERE id = :id`,
    params
  );
  return findById(id);
};
