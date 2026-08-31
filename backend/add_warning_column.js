import mysql from 'mysql2/promise';

async function addColumn() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'helpdesk_db'
  });

  try {
    await conn.query("ALTER TABLE tickets ADD COLUMN last_sla_warning_at DATETIME NULL AFTER is_overdue");
    await conn.query("ALTER TABLE tickets ADD INDEX idx_ticket_last_sla_warning (last_sla_warning_at)");
    console.log('✓ Added last_sla_warning_at column and index');
  } catch (err) {
    console.log('Column may already exist:', err.message);
  } finally {
    await conn.end();
  }
}

addColumn();
