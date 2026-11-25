const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'helpdesk_db',
  });

  console.log('Connected to DB');

  // 1. ticket_categories: reassign_time_minutes
  try {
    const [cols] = await connection.query("SHOW COLUMNS FROM ticket_categories LIKE 'reassign_time_minutes'");
    if (cols.length === 0) {
      await connection.query("ALTER TABLE ticket_categories ADD COLUMN reassign_time_minutes INT NOT NULL DEFAULT 30 AFTER routing_type");
      console.log('Added reassign_time_minutes to ticket_categories');
    } else {
      console.log('ticket_categories.reassign_time_minutes already exists');
    }
  } catch (err) {
    console.error('Error altering ticket_categories:', err.message);
  }

  // 2. assignments: department_id
  try {
    const [cols] = await connection.query("SHOW COLUMNS FROM assignments LIKE 'department_id'");
    if (cols.length === 0) {
      await connection.query("ALTER TABLE assignments ADD COLUMN department_id CHAR(36) NULL AFTER ticket_id");
      console.log('Added department_id to assignments');
    } else {
      console.log('assignments.department_id already exists');
    }
  } catch (err) {
    console.error('Error altering assignments:', err.message);
  }

  // 3. Backfill department_id on existing assignments from tickets table
  try {
    await connection.query(`
      UPDATE assignments a
      JOIN tickets t ON t.id = a.ticket_id
      SET a.department_id = t.department_id
      WHERE a.department_id IS NULL AND t.department_id IS NOT NULL
    `);
    console.log('Backfilled assignments.department_id from tickets');
  } catch (err) {
    console.error('Error backfilling assignments.department_id:', err.message);
  }

  // 4. Grant tickets.escalate to staff role (role_id: 3, permission_id: 14)
  try {
    const [exists] = await connection.query("SELECT 1 FROM role_permissions WHERE role_id = 3 AND permission_id = 14 LIMIT 1");
    if (exists.length === 0) {
      await connection.query("INSERT INTO role_permissions (role_id, permission_id) VALUES (3, 14)");
      console.log('Granted tickets.escalate to staff role (role_id: 3)');
    } else {
      console.log('Staff role already has tickets.escalate');
    }
  } catch (err) {
    console.error('Error granting tickets.escalate to staff:', err.message);
  }

  await connection.end();
  console.log('Migration complete');
}

migrate().catch(console.error);
