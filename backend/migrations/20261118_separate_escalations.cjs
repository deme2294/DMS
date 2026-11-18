const mysql = require('../node_modules/mysql2/promise');
const dotenv = require('../node_modules/dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dms',
  port: process.env.DB_PORT || 3306,
});

async function runMigration() {
  console.log('Running separate escalation migration...');

  // 1. Add columns to tickets table if they do not exist
  const [cols] = await pool.query(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tickets'
  `, [process.env.DB_NAME || 'dms']);
  const colNames = cols.map(c => c.COLUMN_NAME);

  if (!colNames.includes('sla_status')) {
    console.log('Adding tickets.sla_status column...');
    await pool.query(`
      ALTER TABLE tickets 
      ADD COLUMN sla_status ENUM('within_target', 'approaching_deadline', 'response_breached', 'escalation_triggered', 'resolution_breached', 'completed_successfully') DEFAULT 'within_target'
    `);
  }

  if (!colNames.includes('operational_escalation_status')) {
    console.log('Adding tickets.operational_escalation_status column...');
    await pool.query(`
      ALTER TABLE tickets 
      ADD COLUMN operational_escalation_status ENUM('none', 'pending_manager', 'pending_admin', 'guidance_provided', 'reassigned', 'collaborative', 'resolved') DEFAULT 'none'
    `);
  }

  if (!colNames.includes('operational_escalation_reason')) {
    console.log('Adding tickets.operational_escalation_reason column...');
    await pool.query(`
      ALTER TABLE tickets 
      ADD COLUMN operational_escalation_reason VARCHAR(255) NULL
    `);
  }

  // 2. Create ticket_operational_escalations table
  console.log('Creating ticket_operational_escalations table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_operational_escalations (
      id VARCHAR(36) PRIMARY KEY,
      ticket_id VARCHAR(36) NOT NULL,
      requesting_user_id VARCHAR(36) NOT NULL,
      department_id VARCHAR(36) NULL,
      escalation_reason VARCHAR(255) NOT NULL,
      problem_description TEXT NOT NULL,
      actions_attempted TEXT NOT NULL,
      assistance_required TEXT NOT NULL,
      destination ENUM('manager', 'admin') DEFAULT 'manager',
      manager_id VARCHAR(36) NULL,
      manager_decision ENUM('guidance', 'reassign', 'collaborate', 'investigate', 'escalate_to_admin', 'pending') DEFAULT 'pending',
      manager_notes TEXT NULL,
      manager_decided_at DATETIME NULL,
      admin_id VARCHAR(36) NULL,
      admin_decision ENUM('approved', 'guidance', 'reassign', 'resource_allocated', 'rejected', 'pending') DEFAULT 'pending',
      admin_notes TEXT NULL,
      admin_decided_at DATETIME NULL,
      status ENUM('pending_manager', 'pending_admin', 'guidance_provided', 'reassigned', 'collaborative', 'resolved', 'closed') DEFAULT 'pending_manager',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_toe_ticket (ticket_id),
      INDEX idx_toe_status (status),
      INDEX idx_toe_dept (department_id),
      INDEX idx_toe_req_user (requesting_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 3. Create ticket_collaborators table
  console.log('Creating ticket_collaborators table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_collaborators (
      id VARCHAR(36) PRIMARY KEY,
      ticket_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      assigned_by VARCHAR(36) NOT NULL,
      role VARCHAR(100) DEFAULT 'collaborator',
      notes TEXT NULL,
      contribution_notes TEXT NULL,
      in_person_notes TEXT NULL,
      status ENUM('active', 'completed', 'removed') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tc_ticket (ticket_id),
      INDEX idx_tc_user (user_id),
      UNIQUE KEY uq_ticket_user (ticket_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 4. Create ticket_sla_escalations table
  console.log('Creating ticket_sla_escalations table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_sla_escalations (
      id VARCHAR(36) PRIMARY KEY,
      ticket_id VARCHAR(36) NOT NULL,
      sla_policy_id VARCHAR(36) NULL,
      sla_threshold VARCHAR(100) NOT NULL,
      trigger_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      escalation_level VARCHAR(50) DEFAULT 'manager',
      responsible_recipient_id VARCHAR(36) NULL,
      notification_status VARCHAR(50) DEFAULT 'sent',
      resolution_deadline DATETIME NULL,
      breach_status VARCHAR(50) NOT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tse_ticket (ticket_id),
      INDEX idx_tse_trigger (trigger_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Backfill existing tickets' sla_status from existing flags if needed
  console.log('Backfilling initial sla_status for existing tickets...');
  await pool.query(`
    UPDATE tickets
    SET sla_status = CASE
      WHEN status IN ('resolved', 'closed', 'completed') AND sla_achieved = 1 THEN 'completed_successfully'
      WHEN is_overdue = 1 THEN 'resolution_breached'
      WHEN escalation_sla_breached = 1 THEN 'escalation_triggered'
      WHEN response_sla_breached = 1 THEN 'response_breached'
      ELSE 'within_target'
    END
    WHERE sla_status IS NULL OR sla_status = 'within_target'
  `);

  console.log('Migration completed successfully!');
  await pool.end();
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
