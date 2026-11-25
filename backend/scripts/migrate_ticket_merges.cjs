const pool = require('../config/db.js').default || require('../config/db.js');

async function migrate() {
  console.log('--- Starting safe migration for Duplicate Ticket Detection and Merging ---');

  // 1. Add merged_at, merged_by, merge_reason to tickets if not present
  const [cols] = await pool.query('DESCRIBE tickets');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('merged_at')) {
    await pool.query('ALTER TABLE tickets ADD COLUMN merged_at DATETIME NULL');
    console.log('✓ Added merged_at to tickets');
  }
  if (!colNames.includes('merged_by')) {
    await pool.query('ALTER TABLE tickets ADD COLUMN merged_by CHAR(36) NULL');
    console.log('✓ Added merged_by to tickets');
  }
  if (!colNames.includes('merge_reason')) {
    await pool.query('ALTER TABLE tickets ADD COLUMN merge_reason TEXT NULL');
    console.log('✓ Added merge_reason to tickets');
  }

  // 2. Create ticket_merges table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_merges (
      id CHAR(36) PRIMARY KEY,
      primary_ticket_id CHAR(36) NOT NULL,
      merged_ticket_id CHAR(36) NOT NULL,
      merged_by CHAR(36) NOT NULL,
      reason TEXT NOT NULL,
      similarity_score DECIMAL(5,2) NULL,
      original_status VARCHAR(50) NOT NULL,
      original_sla_status VARCHAR(50) NULL,
      original_due_date DATETIME NULL,
      original_response_due_date DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_primary_ticket (primary_ticket_id),
      INDEX idx_merged_ticket (merged_ticket_id),
      INDEX idx_merged_by (merged_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ ticket_merges table confirmed/created');

  // 3. Ensure permissions tickets.merge exists in permissions table if table exists
  try {
    const [permCheck] = await pool.query("SELECT * FROM permissions WHERE name = 'tickets.merge'");
    if (!permCheck.length) {
      await pool.query("INSERT INTO permissions (name, description) VALUES ('tickets.merge', 'Merge duplicate tickets')");
      console.log("✓ Added 'tickets.merge' permission");
    }
  } catch (e) {
    // Permission table might vary, ignore
  }

  console.log('--- Migration completed successfully ---');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
