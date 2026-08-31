-- ============================================
-- Notice Replies Migration
-- Adds reply/comment functionality to notices
-- with public/internal visibility support
-- ============================================

USE helpdesk_db;

-- Notice Replies Table
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
);

-- Foreign key for notice
SET @fk_reply_notice := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notice_replies' AND CONSTRAINT_NAME = 'fk_reply_notice'
);
SET @sql_reply_notice := IF(@fk_reply_notice = 0,
  'ALTER TABLE notice_replies ADD CONSTRAINT fk_reply_notice FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt_reply_notice FROM @sql_reply_notice;
EXECUTE stmt_reply_notice;
DEALLOCATE PREPARE stmt_reply_notice;

-- Foreign key for user
SET @fk_reply_user := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notice_replies' AND CONSTRAINT_NAME = 'fk_reply_user'
);
SET @sql_reply_user := IF(@fk_reply_user = 0,
  'ALTER TABLE notice_replies ADD CONSTRAINT fk_reply_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt_reply_user FROM @sql_reply_user;
EXECUTE stmt_reply_user;
DEALLOCATE PREPARE stmt_reply_user;

SELECT 'Notice replies migration applied successfully' AS result;
