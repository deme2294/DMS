import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export const add = async ({
  ticketId,
  userId,
  assignedBy,
  role = 'collaborator',
  notes = null,
  inPersonNotes = null,
}) => {
  const existing = await findByTicketAndUser(ticketId, userId);
  if (existing) {
    if (existing.status !== 'active') {
      await pool.query(
        `UPDATE ticket_collaborators
         SET status = 'active', role = :role, notes = COALESCE(:notes, notes), assigned_by = :assignedBy, updated_at = NOW()
         WHERE id = :id`,
        { id: existing.id, role, notes, assignedBy }
      );
      return findById(existing.id);
    }
    return existing;
  }

  const id = uuidv4();
  await pool.query(
    `INSERT INTO ticket_collaborators
      (id, ticket_id, user_id, assigned_by, role, notes, in_person_notes, status, created_at, updated_at)
     VALUES
      (:id, :ticketId, :userId, :assignedBy, :role, :notes, :inPersonNotes, 'active', NOW(), NOW())`,
    {
      id,
      ticketId,
      userId,
      assignedBy,
      role,
      notes,
      inPersonNotes,
    }
  );
  return findById(id);
};

export const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT tc.*,
            u.first_name, u.last_name, u.email,
            r.name AS user_role,
            d.name AS department_name,
            CONCAT(ab.first_name, ' ', ab.last_name) AS assigned_by_name
     FROM ticket_collaborators tc
     JOIN users u ON u.id = tc.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_departments ud ON ud.user_id = u.id
     LEFT JOIN departments d ON d.id = ud.department_id
     LEFT JOIN users ab ON ab.id = tc.assigned_by
     WHERE tc.id = :id
     LIMIT 1`,
    { id }
  );
  return rows[0] || null;
};

export const findByTicketId = async (ticketId) => {
  const [rows] = await pool.query(
    `SELECT tc.*,
            u.first_name, u.last_name, u.email,
            r.name AS user_role,
            d.name AS department_name,
            CONCAT(ab.first_name, ' ', ab.last_name) AS assigned_by_name
     FROM ticket_collaborators tc
     JOIN users u ON u.id = tc.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_departments ud ON ud.user_id = u.id
     LEFT JOIN departments d ON d.id = ud.department_id
     LEFT JOIN users ab ON ab.id = tc.assigned_by
     WHERE tc.ticket_id = :ticketId
     ORDER BY tc.created_at ASC`,
    { ticketId }
  );
  return rows;
};

export const findByTicketAndUser = async (ticketId, userId) => {
  const [rows] = await pool.query(
    `SELECT tc.*
     FROM ticket_collaborators tc
     WHERE tc.ticket_id = :ticketId AND tc.user_id = :userId
     LIMIT 1`,
    { ticketId, userId }
  );
  return rows[0] || null;
};

export const update = async (id, fields) => {
  const allowed = ['role', 'notes', 'contribution_notes', 'in_person_notes', 'status'];
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
    `UPDATE ticket_collaborators SET ${setClauses.join(', ')} WHERE id = :id`,
    params
  );
  return findById(id);
};

export const recordContribution = async (ticketId, userId, { contributionNotes, inPersonNotes }) => {
  const [rows] = await pool.query(
    `SELECT id, contribution_notes, in_person_notes
     FROM ticket_collaborators
     WHERE ticket_id = :ticketId AND user_id = :userId
     LIMIT 1`,
    { ticketId, userId }
  );

  if (!rows[0]) {
    // If not yet an explicit collaborator, auto-register as contributing staff
    const id = uuidv4();
    await pool.query(
      `INSERT INTO ticket_collaborators
        (id, ticket_id, user_id, assigned_by, role, contribution_notes, in_person_notes, status, created_at, updated_at)
       VALUES
        (:id, :ticketId, :userId, :userId, 'contributor', :contributionNotes, :inPersonNotes, 'active', NOW(), NOW())`,
      {
        id,
        ticketId,
        userId,
        contributionNotes: contributionNotes || null,
        inPersonNotes: inPersonNotes || null,
      }
    );
    return findById(id);
  }

  const existing = rows[0];
  const combinedContrib = contributionNotes 
    ? (existing.contribution_notes ? `${existing.contribution_notes}\n---\n${contributionNotes}` : contributionNotes)
    : existing.contribution_notes;

  const combinedInPerson = inPersonNotes
    ? (existing.in_person_notes ? `${existing.in_person_notes}\n---\n${inPersonNotes}` : inPersonNotes)
    : existing.in_person_notes;

  await pool.query(
    `UPDATE ticket_collaborators
     SET contribution_notes = :combinedContrib,
         in_person_notes = :combinedInPerson,
         updated_at = NOW()
     WHERE id = :id`,
    {
      id: existing.id,
      combinedContrib,
      combinedInPerson,
    }
  );

  return findById(existing.id);
};

export const remove = async (ticketId, userId) => {
  await pool.query(
    `UPDATE ticket_collaborators
     SET status = 'removed', updated_at = NOW()
     WHERE ticket_id = :ticketId AND user_id = :userId`,
    { ticketId, userId }
  );
  return true;
};

export const isCollaborator = async (ticketId, userId) => {
  const [rows] = await pool.query(
    `SELECT 1 FROM ticket_collaborators
     WHERE ticket_id = :ticketId AND user_id = :userId AND status = 'active'
     LIMIT 1`,
    { ticketId, userId }
  );
  return rows.length > 0;
};
