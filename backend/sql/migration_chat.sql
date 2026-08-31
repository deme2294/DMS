-- =====================================================================
-- Chat Module Migration
-- Creates tables for Enterprise Live Chat: chat_rooms, chat_participants,
-- chat_messages, chat_attachments, message_read_status
-- =====================================================================

USE helpdesk_db;

-- ------------------------------------------------------------------
-- Chat Rooms
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_rooms (
  room_id CHAR(36) PRIMARY KEY,
  room_type ENUM('ticket', 'direct', 'department') NOT NULL,
  ticket_id CHAR(36) NULL,
  department_id CHAR(36) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_chat_rooms_ticket (ticket_id),
  INDEX idx_chat_rooms_department (department_id),
  INDEX idx_chat_rooms_type (room_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- Chat Participants
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_participants (
  participant_id CHAR(36) PRIMARY KEY,
  room_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP NULL,
  is_active TINYINT(1) DEFAULT 1,
  UNIQUE KEY uniq_room_user (room_id, user_id),
  INDEX idx_chat_participants_user (user_id),
  INDEX idx_chat_participants_room (room_id),
  FOREIGN KEY (room_id) REFERENCES chat_rooms(room_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- Chat Messages
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  message_id CHAR(36) PRIMARY KEY,
  room_id CHAR(36) NOT NULL,
  sender_id CHAR(36) NOT NULL,
  message_type ENUM('text', 'image', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'audio') NOT NULL DEFAULT 'text',
  message TEXT NULL,
  attachment_path VARCHAR(500) NULL,
  attachment_name VARCHAR(255) NULL,
  is_edited TINYINT(1) DEFAULT 0,
  edited_at TIMESTAMP NULL,
  is_deleted TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_messages_room (room_id),
  INDEX idx_chat_messages_sender (sender_id),
  INDEX idx_chat_messages_created (room_id, created_at),
  FOREIGN KEY (room_id) REFERENCES chat_rooms(room_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- Chat Attachments
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_attachments (
  attachment_id CHAR(36) PRIMARY KEY,
  message_id CHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_attachments_message (message_id),
  FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- Message Read Status
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_read_status (
  id CHAR(36) PRIMARY KEY,
  message_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  read_at TIMESTAMP NULL,
  UNIQUE KEY uniq_message_user (message_id, user_id),
  INDEX idx_message_read_user (user_id),
  FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
