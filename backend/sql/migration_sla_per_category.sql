-- ============================================
-- Migration: Per-Category SLA Policies
-- Run this against helpdesk_db
-- Extends sla_policies with per-category scoping
-- and adds SLA due dates to tickets.
-- ============================================

-- ─────────────────────────────────────────────
-- 1. sla_policies — per-category support
-- ─────────────────────────────────────────────

-- Add category_id (scoped policy) — guarded for re-runs
SET @sla_has_category := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND COLUMN_NAME = 'category_id'
);
SET @sql_sla_category := IF(@sla_has_category = 0,
  'ALTER TABLE sla_policies ADD COLUMN category_id CHAR(36) NULL AFTER priority',
  'SELECT 1'
);
PREPARE stmt FROM @sql_sla_category;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add escalation_hours
SET @sla_has_esc := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND COLUMN_NAME = 'escalation_hours'
);
SET @sql_sla_esc := IF(@sla_has_esc = 0,
  'ALTER TABLE sla_policies ADD COLUMN escalation_hours INT DEFAULT 0 AFTER resolution_hours',
  'SELECT 1'
);
PREPARE stmt FROM @sql_sla_esc;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add working_hours (business hours JSON)
SET @sla_has_wh := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND COLUMN_NAME = 'working_hours'
);
SET @sql_sla_wh := IF(@sla_has_wh = 0,
  'ALTER TABLE sla_policies ADD COLUMN working_hours JSON NULL AFTER escalation_hours',
  'SELECT 1'
);
PREPARE stmt FROM @sql_sla_wh;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop old single-priority uniqueness (idempotent)
DROP INDEX IF EXISTS uq_sla_priority ON sla_policies;

-- Add per-category + priority uniqueness — guarded for re-runs
SET @sla_has_uq := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND INDEX_NAME = 'uq_sla_category_priority'
);
SET @sql_sla_uq := IF(@sla_has_uq = 0,
  'ALTER TABLE sla_policies ADD UNIQUE KEY uq_sla_category_priority (category_id, priority)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_sla_uq;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add FK to ticket_categories (guarded)
SET @fk_sla_category := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies'
    AND CONSTRAINT_NAME = 'fk_sla_category'
);
SET @sql_sla_fk := IF(@fk_sla_category = 0,
  'ALTER TABLE sla_policies ADD CONSTRAINT fk_sla_category FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql_sla_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─────────────────────────────────────────────
-- 2. tickets — SLA due dates
-- ─────────────────────────────────────────────

-- Add response_due_date
SET @tkt_has_resp := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'response_due_date'
);
SET @sql_tkt_resp := IF(@tkt_has_resp = 0,
  'ALTER TABLE tickets ADD COLUMN response_due_date DATETIME NULL AFTER due_date',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tkt_resp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add escalation_due_date
SET @tkt_has_esc := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'escalation_due_date'
);
SET @sql_tkt_esc := IF(@tkt_has_esc = 0,
  'ALTER TABLE tickets ADD COLUMN escalation_due_date DATETIME NULL AFTER response_due_date',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tkt_esc;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index on response_due_date — guarded
SET @idx_resp := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_response_due'
);
SET @sql_idx_resp := IF(@idx_resp = 0,
  'ALTER TABLE tickets ADD INDEX idx_ticket_response_due (response_due_date)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_idx_resp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index on escalation_due_date — guarded
SET @idx_esc := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_escalation_due'
);
SET @sql_idx_esc := IF(@idx_esc = 0,
  'ALTER TABLE tickets ADD INDEX idx_ticket_escalation_due (escalation_due_date)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_idx_esc;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add response_sla_breached
SET @tkt_has_resp_breach := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'response_sla_breached'
);
SET @sql_tkt_resp_breach := IF(@tkt_has_resp_breach = 0,
  'ALTER TABLE tickets ADD COLUMN response_sla_breached TINYINT(1) DEFAULT 0 AFTER escalation_due_date',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tkt_resp_breach;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add escalation_sla_breached
SET @tkt_has_esc_breach := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'escalation_sla_breached'
);
SET @sql_tkt_esc_breach := IF(@tkt_has_esc_breach = 0,
  'ALTER TABLE tickets ADD COLUMN escalation_sla_breached TINYINT(1) DEFAULT 0 AFTER response_sla_breached',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tkt_esc_breach;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add sla_achieved
SET @tkt_has_sla_ach := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'sla_achieved'
);
SET @sql_tkt_sla_ach := IF(@tkt_has_sla_ach = 0,
  'ALTER TABLE tickets ADD COLUMN sla_achieved TINYINT(1) DEFAULT 0 AFTER escalation_sla_breached',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tkt_sla_ach;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index on sla_achieved — guarded
SET @idx_sla_ach := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_sla_achieved'
);
SET @sql_idx_sla_ach := IF(@idx_sla_ach = 0,
  'ALTER TABLE tickets ADD INDEX idx_ticket_sla_achieved (sla_achieved)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_idx_sla_ach;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add is_overdue (used by dashboard and SLA queries)
SET @tkt_has_overdue := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'is_overdue'
);
SET @sql_tkt_overdue := IF(@tkt_has_overdue = 0,
  'ALTER TABLE tickets ADD COLUMN is_overdue TINYINT(1) DEFAULT 0 AFTER escalation_sla_breached',
  'SELECT 1'
);
PREPARE stmt FROM @sql_tkt_overdue;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index on is_overdue — guarded
SET @idx_overdue := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_is_overdue'
);
SET @sql_idx_overdue := IF(@idx_overdue = 0,
  'ALTER TABLE tickets ADD INDEX idx_ticket_is_overdue (is_overdue)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_idx_overdue;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
