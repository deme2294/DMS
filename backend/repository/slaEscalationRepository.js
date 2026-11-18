import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export const create = async ({
  ticketId,
  slaPolicyId = null,
  slaThreshold,
  escalationLevel = 'manager',
  responsibleRecipientId = null,
  notificationStatus = 'sent',
  resolutionDeadline = null,
  breachStatus,
  notes = null,
}) => {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO ticket_sla_escalations
      (id, ticket_id, sla_policy_id, sla_threshold, trigger_time, escalation_level, responsible_recipient_id, notification_status, resolution_deadline, breach_status, notes, created_at)
     VALUES
      (:id, :ticketId, :slaPolicyId, :slaThreshold, NOW(), :escalationLevel, :responsibleRecipientId, :notificationStatus, :resolutionDeadline, :breachStatus, :notes, NOW())`,
    {
      id,
      ticketId,
      slaPolicyId,
      slaThreshold,
      escalationLevel,
      responsibleRecipientId,
      notificationStatus,
      resolutionDeadline,
      breachStatus,
      notes,
    }
  );
  return findById(id);
};

export const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT tse.*,
            sp.name AS policy_name,
            sp.priority AS policy_priority,
            CONCAT(ru.first_name, ' ', ru.last_name) AS recipient_name,
            ru.email AS recipient_email
     FROM ticket_sla_escalations tse
     LEFT JOIN sla_policies sp ON sp.id = tse.sla_policy_id
     LEFT JOIN users ru ON ru.id = tse.responsible_recipient_id
     WHERE tse.id = :id
     LIMIT 1`,
    { id }
  );
  return rows[0] || null;
};

export const findByTicketId = async (ticketId) => {
  const [rows] = await pool.query(
    `SELECT tse.*,
            sp.name AS policy_name,
            sp.priority AS policy_priority,
            CONCAT(ru.first_name, ' ', ru.last_name) AS recipient_name,
            ru.email AS recipient_email
     FROM ticket_sla_escalations tse
     LEFT JOIN sla_policies sp ON sp.id = tse.sla_policy_id
     LEFT JOIN users ru ON ru.id = tse.responsible_recipient_id
     WHERE tse.ticket_id = :ticketId
     ORDER BY tse.trigger_time DESC`,
    { ticketId }
  );
  return rows;
};
