-- ============================================
-- Migration: SLA Agreement Acceptance on Ticket Creation
-- Run this against helpdesk_db
-- Adds sla_agreement_accepted columns to tickets
-- ============================================

USE helpdesk_db;

-- Add sla_agreement_accepted to tickets
SET @tkt_has_sla_agree := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'sla_agreement_accepted'
);
SET @sql_tkt_sla_agree := IF(@tkt_has_sla_agree = 0,
  "ALTER TABLE tickets
     ADD COLUMN sla_agreement_accepted TINYINT(1) NOT NULL DEFAULT 1 AFTER is_overdue,
     ADD COLUMN sla_agreement_accepted_at DATETIME NULL AFTER sla_agreement_accepted",
  'SELECT 1'
);
PREPARE stmt FROM @sql_tkt_sla_agree;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for reporting
SET @idx_sla_agree := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_sla_agreement'
);
SET @sql_idx_sla_agree := IF(@idx_sla_agree = 0,
  'ALTER TABLE tickets ADD INDEX idx_ticket_sla_agreement (sla_agreement_accepted)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_idx_sla_agree;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'SLA agreement acceptance migration applied' AS result;



