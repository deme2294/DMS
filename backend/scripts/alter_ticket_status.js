import pool from '../config/db.js';

async function updateTicketStatusColumn() {
  console.log('Modifying tickets.status column to VARCHAR(50)...');
  await pool.query("ALTER TABLE tickets MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'open'");
  console.log('Successfully altered tickets.status to VARCHAR(50)!');

  // Also check if any existing escalated tickets that are resolved need status updated to 'escalated.resolved'
  const [res] = await pool.query(
    "UPDATE tickets SET status = 'escalated.resolved' WHERE is_escalated = 1 AND status = 'resolved'"
  );
  console.log(`Updated ${res.affectedRows} existing escalated-resolved tickets to 'escalated.resolved'.`);

  const [cols] = await pool.query("SHOW COLUMNS FROM tickets LIKE 'status'");
  console.log('New column definition:', cols[0]);

  process.exit(0);
}

updateTicketStatusColumn().catch(err => {
  console.error('Failed to update tickets.status column:', err);
  process.exit(1);
});

