import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Single source of truth for schema: sql/database.sql
// Future schema additions must go into database.sql, not split files.
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'helpdesk_db',
  multipleStatements: true,
};

async function runMigration() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('Database connected successfully\n');

    // Check what already exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME IN ('ticket_categories', 'sla_policies', 'ticket_category_requests', 'notices', 'feedback', 'knowledge_base', 'office_locations', 'notice_recipients', 'audit_logs')
    `, [DB_CONFIG.database]);

    const existingTables = tables.map(t => t.TABLE_NAME);
    console.log('Existing tables:', existingTables.length > 0 ? existingTables.join(', ') : 'none');

    // Check tickets columns
    const [ticketCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tickets'
        AND COLUMN_NAME IN ('response_due_date', 'escalation_due_date', 'is_overdue', 'sla_achieved', 'response_sla_breached', 'escalation_sla_breached')
    `, [DB_CONFIG.database]);
    
    const existingCols = ticketCols.map(c => c.COLUMN_NAME);
    console.log('Existing SLA columns:', existingCols.length > 0 ? existingCols.join(', ') : 'none');

    // Check audit_logs columns
    const [auditCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'audit_logs'
        AND COLUMN_NAME IN ('role', 'old_value', 'new_value', 'browser')
    `, [DB_CONFIG.database]);
    
    const existingAuditCols = auditCols.map(c => c.COLUMN_NAME);
    console.log('Existing audit columns:', existingAuditCols.length > 0 ? existingAuditCols.join(', ') : 'none');
    console.log();

    // Run migrations in order
    const migrationSteps = [
      {
        name: 'Missing tables and permissions',
        sql: `
          CREATE TABLE IF NOT EXISTS notices (
            id CHAR(36) PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            image VARCHAR(255),
            attachment VARCHAR(500),
            attachment_name VARCHAR(255),
            priority ENUM('low','medium','high') DEFAULT 'medium',
            status ENUM('draft','published','archived') DEFAULT 'draft',
            target_audience ENUM('all','admin','manager','staff','tenant','department') DEFAULT 'all',
            expires_at DATETIME NULL,
            expiry_warned TINYINT(1) NOT NULL DEFAULT 0,
            created_by CHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS feedback (
            id CHAR(36) PRIMARY KEY,
            tenant_id CHAR(36) NULL,
            subject VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            rating INT,
            status ENUM('pending','read','resolved') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS feedback_replies (
            id CHAR(36) PRIMARY KEY,
            feedback_id CHAR(36) NOT NULL,
            replied_by CHAR(36) NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS knowledge_base (
            id CHAR(36) PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            content TEXT NOT NULL,
            category VARCHAR(100),
            tags VARCHAR(500),
            attachment VARCHAR(500),
            attachment_name VARCHAR(255),
            status ENUM('draft','published') DEFAULT 'draft',
            author_id CHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS office_locations (
            id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            employee_name VARCHAR(150) NOT NULL,
            employee_number VARCHAR(50),
            email VARCHAR(150),
            phone_extension VARCHAR(20),
            office_number VARCHAR(50),
            floor VARCHAR(20),
            building VARCHAR(100),
            building_id CHAR(36) NULL,
            description TEXT,
            map_coordinates VARCHAR(255),
            capacity INT DEFAULT 0,
            amenities VARCHAR(500),
            availability_status ENUM('available','occupied','maintenance') DEFAULT 'available',
            price_per_month DECIMAL(10,2) DEFAULT 0,
            latitude DECIMAL(10,8) DEFAULT NULL,
            longitude DECIMAL(10,8) DEFAULT NULL,
            address VARCHAR(255),
            contact_person VARCHAR(150),
            contact_phone VARCHAR(20),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS notice_recipients (
            id CHAR(36) PRIMARY KEY,
            notice_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            acknowledged_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_notice_user (notice_id, user_id),
            KEY idx_notice_recipients_notice (notice_id),
            KEY idx_notice_recipients_user (user_id)
          );
        `
      },
      {
        name: 'Ticket categories table',
        sql: `
          CREATE TABLE IF NOT EXISTS ticket_categories (
            id CHAR(36) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(255) NULL,
            department_id CHAR(36) NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_by CHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_category_name (name)
          );
        `
      },
      {
        name: 'SLA policies table',
        sql: `
          CREATE TABLE IF NOT EXISTS sla_policies (
            id CHAR(36) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            priority ENUM('low','medium','high','urgent') NOT NULL,
            response_hours INT NOT NULL DEFAULT 4,
            resolution_hours INT NOT NULL DEFAULT 24,
            description VARCHAR(255) NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_sla_priority (priority)
          );
        `
      },
      {
        name: 'Ticket category requests table',
        sql: `
          CREATE TABLE IF NOT EXISTS ticket_category_requests (
            id CHAR(36) PRIMARY KEY,
            category_id CHAR(36) NOT NULL,
            requested_by CHAR(36) NULL,
            department_id CHAR(36) NULL,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(255) NULL,
            status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
            reviewed_by CHAR(36) NULL,
            reviewed_at DATETIME NULL,
            review_notes VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_tcr_category (category_id),
            KEY idx_tcr_status (status)
          );
        `
      },
      {
        name: 'Ticket categories approval workflow columns',
        sql: `
          SET @col_exists := (
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_categories' AND COLUMN_NAME = 'status'
          );
          SET @sql := IF(@col_exists = 0,
            "ALTER TABLE ticket_categories
               ADD COLUMN status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
               ADD COLUMN sla_policy_id CHAR(36) NULL,
               ADD COLUMN requested_by CHAR(36) NULL,
               ADD COLUMN reviewed_by CHAR(36) NULL,
               ADD COLUMN reviewed_at DATETIME NULL,
               ADD COLUMN review_notes VARCHAR(255) NULL",
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;
        `
      },
      {
        name: 'SLA per-category columns',
        sql: `
          SET @col_exists := (
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND COLUMN_NAME = 'category_id'
          );
          SET @sql := IF(@col_exists = 0,
            "ALTER TABLE sla_policies
               ADD COLUMN category_id CHAR(36) NULL AFTER priority,
               ADD COLUMN escalation_hours INT DEFAULT 0 AFTER resolution_hours,
               ADD COLUMN working_hours JSON NULL AFTER escalation_hours",
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;

          DROP INDEX IF EXISTS uq_sla_priority ON sla_policies;

          SET @uq_exists := (
            SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND INDEX_NAME = 'uq_sla_category_priority'
          );
          SET @sql := IF(@uq_exists = 0,
            'ALTER TABLE sla_policies ADD UNIQUE KEY uq_sla_category_priority (category_id, priority)',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;
        `
      },
      {
        name: 'Tickets SLA and warning columns',
        sql: `
          SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'response_due_date');
          SET @s := IF(@c = 0, 'ALTER TABLE tickets ADD COLUMN response_due_date DATETIME NULL', 'SELECT 1');
          PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

          SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'escalation_due_date');
          SET @s := IF(@c = 0, 'ALTER TABLE tickets ADD COLUMN escalation_due_date DATETIME NULL', 'SELECT 1');
          PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

          SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'response_sla_breached');
          SET @s := IF(@c = 0, 'ALTER TABLE tickets ADD COLUMN response_sla_breached TINYINT(1) DEFAULT 0', 'SELECT 1');
          PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

          SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'escalation_sla_breached');
          SET @s := IF(@c = 0, 'ALTER TABLE tickets ADD COLUMN escalation_sla_breached TINYINT(1) DEFAULT 0', 'SELECT 1');
          PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

          SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'sla_achieved');
          SET @s := IF(@c = 0, 'ALTER TABLE tickets ADD COLUMN sla_achieved TINYINT(1) DEFAULT 0', 'SELECT 1');
          PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

          SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'is_overdue');
          SET @s := IF(@c = 0, 'ALTER TABLE tickets ADD COLUMN is_overdue TINYINT(1) DEFAULT 0', 'SELECT 1');
          PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

          SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'last_sla_warning_at');
          SET @s := IF(@c = 0, 'ALTER TABLE tickets ADD COLUMN last_sla_warning_at DATETIME NULL', 'SELECT 1');
          PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

          SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notices' AND COLUMN_NAME = 'expiry_warned');
          SET @s := IF(@c = 0, 'ALTER TABLE notices ADD COLUMN expiry_warned TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
          PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

          SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'notice_id');
          SET @s := IF(@c = 0, 'ALTER TABLE notifications ADD COLUMN notice_id CHAR(36) NULL', 'SELECT 1');
          PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

          SET @idx_exists := (
            SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_response_due'
          );
          SET @sql := IF(@idx_exists = 0,
            'ALTER TABLE tickets ADD INDEX idx_ticket_response_due (response_due_date)',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

          SET @idx_exists := (
            SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_escalation_due'
          );
          SET @sql := IF(@idx_exists = 0,
            'ALTER TABLE tickets ADD INDEX idx_ticket_escalation_due (escalation_due_date)',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

          SET @idx_exists := (
            SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_is_overdue'
          );
          SET @sql := IF(@idx_exists = 0,
            'ALTER TABLE tickets ADD INDEX idx_ticket_is_overdue (is_overdue)',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

          SET @idx_exists := (
            SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_last_sla_warning'
          );
          SET @sql := IF(@idx_exists = 0,
            'ALTER TABLE tickets ADD INDEX idx_ticket_last_sla_warning (last_sla_warning_at)',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
        `
      },
      {
        name: 'Audit logs columns',
        sql: `
          SET @col_exists := (
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'role'
          );
          SET @sql := IF(@col_exists = 0,
            "ALTER TABLE audit_logs
               ADD COLUMN role VARCHAR(50) NULL,
               ADD COLUMN old_value JSON NULL,
               ADD COLUMN new_value JSON NULL,
               ADD COLUMN browser VARCHAR(255) NULL",
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;
        `
      },
      {
        name: 'Ticket status history columns',
        sql: `
          SET @col_exists := (
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_status_history' AND COLUMN_NAME = 'role'
          );
          SET @sql := IF(@col_exists = 0,
            "ALTER TABLE ticket_status_history
               ADD COLUMN role VARCHAR(50) NULL,
               ADD COLUMN browser VARCHAR(255) NULL",
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;
        `
      },
      {
        name: 'Ticket replies columns',
        sql: `
          SET @col_exists := (
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_replies' AND COLUMN_NAME = 'type'
          );
          SET @sql := IF(@col_exists = 0,
            "ALTER TABLE ticket_replies
               ADD COLUMN type ENUM('comment','note','reply') NOT NULL DEFAULT 'reply',
               ADD COLUMN is_internal TINYINT(1) NOT NULL DEFAULT 0",
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;
        `
      },
      {
        name: 'Notifications type enum',
        sql: `
          SET @type_ok := (
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
              AND COLUMN_TYPE LIKE '%''escalation''%'
          );
          SET @sql := IF(@type_ok = 0,
            "ALTER TABLE notifications MODIFY COLUMN type ENUM(
               'ticket','reply','status','assignment','notice',
               'category','sla','escalation','completion','approval',
               'rejection','reopen','merge','note','internal'
             ) DEFAULT 'ticket'",
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;
        `
      },
      {
        name: 'Tickets workflow timestamps',
        sql: `
          SET @col_exists := (
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'sla_policy_id'
          );
          SET @sql := IF(@col_exists = 0,
            "ALTER TABLE tickets
               ADD COLUMN sla_policy_id CHAR(36) NULL,
               ADD COLUMN completed_at DATETIME NULL,
               ADD COLUMN approved_at DATETIME NULL,
               ADD COLUMN escalated_at DATETIME NULL,
               ADD COLUMN reopened_at DATETIME NULL,
               ADD COLUMN cancelled_at DATETIME NULL,
               ADD COLUMN auto_department_id CHAR(36) NULL,
               ADD COLUMN merged_into CHAR(36) NULL",
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;
        `
      },
      {
        name: 'Foreign keys',
        sql: `
          SET @fk_exists := (
            SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_categories' AND CONSTRAINT_NAME = 'fk_tc_created_by'
          );
          SET @sql := IF(@fk_exists = 0,
            'ALTER TABLE ticket_categories ADD CONSTRAINT fk_tc_created_by FOREIGN KEY (created_by) REFERENCES users(id)',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;

          SET @fk_exists := (
            SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_categories' AND CONSTRAINT_NAME = 'fk_tc_department'
          );
          SET @sql := IF(@fk_exists = 0,
            'ALTER TABLE ticket_categories ADD CONSTRAINT fk_tc_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;

          SET @fk_exists := (
            SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_categories' AND CONSTRAINT_NAME = 'fk_tc_sla_policy'
          );
          SET @sql := IF(@fk_exists = 0,
            'ALTER TABLE ticket_categories ADD CONSTRAINT fk_tc_sla_policy FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE SET NULL',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;

          SET @fk_exists := (
            SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_category_requests' AND CONSTRAINT_NAME = 'fk_tcr_category'
          );
          SET @sql := IF(@fk_exists = 0,
            'ALTER TABLE ticket_category_requests ADD CONSTRAINT fk_tcr_category FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;

          SET @fk_exists := (
            SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND CONSTRAINT_NAME = 'fk_sla_category'
          );
          SET @sql := IF(@fk_exists = 0,
            'ALTER TABLE sla_policies ADD CONSTRAINT fk_sla_category FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;

          SET @fk_exists := (
            SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND CONSTRAINT_NAME = 'fk_ticket_sla'
          );
          SET @sql := IF(@fk_exists = 0,
            'ALTER TABLE tickets ADD CONSTRAINT fk_ticket_sla FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE SET NULL',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;

          SET @fk_exists := (
            SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notices' AND CONSTRAINT_NAME = 'fk_notice_user'
          );
          SET @sql := IF(@fk_exists = 0,
            'ALTER TABLE notices ADD CONSTRAINT fk_notice_user FOREIGN KEY (created_by) REFERENCES users(id)',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;

          SET @fk_exists := (
            SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feedback' AND CONSTRAINT_NAME = 'fk_feedback_tenant'
          );
          SET @sql := IF(@fk_exists = 0,
            'ALTER TABLE feedback ADD CONSTRAINT fk_feedback_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;

          SET @fk_exists := (
            SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notice_recipients' AND CONSTRAINT_NAME = 'fk_nr_notice'
          );
          SET @sql := IF(@fk_exists = 0,
            'ALTER TABLE notice_recipients ADD CONSTRAINT fk_nr_notice FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
          DEALLOCATE PREPARE stmt;

          SET @fk_exists := (
            SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notice_recipients' AND CONSTRAINT_NAME = 'fk_nr_user'
          );
          SET @sql := IF(@fk_exists = 0,
            'ALTER TABLE notice_recipients ADD CONSTRAINT fk_nr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
            'SELECT 1'
          );
          PREPARE stmt FROM @sql;
          EXECUTE stmt;
           DEALLOCATE PREPARE stmt;
         `
       },
       {
         name: 'Office bookings table',
         sql: `
           CREATE TABLE IF NOT EXISTS office_bookings (
             id CHAR(36) PRIMARY KEY,
             office_location_id CHAR(36) NOT NULL,
             tenant_id CHAR(36) NOT NULL,
             booked_by_user_id CHAR(36) NOT NULL,
             purpose VARCHAR(200) NOT NULL,
             start_date DATETIME NOT NULL,
             end_date DATETIME NULL,
             status ENUM('pending','confirmed','active','completed','cancelled') DEFAULT 'pending',
             notes TEXT NULL,
             created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
             updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
             KEY idx_booking_office (office_location_id),
             KEY idx_booking_tenant (tenant_id),
             KEY idx_booking_status (status)
           );
         `
       },
       {
         name: 'Office locations professional columns',
         sql: `
           SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_locations' AND COLUMN_NAME = 'capacity');
           SET @s1 := IF(@c1 = 0, 'ALTER TABLE office_locations ADD COLUMN capacity INT DEFAULT 0', 'SELECT 1');
           PREPARE stmt FROM @s1; EXECUTE stmt; DEALLOCATE PREPARE stmt;

           SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_locations' AND COLUMN_NAME = 'amenities');
           SET @s2 := IF(@c2 = 0, 'ALTER TABLE office_locations ADD COLUMN amenities VARCHAR(500)', 'SELECT 1');
           PREPARE stmt FROM @s2; EXECUTE stmt; DEALLOCATE PREPARE stmt;

           SET @c3 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_locations' AND COLUMN_NAME = 'availability_status');
           SET @s3 := IF(@c3 = 0, "ALTER TABLE office_locations ADD COLUMN availability_status ENUM('available','occupied','maintenance') DEFAULT 'available'", 'SELECT 1');
           PREPARE stmt FROM @s3; EXECUTE stmt; DEALLOCATE PREPARE stmt;

           SET @c4 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_locations' AND COLUMN_NAME = 'price_per_month');
           SET @s4 := IF(@c4 = 0, 'ALTER TABLE office_locations ADD COLUMN price_per_month DECIMAL(10,2) DEFAULT 0', 'SELECT 1');
           PREPARE stmt FROM @s4; EXECUTE stmt; DEALLOCATE PREPARE stmt;

           SET @c5 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_locations' AND COLUMN_NAME = 'latitude');
           SET @s5 := IF(@c5 = 0, 'ALTER TABLE office_locations ADD COLUMN latitude DECIMAL(10,8) DEFAULT NULL', 'SELECT 1');
           PREPARE stmt FROM @s5; EXECUTE stmt; DEALLOCATE PREPARE stmt;

           SET @c6 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_locations' AND COLUMN_NAME = 'longitude');
           SET @s6 := IF(@c6 = 0, 'ALTER TABLE office_locations ADD COLUMN longitude DECIMAL(10,8) DEFAULT NULL', 'SELECT 1');
           PREPARE stmt FROM @s6; EXECUTE stmt; DEALLOCATE PREPARE stmt;

           SET @c7 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_locations' AND COLUMN_NAME = 'address');
           SET @s7 := IF(@c7 = 0, 'ALTER TABLE office_locations ADD COLUMN address VARCHAR(255)', 'SELECT 1');
           PREPARE stmt FROM @s7; EXECUTE stmt; DEALLOCATE PREPARE stmt;

           SET @c8 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_locations' AND COLUMN_NAME = 'contact_person');
           SET @s8 := IF(@c8 = 0, 'ALTER TABLE office_locations ADD COLUMN contact_person VARCHAR(150)', 'SELECT 1');
           PREPARE stmt FROM @s8; EXECUTE stmt; DEALLOCATE PREPARE stmt;

           SET @c9 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_locations' AND COLUMN_NAME = 'contact_phone');
           SET @s9 := IF(@c9 = 0, 'ALTER TABLE office_locations ADD COLUMN contact_phone VARCHAR(20)', 'SELECT 1');
           PREPARE stmt FROM @s9; EXECUTE stmt; DEALLOCATE PREPARE stmt;

           SET @c10 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_locations' AND COLUMN_NAME = 'notes');
           SET @s10 := IF(@c10 = 0, 'ALTER TABLE office_locations ADD COLUMN notes TEXT', 'SELECT 1');
           PREPARE stmt FROM @s10; EXECUTE stmt; DEALLOCATE PREPARE stmt;
         `
       },
       {
         name: 'Permissions and seed data',
        sql: `
          INSERT IGNORE INTO permissions (code, description) VALUES
            ('notices.read', 'View notices'),
            ('notices.create', 'Create notices'),
            ('notices.update', 'Update notices'),
            ('notices.delete', 'Delete notices'),
            ('notices.manage', 'Manage notices'),
            ('feedback.read', 'View feedback'),
            ('feedback.update', 'Update feedback'),
            ('feedback.delete', 'Delete feedback'),
            ('knowledge.read', 'View knowledge base'),
            ('knowledge.manage', 'Manage knowledge base'),
            ('reports.read', 'View reports'),
            ('audit.read', 'View audit logs'),
            ('office.read', 'View office locations'),
            ('departments.read', 'View departments'),
            ('departments.manage', 'Manage departments'),
            ('matrix.manage', 'Manage user-department matrix'),
            ('ticket_categories.manage', 'Manage ticket categories'),
            ('tickets.escalate', 'Escalate tickets'),
            ('tickets.merge', 'Merge duplicate tickets'),
            ('tickets.reopen', 'Reopen tickets'),
            ('tickets.approve', 'Approve completion'),
            ('tickets.complete', 'Mark tickets completed'),
            ('tickets.reassign', 'Reassign tickets'),
            ('tickets.change_priority', 'Change ticket priority'),
            ('tickets.change_category', 'Change ticket category'),
            ('tickets.internal_note', 'Add internal notes'),
            ('ticket_categories.approve', 'Approve category requests'),
            ('ticket_categories.reject', 'Reject category requests'),
            ('sla.manage', 'Manage SLA policies');

          INSERT IGNORE INTO role_permissions (role_id, permission_id)
          SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'admin';

          INSERT IGNORE INTO role_permissions (role_id, permission_id)
          SELECT r.id, p.id FROM roles r
          JOIN permissions p ON p.code IN (
            'tickets.read','tickets.assign','tickets.approve','tickets.close',
            'dashboard.read','departments.manage','matrix.manage','reports.read','audit.read',
            'notices.read','notices.create','knowledge.read','departments.read'
          )
          WHERE r.name = 'manager';

          INSERT IGNORE INTO role_permissions (role_id, permission_id)
          SELECT r.id, p.id FROM roles r
          JOIN permissions p ON p.code IN ('tickets.read','tickets.assign','dashboard.read','knowledge.read','notices.read')
          WHERE r.name = 'staff';

          INSERT IGNORE INTO role_permissions (role_id, permission_id)
          SELECT r.id, p.id FROM roles r
          JOIN permissions p ON p.code IN ('tickets.create','tickets.read','dashboard.read','knowledge.read','notices.read','office.read')
           WHERE r.name = 'tenant';

          INSERT IGNORE INTO sla_policies (id, name, priority, response_hours, resolution_hours, description)
          VALUES
            (UUID(), 'Critical SLA', 'urgent', 1,  4,  'Critical tickets resolved within 4 hours'),
            (UUID(), 'High SLA',     'high',     2,  8,  'High priority tickets resolved within 8 hours'),
            (UUID(), 'Medium SLA',   'medium',   4,  24, 'Medium priority tickets resolved within 24 hours'),
            (UUID(), 'Low SLA',      'low',      8,  72, 'Low priority tickets resolved within 72 hours');
        `
      },
      {
        name: 'Ticket categories seed data',
        sql: `
          SET @admin_id := (SELECT id FROM users WHERE username = 'admin' LIMIT 1);
          INSERT IGNORE INTO ticket_categories (id, name, description, department_id, is_active, created_by)
          SELECT UUID(), c.name, c.description, NULL, 1, @admin_id
          FROM (
            SELECT 'Hardware' AS name, 'Hardware related issues' AS description
            UNION ALL SELECT 'Software', 'Software and application issues'
            UNION ALL SELECT 'Network', 'Network and connectivity issues'
            UNION ALL SELECT 'Account Access', 'Login and account access problems'
            UNION ALL SELECT 'Email', 'Email related issues'
            UNION ALL SELECT 'General Inquiry', 'General inquiries and questions'
            UNION ALL SELECT 'Other', 'Other issues not listed above'
          ) c
          WHERE NOT EXISTS (SELECT 1 FROM ticket_categories WHERE name = c.name);
        `
      }
    ];

    for (const step of migrationSteps) {
      console.log(`Running: ${step.name}...`);
      try {
        await connection.query(step.sql);
        console.log(`  ✓ Completed\n`);
      } catch (err) {
        console.error(`  ✗ Failed: ${err.message}\n`);
        // Continue with next step for non-critical errors
      }
    }

    // Final verification
    console.log('=== Verification ===');
    
    const [finalTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME IN ('ticket_categories', 'sla_policies', 'ticket_category_requests', 'notices', 'feedback', 'knowledge_base', 'office_locations', 'notice_recipients')
    `, [DB_CONFIG.database]);
    console.log('Tables:', finalTables.map(t => t.TABLE_NAME).join(', ') || 'none');

    const [finalTicketCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tickets' 
        AND COLUMN_NAME IN ('response_due_date', 'escalation_due_date', 'is_overdue', 'sla_achieved', 'response_sla_breached', 'escalation_sla_breached')
    `, [DB_CONFIG.database]);
    console.log('SLA columns:', finalTicketCols.map(c => c.COLUMN_NAME).join(', ') || 'none');

    const [finalAuditCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'audit_logs' 
        AND COLUMN_NAME IN ('role', 'old_value', 'new_value', 'browser')
    `, [DB_CONFIG.database]);
    console.log('Audit columns:', finalAuditCols.map(c => c.COLUMN_NAME).join(', ') || 'none');

    const [catCount] = await connection.query('SELECT COUNT(*) as count FROM ticket_categories');
    console.log('Ticket categories:', catCount[0]?.count || 0);

    const [slaCount] = await connection.query('SELECT COUNT(*) as count FROM sla_policies');
    console.log('SLA policies:', slaCount[0]?.count || 0);

    console.log('\n✓ Migration complete! Restart the backend server to apply changes.');

  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

runMigration();
