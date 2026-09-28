import pool from '../config/db.js';

export async function runAutoMigrations() {
  console.log('[MIGRATION] Checking database schema...');
  try {
    // 1. Ensure missing tables exist
    await pool.query(`
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
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notice_recipients (
        id CHAR(36) PRIMARY KEY,
        notice_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        acknowledged_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_notice_user (notice_id, user_id),
        KEY idx_notice_recipients_notice (notice_id),
        KEY idx_notice_recipients_user (user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notice_replies (
        id CHAR(36) PRIMARY KEY,
        notice_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        message TEXT NOT NULL,
        visibility ENUM('all','internal') DEFAULT 'all',
        attachment_path VARCHAR(500) NULL,
        attachment_name VARCHAR(255) NULL,
        attachment_size INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_notice_replies_notice (notice_id),
        KEY idx_notice_replies_user (user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id CHAR(36) PRIMARY KEY,
        tenant_id CHAR(36) NULL,
        subject VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        rating INT,
        status ENUM('pending','read','resolved') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback_replies (
        id CHAR(36) PRIMARY KEY,
        feedback_id CHAR(36) NOT NULL,
        replied_by CHAR(36) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
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
      )
    `);

    await pool.query(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_categories (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        department_id CHAR(36) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
        routing_type ENUM('general','direct') NOT NULL DEFAULT 'general',
        sla_policy_id CHAR(36) NULL,
        requested_by CHAR(36) NULL,
        reviewed_by CHAR(36) NULL,
        reviewed_at DATETIME NULL,
        review_notes VARCHAR(255) NULL,
        created_by CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_category_name (name)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sla_policies (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        priority ENUM('low','medium','high','urgent') NOT NULL,
        category_id CHAR(36) NULL,
        response_hours INT NOT NULL DEFAULT 4,
        resolution_hours INT NOT NULL DEFAULT 24,
        escalation_hours INT DEFAULT 0,
        working_hours JSON NULL,
        description VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
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
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_message_deletions (
        id VARCHAR(36) PRIMARY KEY,
        message_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_chat_msg_user_del (message_id, user_id),
        KEY idx_cmd_user (user_id),
        KEY idx_cmd_message (message_id)
      )
    `);

    // Helper functions for checking column/index existence
    const columnExists = async (table, column) => {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      return rows[0].cnt > 0;
    };

    const indexExists = async (table, indexName) => {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, indexName]
      );
      return rows[0].cnt > 0;
    };

    // 2. Table notices -> column expiry_warned
    if (!(await columnExists('notices', 'expiry_warned'))) {
      await pool.query('ALTER TABLE notices ADD COLUMN expiry_warned TINYINT(1) NOT NULL DEFAULT 0');
      console.log('[MIGRATION] Added column notices.expiry_warned');
    }

    // 2a. Table notices -> Add department_id for department-specific notices
    if (!(await columnExists('notices', 'department_id'))) {
      await pool.query('ALTER TABLE notices ADD COLUMN department_id CHAR(36) NULL AFTER target_audience');
      console.log('[MIGRATION] Added column notices.department_id');
    }

    // 2b. Table notices -> Add assigned_to for manager-to-staff assignments
    if (!(await columnExists('notices', 'assigned_to'))) {
      await pool.query('ALTER TABLE notices ADD COLUMN assigned_to CHAR(36) NULL AFTER department_id');
      console.log('[MIGRATION] Added column notices.assigned_to');
    }

    // 2c. Table notices -> Add assigned_by for tracking who assigned the notice
    if (!(await columnExists('notices', 'assigned_by'))) {
      await pool.query('ALTER TABLE notices ADD COLUMN assigned_by CHAR(36) NULL AFTER assigned_to');
      console.log('[MIGRATION] Added column notices.assigned_by');
    }

    // 2d. Table notices -> Add creator_role for tracking who created the notice
    if (!(await columnExists('notices', 'creator_role'))) {
      await pool.query("ALTER TABLE notices ADD COLUMN creator_role ENUM('admin','manager','ceo') NULL AFTER created_by");
      console.log('[MIGRATION] Added column notices.creator_role');
    }

    // 3. Table tickets -> add tenant confirmation and escalation columns
    if (!(await columnExists('tickets', 'tenant_confirmation_status'))) {
      await pool.query(`ALTER TABLE tickets ADD COLUMN tenant_confirmation_status ENUM('not_required','pending','approved','rejected') NOT NULL DEFAULT 'not_required'`);
      console.log('[MIGRATION] Added column tickets.tenant_confirmation_status');
    }

    if (!(await columnExists('tickets', 'is_escalated'))) {
      await pool.query(`ALTER TABLE tickets ADD COLUMN is_escalated TINYINT(1) NOT NULL DEFAULT 0`);
      console.log('[MIGRATION] Added column tickets.is_escalated');
    }

    if (!(await columnExists('tickets', 'approved_by'))) {
      await pool.query(`ALTER TABLE tickets ADD COLUMN approved_by CHAR(36) NULL`);
      console.log('[MIGRATION] Added column tickets.approved_by');
    }

    if (!(await columnExists('tickets', 'reopened_by'))) {
      await pool.query(`ALTER TABLE tickets ADD COLUMN reopened_by CHAR(36) NULL`);
      console.log('[MIGRATION] Added column tickets.reopened_by');
    }

    if (!(await columnExists('tickets', 'reopen_reason'))) {
      await pool.query(`ALTER TABLE tickets ADD COLUMN reopen_reason TEXT NULL`);
      console.log('[MIGRATION] Added column tickets.reopen_reason');
    }

    // 3a. Table tickets -> migrate old statuses to new primary statuses
    const [oldStatusRows] = await pool.query(`SELECT id, status FROM tickets WHERE status IN ('accepted','completed','approved','rejected','escalated')`);
    for (const row of oldStatusRows) {
      let newStatus = row.status;
      if (row.status === 'accepted') newStatus = 'in_progress';
      else if (row.status === 'completed') newStatus = 'resolved';
      else if (row.status === 'approved') {
        newStatus = 'closed';
        await pool.query(`UPDATE tickets SET status = :newStatus, tenant_confirmation_status = 'approved', approved_at = COALESCE(approved_at, NOW()) WHERE id = :id`, { newStatus, id: row.id });
        continue;
      }
      else if (row.status === 'rejected') {
        newStatus = 'reopened';
        await pool.query(`UPDATE tickets SET status = :newStatus, tenant_confirmation_status = 'rejected', reopened_at = COALESCE(reopened_at, NOW()) WHERE id = :id`, { newStatus, id: row.id });
        continue;
      }
      else if (row.status === 'escalated') {
        await pool.query(`UPDATE tickets SET is_escalated = 1, escalated_at = COALESCE(escalated_at, NOW()) WHERE id = :id`, { id: row.id });
        continue;
      }
      await pool.query(`UPDATE tickets SET status = :newStatus WHERE id = :id`, { newStatus, id: row.id });
    }
    if (oldStatusRows.length) {
      console.log(`[MIGRATION] Migrated ${oldStatusRows.length} tickets from old statuses to new primary statuses`);
    }
    if (!(await columnExists('tickets', 'response_due_date'))) {
      await pool.query('ALTER TABLE tickets ADD COLUMN response_due_date DATETIME NULL');
      console.log('[MIGRATION] Added column tickets.response_due_date');
    }
    if (!(await columnExists('tickets', 'escalation_due_date'))) {
      await pool.query('ALTER TABLE tickets ADD COLUMN escalation_due_date DATETIME NULL');
      console.log('[MIGRATION] Added column tickets.escalation_due_date');
    }
    if (!(await columnExists('tickets', 'response_sla_breached'))) {
      await pool.query('ALTER TABLE tickets ADD COLUMN response_sla_breached TINYINT(1) DEFAULT 0');
      console.log('[MIGRATION] Added column tickets.response_sla_breached');
    }
    if (!(await columnExists('tickets', 'escalation_sla_breached'))) {
      await pool.query('ALTER TABLE tickets ADD COLUMN escalation_sla_breached TINYINT(1) DEFAULT 0');
      console.log('[MIGRATION] Added column tickets.escalation_sla_breached');
    }
    if (!(await columnExists('tickets', 'sla_achieved'))) {
      await pool.query('ALTER TABLE tickets ADD COLUMN sla_achieved TINYINT(1) DEFAULT 0');
      console.log('[MIGRATION] Added column tickets.sla_achieved');
    }
    if (!(await columnExists('tickets', 'is_overdue'))) {
      await pool.query('ALTER TABLE tickets ADD COLUMN is_overdue TINYINT(1) DEFAULT 0');
      console.log('[MIGRATION] Added column tickets.is_overdue');
    }
    if (!(await columnExists('tickets', 'last_sla_warning_at'))) {
      await pool.query('ALTER TABLE tickets ADD COLUMN last_sla_warning_at DATETIME NULL');
      console.log('[MIGRATION] Added column tickets.last_sla_warning_at');
    }

    // 3a. Table tickets -> routing_type (general = admin routes; direct = auto-routed to department at creation)
    if (!(await columnExists('tickets', 'routing_type'))) {
      await pool.query(`ALTER TABLE tickets ADD COLUMN routing_type ENUM('general','direct') NOT NULL DEFAULT 'general' AFTER auto_department_id`);
      console.log('[MIGRATION] Added column tickets.routing_type');
      // Backfill from the category so historical tickets reflect their creation routing
      await pool.query(
        `UPDATE tickets t
         LEFT JOIN ticket_categories tc ON tc.name = t.category
         SET t.routing_type = tc.routing_type
         WHERE tc.routing_type IS NOT NULL`
      );
      console.log('[MIGRATION] Backfilled tickets.routing_type from ticket_categories');
    }

    // Ticket indexes
    if (!(await indexExists('tickets', 'idx_ticket_response_due'))) {
      await pool.query('ALTER TABLE tickets ADD INDEX idx_ticket_response_due (response_due_date)');
    }
    if (!(await indexExists('tickets', 'idx_ticket_escalation_due'))) {
      await pool.query('ALTER TABLE tickets ADD INDEX idx_ticket_escalation_due (escalation_due_date)');
    }
    if (!(await indexExists('tickets', 'idx_ticket_is_overdue'))) {
      await pool.query('ALTER TABLE tickets ADD INDEX idx_ticket_is_overdue (is_overdue)');
    }
    if (!(await indexExists('tickets', 'idx_ticket_last_sla_warning'))) {
      await pool.query('ALTER TABLE tickets ADD INDEX idx_ticket_last_sla_warning (last_sla_warning_at)');
    }

    // 4. Table notifications -> notice_id & type enum
    if (!(await columnExists('notifications', 'notice_id'))) {
      await pool.query('ALTER TABLE notifications ADD COLUMN notice_id CHAR(36) NULL');
      console.log('[MIGRATION] Added column notifications.notice_id');
    }

    if (!(await columnExists('notifications', 'room_id'))) {
      await pool.query('ALTER TABLE notifications ADD COLUMN room_id CHAR(36) NULL');
      console.log('[MIGRATION] Added column notifications.room_id');
    }

    const [enumRows] = await pool.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'`
    );
    if (enumRows.length && !enumRows[0].COLUMN_TYPE.includes("'chat'")) {
      await pool.query(`
        ALTER TABLE notifications MODIFY COLUMN type ENUM(
          'ticket','reply','status','assignment','notice',
          'category','sla','escalation','completion','approval',
          'rejection','reopen','merge','note','internal','chat'
        ) DEFAULT 'ticket'
      `);
      console.log('[MIGRATION] Updated notifications.type ENUM');
    }

    // 5. Table ticket_categories workflow columns
    if (!(await columnExists('ticket_categories', 'status'))) {
      await pool.query(`
        ALTER TABLE ticket_categories
          ADD COLUMN status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
          ADD COLUMN sla_policy_id CHAR(36) NULL,
          ADD COLUMN requested_by CHAR(36) NULL,
          ADD COLUMN reviewed_by CHAR(36) NULL,
          ADD COLUMN reviewed_at DATETIME NULL,
          ADD COLUMN review_notes VARCHAR(255) NULL
      `);
      console.log('[MIGRATION] Added ticket_categories workflow columns');
    }

    // 5a. Table ticket_categories -> routing_type (general = admin routes, direct = auto-route to department)
    if (!(await columnExists('ticket_categories', 'routing_type'))) {
      await pool.query(`ALTER TABLE ticket_categories ADD COLUMN routing_type ENUM('general','direct') NOT NULL DEFAULT 'general'`);
      console.log('[MIGRATION] Added column ticket_categories.routing_type');
    }

    // 5b. Table assignments -> allow NULL for system/auto routing (assigned_by / assigned_to may be unset when the system routes a ticket)
    const assignmentNullCols = ['assigned_by', 'assigned_to'];
    for (const col of assignmentNullCols) {
      if (!(await columnExists('assignments', col))) continue;
      const [nullRows] = await pool.query(
        `SELECT IS_NULLABLE AS is_nullable
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments' AND COLUMN_NAME = :col`,
        { col }
      );
      if (nullRows[0]?.is_nullable !== 'YES') {
        await pool.query(`ALTER TABLE assignments MODIFY COLUMN ${col} CHAR(36) NULL`);
        console.log(`[MIGRATION] Made assignments.${col} nullable (system routing)`);
      }
    }

    // 5c. Table ticket_status_history -> allow NULL changed_by for system-generated status transitions
    if (await columnExists('ticket_status_history', 'changed_by')) {
      const [shNullRows] = await pool.query(
        `SELECT IS_NULLABLE AS is_nullable
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_status_history' AND COLUMN_NAME = 'changed_by'`
      );
      if (shNullRows[0]?.is_nullable !== 'YES') {
        await pool.query(`ALTER TABLE ticket_status_history MODIFY COLUMN changed_by CHAR(36) NULL`);
        console.log('[MIGRATION] Made ticket_status_history.changed_by nullable (system routing)');
      }
    }

    // 6. Table sla_policies category_id
    if (!(await columnExists('sla_policies', 'category_id'))) {
      await pool.query(`
        ALTER TABLE sla_policies
          ADD COLUMN category_id CHAR(36) NULL AFTER priority,
          ADD COLUMN escalation_hours INT DEFAULT 0 AFTER resolution_hours,
          ADD COLUMN working_hours JSON NULL AFTER escalation_hours
      `);
      console.log('[MIGRATION] Added sla_policies category & hours columns');
    }

    // 7. Table audit_logs extra columns
    if (!(await columnExists('audit_logs', 'role'))) {
      await pool.query(`
        ALTER TABLE audit_logs
          ADD COLUMN role VARCHAR(50) NULL,
          ADD COLUMN old_value JSON NULL,
          ADD COLUMN new_value JSON NULL,
          ADD COLUMN browser VARCHAR(255) NULL
      `);
      console.log('[MIGRATION] Added audit_logs extra columns');
    }

    // 8. Table ticket_status_history extra columns
    if (!(await columnExists('ticket_status_history', 'role'))) {
      await pool.query(`
        ALTER TABLE ticket_status_history
          ADD COLUMN role VARCHAR(50) NULL,
          ADD COLUMN browser VARCHAR(255) NULL
      `);
      console.log('[MIGRATION] Added ticket_status_history extra columns');
    }

    // 9. Table ticket_replies extra columns
    if (!(await columnExists('ticket_replies', 'type'))) {
      await pool.query(`
        ALTER TABLE ticket_replies
          ADD COLUMN type ENUM('comment','note','reply') NOT NULL DEFAULT 'reply',
          ADD COLUMN is_internal TINYINT(1) NOT NULL DEFAULT 0
      `);
      console.log('[MIGRATION] Added ticket_replies extra columns');
    }

    // 9a. Table ticket_replies -> department_ids (comma-separated target departments for internal replies)
    if (!(await columnExists('ticket_replies', 'department_ids'))) {
      await pool.query(`ALTER TABLE ticket_replies ADD COLUMN department_ids VARCHAR(500) NULL`);
      console.log('[MIGRATION] Added column ticket_replies.department_ids');
    }

    // 9b. Table ticket_replies -> extend visibility ENUM to support tenant/department targeting
    const [replyVisRows] = await pool.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_replies' AND COLUMN_NAME = 'visibility'`
    );
    if (replyVisRows.length && !replyVisRows[0].COLUMN_TYPE.includes("'department'")) {
      await pool.query(
        `ALTER TABLE ticket_replies MODIFY COLUMN visibility ENUM('all','internal','tenant','department','both') NOT NULL DEFAULT 'all'`
      );
      console.log('[MIGRATION] Extended ticket_replies.visibility ENUM');
    }

    // 10. Table feedback -> ticket-based feedback fields
    if (!(await columnExists('feedback', 'ticket_id'))) {
      await pool.query(`
        ALTER TABLE feedback
          ADD COLUMN ticket_id CHAR(36) NULL AFTER tenant_id,
          ADD COLUMN feedback_type ENUM('suggestion','complaint','improvement','bug','other') NOT NULL DEFAULT 'suggestion',
          ADD COLUMN what_should_change TEXT NULL,
          ADD COLUMN what_is_correct TEXT NULL,
          ADD COLUMN what_is_wrong TEXT NULL,
          ADD COLUMN how_it_should_go TEXT NULL,
          ADD COLUMN admin_response TEXT NULL,
          ADD COLUMN response_at DATETIME NULL,
          ADD COLUMN response_by CHAR(36) NULL
      `);
      console.log('[MIGRATION] Added feedback ticket-based columns');
    }

    // 11. Add professional attributes to office_locations
    const officeCols = ['capacity', 'amenities', 'availability_status', 'price_per_month', 'latitude', 'longitude', 'address', 'contact_person', 'contact_phone', 'notes'];
    for (const col of officeCols) {
      if (!(await columnExists('office_locations', col))) {
        let colType = 'VARCHAR(255)';
        if (col === 'capacity') colType = 'INT DEFAULT 0';
        if (col === 'price_per_month') colType = 'DECIMAL(10,2) DEFAULT 0';
        if (col === 'latitude' || col === 'longitude') colType = 'DECIMAL(10,8) DEFAULT NULL';
        if (col === 'availability_status') colType = "ENUM('available','occupied','maintenance') DEFAULT 'available'";
        await pool.query(`ALTER TABLE office_locations ADD COLUMN ${col} ${colType}`);
        console.log(`[MIGRATION] Added column office_locations.${col}`);
      }
    }

    // 12. Create office_bookings table
    await pool.query(`
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
      )
    `);
    console.log('[MIGRATION] Created/verified office_bookings table');

    // 13. Create office_feedback table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS office_feedback (
        id CHAR(36) PRIMARY KEY,
        office_location_id CHAR(36) NOT NULL,
        tenant_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        rating INT NULL,
        status ENUM('pending','read','resolved') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_office_feedback_office (office_location_id),
        KEY idx_office_feedback_tenant (tenant_id),
        KEY idx_office_feedback_user (user_id),
        KEY idx_office_feedback_status (status)
      )
    `);
    console.log('[MIGRATION] Created/verified office_feedback table');

    // 14. Create office_feedback_replies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS office_feedback_replies (
        id CHAR(36) PRIMARY KEY,
        office_feedback_id CHAR(36) NOT NULL,
        replied_by CHAR(36) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_office_feedback_replies_feedback (office_feedback_id),
        KEY idx_office_feedback_replies_user (replied_by)
      )
    `);
    console.log('[MIGRATION] Created/verified office_feedback_replies table');

    // ===================== KNOWLEDGE BASE SCHEMA MIGRATION =====================
    // 18. Update knowledge_base status ENUM and add missing columns
    const [kbEnumRows] = await pool.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_base' AND COLUMN_NAME = 'status'`
    );
    if (kbEnumRows.length && !kbEnumRows[0].COLUMN_TYPE.includes("'needs_revision'")) {
      await pool.query(`
        ALTER TABLE knowledge_base 
        MODIFY COLUMN status ENUM('draft','pending_approval','needs_revision','approved','published','unpublished','rejected','archived','restored') 
        DEFAULT 'draft'
      `);
      console.log('[MIGRATION] Updated knowledge_base status ENUM');
    }

    const kbCols = [
      { col: 'article_reference', def: "VARCHAR(50) NULL UNIQUE" },
      { col: 'slug', def: "VARCHAR(255) NULL" },
      { col: 'summary', def: "TEXT NULL" },
      { col: 'visibility', def: "ENUM('tenant','internal','department','restricted','public') DEFAULT 'internal'" },
      { col: 'version', def: "VARCHAR(20) DEFAULT '1.0'" },
      { col: 'updated_by', def: "CHAR(36) NULL" },
      { col: 'submitted_by', def: "CHAR(36) NULL" },
      { col: 'reviewed_by', def: "CHAR(36) NULL" },
      { col: 'approved_by', def: "CHAR(36) NULL" },
      { col: 'approved_at', def: "DATETIME NULL" },
      { col: 'rejected_by', def: "CHAR(36) NULL" },
      { col: 'rejected_at', def: "DATETIME NULL" },
      { col: 'unpublished_by', def: "CHAR(36) NULL" },
      { col: 'unpublish_reason', def: "TEXT NULL" },
      { col: 'unpublished_at', def: "DATETIME NULL" },
      { col: 'archived_by', def: "CHAR(36) NULL" },
      { col: 'archived_at', def: "DATETIME NULL" },
      { col: 'deleted_at', def: "DATETIME NULL" },
      { col: 'view_count', def: "INT DEFAULT 0" },
      { col: 'helpful_count', def: "INT DEFAULT 0" },
      { col: 'not_helpful_count', def: "INT DEFAULT 0" },
    ];
    for (const { col, def } of kbCols) {
      if (!(await columnExists('knowledge_base', col))) {
        await pool.query(`ALTER TABLE knowledge_base ADD COLUMN ${col} ${def}`);
        console.log(`[MIGRATION] Added column knowledge_base.${col}`);
      }
    }

    // Knowledge base indexes
    if (!(await indexExists('knowledge_base', 'idx_kb_status'))) {
      await pool.query('ALTER TABLE knowledge_base ADD INDEX idx_kb_status (status)');
    }
    if (!(await indexExists('knowledge_base', 'idx_kb_category'))) {
      await pool.query('ALTER TABLE knowledge_base ADD INDEX idx_kb_category (category)');
    }
    if (!(await indexExists('knowledge_base', 'idx_kb_department'))) {
      await pool.query('ALTER TABLE knowledge_base ADD INDEX idx_kb_department (department_id)');
    }
    if (!(await indexExists('knowledge_base', 'idx_kb_author'))) {
      await pool.query('ALTER TABLE knowledge_base ADD INDEX idx_kb_author (author_id)');
    }
    if (!(await indexExists('knowledge_base', 'idx_kb_slug'))) {
      await pool.query('ALTER TABLE knowledge_base ADD UNIQUE INDEX idx_kb_slug (slug)');
    }
    if (!(await indexExists('knowledge_base', 'idx_kb_reference'))) {
      await pool.query('ALTER TABLE knowledge_base ADD UNIQUE INDEX idx_kb_reference (article_reference)');
    }

    // 19. Create knowledge_categories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS knowledge_categories (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT NULL,
        icon VARCHAR(50) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        parent_id CHAR(36) NULL,
        created_by CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_kb_category_parent (parent_id),
        KEY idx_kb_category_active (is_active)
      )
    `);
    console.log('[MIGRATION] Created/verified knowledge_categories table');

    // 20. Create knowledge_article_versions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS knowledge_article_versions (
        id CHAR(36) PRIMARY KEY,
        article_id CHAR(36) NOT NULL,
        version_number VARCHAR(20) NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        category_id CHAR(36) NULL,
        change_summary TEXT NULL,
        created_by CHAR(36) NOT NULL,
        approved_by CHAR(36) NULL,
        approved_at DATETIME NULL,
        published_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_kb_version_article (article_id),
        KEY idx_kb_version_number (version_number)
      )
    `);
    console.log('[MIGRATION] Created/verified knowledge_article_versions table');

    // 21. Create knowledge_attachments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS knowledge_attachments (
        id CHAR(36) PRIMARY KEY,
        article_id CHAR(36) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INT NULL,
        mime_type VARCHAR(100) NULL,
        file_extension VARCHAR(20) NULL,
        uploaded_by CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_kb_attachment_article (article_id)
      )
    `);
    console.log('[MIGRATION] Created/verified knowledge_attachments table');

    // 22. Add knowledge base permissions
    const kbPermissions = [
      'knowledge.submit', 'knowledge.review', 'knowledge.request_revision',
      'knowledge.reject', 'knowledge.unpublish', 'knowledge.archive', 'knowledge.restore',
      'knowledge.manage_categories', 'knowledge.view_versions', 'knowledge.manage_versions',
      'knowledge.view_audit', 'knowledge.view_statistics'
    ];
    for (const code of kbPermissions) {
      await pool.query(
        `INSERT IGNORE INTO permissions (code, description) VALUES (?, ?)`,
        [code, code.replace('knowledge.', '').replace(/_/g, ' ')]
      );
    }

    // Ensure admin gets all new permissions
    await pool.query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
       WHERE r.name = 'admin' AND p.code IN ('knowledge.submit','knowledge.review','knowledge.request_revision','knowledge.reject','knowledge.unpublish','knowledge.archive','knowledge.restore','knowledge.manage_categories','knowledge.view_versions','knowledge.manage_versions','knowledge.view_audit','knowledge.view_statistics')`
    );

    // Ensure manager has review and approval permissions for department articles
    await pool.query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
       WHERE r.name = 'manager' AND p.code IN (
         'knowledge.read','knowledge.create','knowledge.update','knowledge.submit',
         'knowledge.review','knowledge.request_revision','knowledge.approve','knowledge.reject',
         'knowledge.categories','knowledge.view_versions'
       )`
    );

    // Ensure staff has submit permission for department articles
    await pool.query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
       WHERE r.name = 'staff' AND p.code IN (
         'knowledge.read','knowledge.create','knowledge.update','knowledge.submit',
         'knowledge.view_versions'
       )`
    );

    // 23. Add CEO and Executive Analytics permissions
    const ceoPermissions = [
      'ceo.dashboard', 'executive.analytics', 'executive.reports', 'executive.approvals', 'executive.remarks'
    ];
    for (const code of ceoPermissions) {
      await pool.query(
        `INSERT IGNORE INTO permissions (code, description) VALUES (?, ?)`,
        [code, code.replace('executive.', 'Executive ').replace('ceo.', 'CEO ').replace(/_/g, ' ')]
      );
    }
    await pool.query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
       WHERE r.name = 'ceo' AND p.code IN (
         'users.read', 'tickets.read', 'departments.read', 'dashboard.read',
         'notices.read', 'feedback.read', 'knowledge.read', 'office.read',
         'reports.read', 'audit.read', 'ceo.dashboard', 'executive.analytics',
         'executive.reports', 'executive.approvals', 'executive.remarks'
       )`
    );

    // 14a. Add admin_response columns to office_feedback table
    const officeFeedbackCols = [
      { col: 'admin_response', def: "TEXT NULL" },
      { col: 'response_at', def: "TIMESTAMP NULL" },
      { col: 'response_by', def: "CHAR(36) NULL" },
    ];
    for (const { col, def } of officeFeedbackCols) {
      if (!(await columnExists('office_feedback', col))) {
        await pool.query(`ALTER TABLE office_feedback ADD COLUMN ${col} ${def}`);
        console.log(`[MIGRATION] Added column office_feedback.${col}`);
      }
    }

    // 15. Add user_code column to users table for auto-generated user IDs
    if (!(await columnExists('users', 'user_code'))) {
      await pool.query('ALTER TABLE users ADD COLUMN user_code VARCHAR(20) NULL');
      console.log('[MIGRATION] Added column users.user_code');
    }

    // 16. Assign user codes to existing users that don't have one yet
    const [allUsers] = await pool.query(
      `SELECT u.id, r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.user_code IS NULL
       ORDER BY r.name, u.username`
    );

    if (allUsers.length > 0) {
      const roleGroups = {};
      for (const user of allUsers) {
        if (!roleGroups[user.role_name]) {
          roleGroups[user.role_name] = [];
        }
        roleGroups[user.role_name].push(user.id);
      }

       const year = new Date().getFullYear().toString().slice(-2);
       for (const [roleName, userIds] of Object.entries(roleGroups)) {
         const prefix = roleName.charAt(0).toUpperCase();
         for (let i = 0; i < userIds.length; i++) {
           const sequence = String(i + 1).padStart(3, '0');
           const userCode = `${prefix}${sequence}/${year}`;
           await pool.query(
             'UPDATE users SET user_code = :userCode WHERE id = :id',
             { userCode, id: userIds[i] }
           );
         }
       }
      console.log(`[MIGRATION] Assigned user codes to ${allUsers.length} existing users`);
    }

    // 17. Add missing columns to assignments table
    const assignmentCols = [
      { col: 'role', def: "VARCHAR(50) NULL AFTER notes" },
      { col: 'priority', def: "VARCHAR(20) NULL" },
      { col: 'category', def: "VARCHAR(100) NULL" },
      { col: 'from_assignment_id', def: "CHAR(36) NULL" },
      { col: 'accepted_at', def: "DATETIME NULL" },
      { col: 'rejected_at', def: "DATETIME NULL" },
      { col: 'reassigned_at', def: "DATETIME NULL" },
    ];
    for (const { col, def } of assignmentCols) {
      if (!(await columnExists('assignments', col))) {
        await pool.query(`ALTER TABLE assignments ADD COLUMN ${col} ${def}`);
        console.log(`[MIGRATION] Added column assignments.${col}`);
      }
    }

    console.log('[MIGRATION] Schema verification completed successfully.');
    
    // Run chat tables migration
    await createChatTables();

  } catch (err) {
    console.error('[MIGRATION] Error running auto-migrations:', err.message);
  }
}

// ===================== CHAT TABLES MIGRATION =====================
export async function createChatTables() {
  console.log('[MIGRATION] Creating chat system tables...');
  try {
    // 18. chat_rooms table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id CHAR(36) PRIMARY KEY,
        room_type ENUM('ticket', 'direct', 'department') NOT NULL,
        ticket_id CHAR(36) NULL,
        department_id CHAR(36) NULL,
        name VARCHAR(200) NOT NULL,
        created_by CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_room_type (room_type),
        KEY idx_room_ticket (ticket_id),
        KEY idx_room_department (department_id),
        KEY idx_room_creator (created_by)
      )
    `);
    console.log('[MIGRATION] Created/verified chat_rooms table');

    // 19. chat_participants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_participants (
        id CHAR(36) PRIMARY KEY,
        room_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME NULL,
        is_active TINYINT(1) DEFAULT 1,
        UNIQUE KEY uq_room_user (room_id, user_id),
        KEY idx_participant_room (room_id),
        KEY idx_participant_user (user_id)
      )
    `);
    console.log('[MIGRATION] Created/verified chat_participants table');

    // 20. chat_messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id CHAR(36) PRIMARY KEY,
        room_id CHAR(36) NOT NULL,
        sender_id CHAR(36) NOT NULL,
        message_type ENUM('text', 'image', 'file') DEFAULT 'text',
        message TEXT NOT NULL,
        attachment_path VARCHAR(500) NULL,
        attachment_name VARCHAR(255) NULL,
        attachment_size INT NULL,
        is_edited TINYINT(1) DEFAULT 0,
        edited_at DATETIME NULL,
        is_deleted TINYINT(1) DEFAULT 0,
        deleted_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_message_room (room_id),
        KEY idx_message_sender (sender_id),
        KEY idx_message_created (created_at)
      )
    `);
    console.log('[MIGRATION] Created/verified chat_messages table');

    // 21. message_read_status table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_read_status (
        id CHAR(36) PRIMARY KEY,
        message_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_message_user (message_id, user_id),
        KEY idx_read_message (message_id),
        KEY idx_read_user (user_id)
      )
    `);
    console.log('[MIGRATION] Created/verified message_read_status table');

    // 22. typing_indicators table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS typing_indicators (
        id CHAR(36) PRIMARY KEY,
        room_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        is_typing TINYINT(1) DEFAULT 1,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_typing_room_user (room_id, user_id),
        KEY idx_typing_room (room_id)
      )
    `);
    console.log('[MIGRATION] Created/verified typing_indicators table');

    // 23. user_online_status table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_online_status (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        is_online TINYINT(1) DEFAULT 0,
        last_seen DATETIME NULL,
        socket_id VARCHAR(255) NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_online (user_id),
        KEY idx_online_status (is_online)
      )
    `);
    console.log('[MIGRATION] Created/verified user_online_status table');

    console.log('[MIGRATION] ✅ Chat system tables created successfully');
  } catch (err) {
    console.error('[MIGRATION] ❌ Error creating chat tables:', err.message);
  }
}
