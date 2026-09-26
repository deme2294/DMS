CREATE DATABASE IF NOT EXISTS helpdesk_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE helpdesk_db;

-- =====================================================================
-- Complete schema (all split sql/*.sql files merged into this one file)
-- Fresh install for XAMPP / phpMyAdmin
-- Step 1: Drop tables
-- Step 2: Create all tables WITHOUT foreign keys
-- Step 3: Insert seed data
-- Step 4: Add foreign keys
-- Step 5: Triggers
--
-- NOTE: All future schema changes must be added to this file.
-- The split migration_*.sql files have been removed to avoid redundancy.
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------
-- Step 1: Drop tables
-- ------------------------------------------------------------------
DROP TABLE IF EXISTS typing_indicators;
DROP TABLE IF EXISTS message_read_status;
DROP TABLE IF EXISTS chat_attachments;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_participants;
DROP TABLE IF EXISTS chat_rooms;
DROP TABLE IF EXISTS user_online_status;
DROP TABLE IF EXISTS knowledge_attachments;
DROP TABLE IF EXISTS knowledge_article_versions;
DROP TABLE IF EXISTS knowledge_categories;
DROP TABLE IF EXISTS office_feedback_replies;
DROP TABLE IF EXISTS office_feedback;
DROP TABLE IF EXISTS office_bookings;
DROP TABLE IF EXISTS notice_replies;
DROP TABLE IF EXISTS notice_recipients;
DROP TABLE IF EXISTS ticket_category_requests;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS ticket_replies;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS ticket_status_history;
DROP TABLE IF EXISTS ticket_attachments;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS sla_policies;
DROP TABLE IF EXISTS ticket_categories;
DROP TABLE IF EXISTS office_locations;
DROP TABLE IF EXISTS knowledge_base;
DROP TABLE IF EXISTS feedback_replies;
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS notices;
DROP TABLE IF EXISTS user_departments;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS login_history;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS tenants;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------------
-- Step 2: Create tables WITHOUT foreign keys first
-- ------------------------------------------------------------------
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name ENUM('admin','manager','staff','tenant','ceo') NOT NULL UNIQUE,
  description VARCHAR(255)
);

CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255)
);

CREATE TABLE tenants (
  id CHAR(36) PRIMARY KEY,
  tenant_id INT AUTO_INCREMENT UNIQUE,
  organization_name VARCHAR(255) NOT NULL,
  registration_number VARCHAR(100) UNIQUE NOT NULL,
  contact_person VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(30),
  address TEXT,
  notes TEXT,
  status ENUM('active','inactive','pending') DEFAULT 'pending',
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE departments (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  head_user_id CHAR(36) NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE users (
   id CHAR(36) PRIMARY KEY,
   tenant_id CHAR(36) NULL,
   role_id INT NOT NULL,
   username VARCHAR(80) NOT NULL UNIQUE,
   email VARCHAR(150) NOT NULL UNIQUE,
   password_hash VARCHAR(255) NOT NULL,
   first_name VARCHAR(100) NOT NULL,
   last_name VARCHAR(100) NOT NULL,
   phone VARCHAR(30),
   profile_image VARCHAR(255),
   status ENUM('active','inactive','locked') DEFAULT 'active',
   theme_preference ENUM('system','light','dark') DEFAULT 'system',
   user_code VARCHAR(20) NULL,
   failed_login_attempts INT DEFAULT 0,
   locked_until DATETIME NULL,
   last_login_at DATETIME NULL,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_departments (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  department_id CHAR(36) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_department (user_id, department_id)
);

CREATE TABLE refresh_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE login_history (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  username VARCHAR(80),
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  success TINYINT(1) NOT NULL,
  message VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id CHAR(36),
  ip_address VARCHAR(45),
  details JSON,
  role VARCHAR(50) NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  browser VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ticket_categories (
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
);

CREATE TABLE sla_policies (
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sla_category (category_id)
);

CREATE TABLE ticket_category_requests (
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

CREATE TABLE tickets (
  id CHAR(36) PRIMARY KEY,
  reference_number VARCHAR(30) NOT NULL UNIQUE,
  track_number VARCHAR(30) NOT NULL UNIQUE,
  tenant_id CHAR(36) NOT NULL,
  created_by CHAR(36) NOT NULL,
  department_id CHAR(36) NULL,
  current_department_id CHAR(36) NULL,
  assigned_to CHAR(36) NULL,
  current_assigned_user_id CHAR(36) NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
  category VARCHAR(100) NOT NULL,
  status ENUM(
    'open','assigned','in_progress','pending','waiting_tenant',
    'waiting_vendor','resolved','reopened','closed',
    'submitted','under_review','assigned_department','assigned_staff','pending_approval',
    'accepted','completed','approved','rejected','cancelled','escalated'
  ) DEFAULT 'open',
  tenant_confirmation_status ENUM('not_required','pending','approved','rejected') NOT NULL DEFAULT 'not_required',
  is_escalated TINYINT(1) NOT NULL DEFAULT 0,
  attachment_count INT NOT NULL DEFAULT 0,
  sla_policy_id CHAR(36) NULL,
  auto_department_id CHAR(36) NULL,
  routing_type ENUM('general','direct') NOT NULL DEFAULT 'general',
  due_date DATETIME NULL,
  response_due_date DATETIME NULL,
  escalation_due_date DATETIME NULL,
  response_sla_breached TINYINT(1) DEFAULT 0,
  escalation_sla_breached TINYINT(1) DEFAULT 0,
  sla_achieved TINYINT(1) DEFAULT 0,
  is_overdue TINYINT(1) DEFAULT 0,
  sla_agreement_accepted TINYINT(1) NOT NULL DEFAULT 1,
  sla_agreement_accepted_at DATETIME NULL,
  last_sla_warning_at DATETIME NULL,
  resolved_at DATETIME NULL,
  completed_at DATETIME NULL,
  approved_at DATETIME NULL,
  escalated_at DATETIME NULL,
  reopened_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  closed_at DATETIME NULL,
  approved_by CHAR(36) NULL,
  reopened_by CHAR(36) NULL,
  reopen_reason TEXT NULL,
  merged_into CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE ticket_attachments (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type VARCHAR(100),
  uploaded_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ticket_status_history (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  from_status VARCHAR(50) NULL,
  to_status VARCHAR(50) NOT NULL,
  changed_by CHAR(36) NULL,
  notes TEXT NULL,
  role VARCHAR(50) NULL,
  browser VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ticket_replies (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  message TEXT NOT NULL,
  visibility ENUM('all','internal','tenant','department','both') NOT NULL DEFAULT 'all',
  attachment_id CHAR(36) NULL,
  type ENUM('comment','note','reply') NOT NULL DEFAULT 'reply',
  is_internal TINYINT(1) NOT NULL DEFAULT 0,
  department_ids VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM(
    'ticket','reply','status','assignment','notice',
    'category','sla','escalation','completion','approval',
    'rejection','reopen','merge','note','internal','chat'
  ) DEFAULT 'ticket',
  ticket_id CHAR(36) NULL,
  notice_id CHAR(36) NULL,
  room_id CHAR(36) NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assignments (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  assigned_by CHAR(36) NULL,
  assigned_to CHAR(36) NULL,
  notes TEXT,
  status ENUM('pending','accepted','completed','rejected') DEFAULT 'pending',
  role ENUM('department_manager','staff') NOT NULL DEFAULT 'staff',
  from_assignment_id CHAR(36) NULL,
  accepted_at DATETIME NULL,
  rejected_at DATETIME NULL,
  reassigned_at DATETIME NULL,
  priority VARCHAR(20) NULL,
  category VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE notices (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  image VARCHAR(255),
  attachment VARCHAR(500),
  attachment_name VARCHAR(255),
  priority ENUM('low','medium','high') DEFAULT 'medium',
  status ENUM('draft','published','archived') DEFAULT 'draft',
  target_audience ENUM('all','admin','manager','staff','tenant','department') DEFAULT 'all',
  department_id CHAR(36) NULL,
  assigned_to CHAR(36) NULL,
  assigned_by CHAR(36) NULL,
  expires_at DATETIME NULL,
  expiry_warned TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36) NOT NULL,
  creator_role ENUM('admin','manager','ceo') NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE notice_recipients (
  id CHAR(36) PRIMARY KEY,
  notice_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  acknowledged_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notice_user (notice_id, user_id),
  KEY idx_notice_recipients_notice (notice_id),
  KEY idx_notice_recipients_user (user_id)
);

CREATE TABLE notice_replies (
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

CREATE TABLE feedback (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NULL,
  ticket_id CHAR(36) NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  rating INT,
  feedback_type ENUM('suggestion','complaint','improvement','bug','other') NOT NULL DEFAULT 'suggestion',
  what_should_change TEXT NULL,
  what_is_correct TEXT NULL,
  what_is_wrong TEXT NULL,
  how_it_should_go TEXT NULL,
  admin_response TEXT NULL,
  response_at DATETIME NULL,
  response_by CHAR(36) NULL,
  status ENUM('pending','read','resolved') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE feedback_replies (
  id CHAR(36) PRIMARY KEY,
  feedback_id CHAR(36) NOT NULL,
  replied_by CHAR(36) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE knowledge_base (
  id CHAR(36) PRIMARY KEY,
  article_reference VARCHAR(50) NULL,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(255) NULL,
  summary TEXT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  tags VARCHAR(500),
  attachment VARCHAR(500),
  attachment_name VARCHAR(255),
  visibility ENUM('tenant','internal','department','restricted','public') DEFAULT 'internal',
  version VARCHAR(20) DEFAULT '1.0',
  status ENUM('draft','pending_approval','needs_revision','approved','published','unpublished','rejected','archived','restored','in_review') DEFAULT 'draft',
  author_id CHAR(36) NOT NULL,
  created_by CHAR(36) NULL,
  department_id CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  submitted_by CHAR(36) NULL,
  reviewed_by CHAR(36) NULL,
  approved_by CHAR(36) NULL,
  published_by CHAR(36) NULL,
  archived_by CHAR(36) NULL,
  rejected_by CHAR(36) NULL,
  unpublished_by CHAR(36) NULL,
  rejection_reason TEXT NULL,
  revision_notes TEXT NULL,
  unpublish_reason TEXT NULL,
  helpful_yes INT DEFAULT 0,
  helpful_no INT DEFAULT 0,
  helpful_count INT DEFAULT 0,
  not_helpful_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  published_at DATETIME NULL,
  approved_at DATETIME NULL,
  rejected_at DATETIME NULL,
  unpublished_at DATETIME NULL,
  archived_at DATETIME NULL,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_kb_reference (article_reference),
  UNIQUE KEY idx_kb_slug (slug),
  KEY idx_kb_status (status),
  KEY idx_kb_category (category),
  KEY idx_kb_department (department_id),
  KEY idx_kb_author (author_id)
);

CREATE TABLE knowledge_categories (
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
);

CREATE TABLE knowledge_article_versions (
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
);

CREATE TABLE knowledge_attachments (
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
);

CREATE TABLE office_locations (
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
  attachment VARCHAR(500) NULL,
  attachment_name VARCHAR(255) NULL,
  notes TEXT,
  capacity INT DEFAULT 0,
  amenities VARCHAR(255),
  availability_status ENUM('available','occupied','maintenance') DEFAULT 'available',
  price_per_month DECIMAL(10,2) DEFAULT 0,
  latitude DECIMAL(10,8) DEFAULT NULL,
  longitude DECIMAL(10,8) DEFAULT NULL,
  address VARCHAR(255),
  contact_person VARCHAR(255),
  contact_phone VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE office_bookings (
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

CREATE TABLE office_feedback (
  id CHAR(36) PRIMARY KEY,
  office_location_id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  rating INT NULL,
  status ENUM('pending','read','resolved') DEFAULT 'pending',
  admin_response TEXT NULL,
  response_at TIMESTAMP NULL,
  response_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_office_feedback_office (office_location_id),
  KEY idx_office_feedback_tenant (tenant_id),
  KEY idx_office_feedback_user (user_id),
  KEY idx_office_feedback_status (status)
);

CREATE TABLE office_feedback_replies (
  id CHAR(36) PRIMARY KEY,
  office_feedback_id CHAR(36) NOT NULL,
  replied_by CHAR(36) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_office_feedback_replies_feedback (office_feedback_id),
  KEY idx_office_feedback_replies_user (replied_by)
);

CREATE TABLE chat_rooms (
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
);

CREATE TABLE chat_participants (
  id CHAR(36) PRIMARY KEY,
  room_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME NULL,
  is_active TINYINT(1) DEFAULT 1,
  UNIQUE KEY uq_room_user (room_id, user_id),
  KEY idx_participant_room (room_id),
  KEY idx_participant_user (user_id)
);

CREATE TABLE chat_messages (
  id CHAR(36) PRIMARY KEY,
  room_id CHAR(36) NOT NULL,
  sender_id CHAR(36) NOT NULL,
  message_type ENUM('text', 'image', 'file', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'audio') DEFAULT 'text',
  message TEXT NULL,
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
);

CREATE TABLE chat_attachments (
  attachment_id CHAR(36) PRIMARY KEY,
  message_id CHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_chat_attachments_message (message_id)
);

CREATE TABLE message_read_status (
  id CHAR(36) PRIMARY KEY,
  message_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  read_at TIMESTAMP NULL,
  UNIQUE KEY uq_message_user (message_id, user_id),
  KEY idx_read_message (message_id),
  KEY idx_read_user (user_id)
);

CREATE TABLE typing_indicators (
  id CHAR(36) PRIMARY KEY,
  room_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  is_typing TINYINT(1) DEFAULT 1,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_typing_room_user (room_id, user_id),
  KEY idx_typing_room (room_id)
);

CREATE TABLE user_online_status (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  is_online TINYINT(1) DEFAULT 0,
  last_seen DATETIME NULL,
  socket_id VARCHAR(255) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_online (user_id),
  KEY idx_online_status (is_online)
);

CREATE INDEX idx_ticket_status ON tickets(status);
CREATE INDEX idx_ticket_priority ON tickets(priority);
CREATE INDEX idx_ticket_department ON tickets(department_id);
CREATE INDEX idx_ticket_tenant ON tickets(tenant_id);
CREATE INDEX idx_ticket_track ON tickets(track_number);
CREATE INDEX idx_ticket_reference ON tickets(reference_number);
CREATE INDEX idx_ticket_response_due ON tickets(response_due_date);
CREATE INDEX idx_ticket_escalation_due ON tickets(escalation_due_date);
CREATE INDEX idx_ticket_sla_achieved ON tickets(sla_achieved);
CREATE INDEX idx_ticket_is_overdue ON tickets(is_overdue);
CREATE INDEX idx_ticket_last_sla_warning ON tickets(last_sla_warning_at);
CREATE INDEX idx_ticket_sla_agreement ON tickets(sla_agreement_accepted);
CREATE INDEX idx_reply_ticket ON ticket_replies(ticket_id);
CREATE INDEX idx_notification_user ON notifications(user_id, read_at, created_at);
CREATE INDEX idx_ticket_history_ticket ON ticket_status_history(ticket_id);

-- ------------------------------------------------------------------
-- Step 3: Insert seed data (parents before children)
-- ------------------------------------------------------------------
INSERT INTO roles (name, description) VALUES
('admin', 'System administrator'),
('manager', 'Department manager'),
('staff', 'Help desk staff'),
('tenant', 'External tenant user'),
('ceo', 'Chief Executive Officer (organization-wide oversight)');

INSERT INTO permissions (code, description) VALUES
('users.read', 'View users'),
('users.create', 'Create users'),
('users.update', 'Update users'),
('users.delete', 'Delete users'),
('tenants.manage', 'Manage tenants'),
('departments.read', 'View departments'),
('departments.manage', 'Manage departments'),
('matrix.manage', 'Manage user-department matrix'),
('tickets.create', 'Create tickets'),
('tickets.read', 'View tickets'),
('tickets.assign', 'Assign tickets'),
('tickets.approve', 'Approve tickets'),
('tickets.close', 'Close tickets'),
('tickets.escalate', 'Escalate tickets'),
('tickets.merge', 'Merge duplicate tickets'),
('tickets.reopen', 'Reopen tickets'),
('tickets.complete', 'Mark tickets completed'),
('tickets.reassign', 'Reassign tickets'),
('tickets.change_priority', 'Change ticket priority'),
('tickets.change_category', 'Change ticket category'),
('tickets.internal_note', 'Add internal notes'),
('ticket_categories.manage', 'Manage ticket categories'),
('ticket_categories.approve', 'Approve category requests'),
('ticket_categories.reject', 'Reject category requests'),
('sla.manage', 'Manage SLA policies'),
('dashboard.read', 'View dashboard'),
('notices.read', 'View notices'),
('notices.create', 'Create notices'),
('notices.update', 'Update notices'),
('notices.delete', 'Delete notices'),
('notices.manage', 'Manage notices'),
('feedback.read', 'View feedback'),
('feedback.update', 'Update feedback'),
('feedback.delete', 'Delete feedback'),
('knowledge.read', 'View knowledge base'),
('knowledge.create', 'Create knowledge base articles'),
('knowledge.update', 'Edit knowledge base articles'),
('knowledge.approve', 'Approve knowledge base articles'),
('knowledge.publish', 'Publish knowledge base articles'),
('knowledge.delete', 'Delete knowledge base articles'),
('knowledge.rate', 'Rate knowledge base articles'),
('knowledge.categories', 'Manage knowledge categories and tags'),
('knowledge.stats', 'View knowledge article statistics'),
('knowledge.manage', 'Manage knowledge base (full)'),
('knowledge.submit', 'Submit knowledge articles'),
('knowledge.review', 'Review knowledge articles'),
('knowledge.request_revision', 'Request knowledge revision'),
('knowledge.reject', 'Reject knowledge articles'),
('knowledge.unpublish', 'Unpublish knowledge articles'),
('knowledge.archive', 'Archive knowledge articles'),
('knowledge.restore', 'Restore knowledge articles'),
('knowledge.manage_categories', 'Manage knowledge categories'),
('knowledge.view_versions', 'View knowledge versions'),
('knowledge.manage_versions', 'Manage knowledge versions'),
('knowledge.view_audit', 'View knowledge audit'),
('knowledge.view_statistics', 'View knowledge statistics'),
('reports.read', 'View reports'),
('audit.read', 'View audit logs'),
('office.read', 'View office locations'),
('ceo.dashboard', 'View CEO executive dashboard'),
('executive.analytics', 'View executive analytics'),
('executive.reports', 'Generate and export executive reports'),
('executive.approvals', 'Approve/reject escalated tickets (executive oversight)'),
('executive.remarks', 'Add executive remarks to tickets');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'admin';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN (
  'tickets.read','tickets.assign','tickets.approve','tickets.close',
  'tickets.complete','tickets.reassign','tickets.change_priority','tickets.escalate','tickets.internal_note',
  'ticket_categories.manage',
  'dashboard.read','departments.read','departments.manage','matrix.manage','reports.read','audit.read',
  'notices.read',
  'knowledge.read','knowledge.create','knowledge.update','knowledge.categories'
)
WHERE r.name = 'manager';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN (
  'tickets.read','tickets.assign','tickets.complete','tickets.internal_note','dashboard.read','notices.read',
  'knowledge.read','knowledge.create','knowledge.update'
)
WHERE r.name = 'staff';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN (
  'tickets.create','tickets.read','dashboard.read','notices.read',
  'knowledge.read','knowledge.rate','office.read'
)
WHERE r.name = 'tenant';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN (
  'users.read',
  'tickets.read',
  'departments.read',
  'dashboard.read', 'notices.read', 'feedback.read',
  'knowledge.read', 'office.read',
  'reports.read', 'audit.read',
  'ceo.dashboard','executive.analytics','executive.reports','executive.approvals','executive.remarks'
)
WHERE r.name = 'ceo';

INSERT INTO tenants (id, tenant_id, organization_name, registration_number, contact_person, email, phone, address, notes, status, username, password, created_by) VALUES
('11111111-1111-1111-1111-111111111111', 1, 'City Housing Office', 'REG-2024-001', 'John Tenant', 'tenant@demo.gov', '555-0100', 'Main Street 1', 'Demo tenant organization', 'active', 'tenant', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', NULL);

INSERT INTO departments (id, name, code, description, status) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'IT Support', 'IT', 'Information Technology Support', 'active'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Human Resources', 'HR', 'Human Resources Department', 'active');

-- Password for all demo users is: password
INSERT INTO users (id, tenant_id, role_id, username, email, password_hash, first_name, last_name, status, user_code) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 1, 'admin', 'admin@demo.gov', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System', 'Admin', 'active', 'A001/26'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 2, 'manager', 'manager@demo.gov', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dept', 'Manager', 'active', 'M001/26'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', NULL, 3, 'staff', 'staff@demo.gov', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Help', 'Staff', 'active', 'S001/26'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 4, 'tenant', 'tenant@demo.gov', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'John', 'Tenant', 'active', 'T001/26'),
('cccccccc-cecc-cecc-cecc-cccccccccecc', NULL, 5, 'ceo', 'ceo@demo.gov', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Executive', 'Officer', 'active', 'C001/26');

INSERT INTO user_departments (id, user_id, department_id) VALUES
('uddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
('ueeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd');

INSERT INTO ticket_categories (id, name, description, department_id, is_active, status, routing_type, created_by) VALUES
('cat00001-0000-0000-0000-000000000001', 'Hardware', 'Hardware related issues', NULL, 1, 'approved', 'general', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('cat00002-0000-0000-0000-000000000002', 'Software', 'Software and application issues', NULL, 1, 'approved', 'general', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('cat00003-0000-0000-0000-000000000003', 'Network', 'Network and connectivity issues', NULL, 1, 'approved', 'general', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('cat00004-0000-0000-0000-000000000004', 'Account Access', 'Login and account access problems', NULL, 1, 'approved', 'general', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('cat00005-0000-0000-0000-000000000005', 'Email', 'Email related issues', NULL, 1, 'approved', 'general', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('cat00006-0000-0000-0000-000000000006', 'General Inquiry', 'General inquiries and questions', NULL, 1, 'approved', 'general', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('cat00007-0000-0000-0000-000000000007', 'Other', 'Other issues not listed above', NULL, 1, 'approved', 'general', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

INSERT INTO sla_policies (id, name, priority, category_id, response_hours, resolution_hours, description) VALUES
('sla00001-0000-0000-0000-000000000001', 'Critical SLA', 'urgent', NULL, 1, 4, 'Critical tickets resolved within 4 hours'),
('sla00002-0000-0000-0000-000000000002', 'High SLA', 'high', NULL, 2, 8, 'High priority tickets resolved within 8 hours'),
('sla00003-0000-0000-0000-000000000003', 'Medium SLA', 'medium', NULL, 4, 24, 'Medium priority tickets resolved within 24 hours'),
('sla00004-0000-0000-0000-000000000004', 'Low SLA', 'low', NULL, 8, 72, 'Low priority tickets resolved within 72 hours');

-- ------------------------------------------------------------------
-- Step 4: Add foreign keys AFTER all data is inserted
-- ------------------------------------------------------------------
ALTER TABLE departments
  ADD CONSTRAINT fk_department_head
  FOREIGN KEY (head_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD CONSTRAINT fk_user_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_user_role
  FOREIGN KEY (role_id) REFERENCES roles(id);

ALTER TABLE user_departments
  ADD CONSTRAINT fk_ud_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ud_department
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE refresh_tokens
  ADD CONSTRAINT fk_rt_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE login_history
  ADD CONSTRAINT fk_lh_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ticket_categories
  ADD CONSTRAINT fk_tc_created_by
  FOREIGN KEY (created_by) REFERENCES users(id),
  ADD CONSTRAINT fk_tc_department
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_tc_sla_policy
  FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE SET NULL;

ALTER TABLE sla_policies
  ADD CONSTRAINT fk_sla_category
  FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE;

ALTER TABLE ticket_category_requests
  ADD CONSTRAINT fk_tcr_category
  FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE;

ALTER TABLE tickets
  ADD CONSTRAINT fk_ticket_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ticket_created_by
  FOREIGN KEY (created_by) REFERENCES users(id),
  ADD CONSTRAINT fk_ticket_department
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_ticket_assigned_to
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_ticket_sla
  FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_ticket_auto_department
  FOREIGN KEY (auto_department_id) REFERENCES departments(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_ticket_merged_into
  FOREIGN KEY (merged_into) REFERENCES tickets(id) ON DELETE SET NULL;

ALTER TABLE ticket_attachments
  ADD CONSTRAINT fk_ta_ticket
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ta_user
  FOREIGN KEY (uploaded_by) REFERENCES users(id);

ALTER TABLE ticket_status_history
  ADD CONSTRAINT fk_tsh_ticket
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_tsh_user
  FOREIGN KEY (changed_by) REFERENCES users(id);

ALTER TABLE ticket_replies
  ADD CONSTRAINT fk_tr_ticket
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_tr_user
  FOREIGN KEY (user_id) REFERENCES users(id),
  ADD CONSTRAINT fk_tr_attachment
  FOREIGN KEY (attachment_id) REFERENCES ticket_attachments(id) ON DELETE SET NULL;

ALTER TABLE notifications
  ADD CONSTRAINT fk_n_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_n_ticket
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_n_notice
  FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE SET NULL;

ALTER TABLE assignments
  ADD CONSTRAINT fk_a_ticket
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_a_assigned_by
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  ADD CONSTRAINT fk_a_assigned_to
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  ADD CONSTRAINT fk_assign_from
  FOREIGN KEY (from_assignment_id) REFERENCES assignments(id) ON DELETE SET NULL;

ALTER TABLE notices
  ADD CONSTRAINT fk_notice_user
  FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE notice_recipients
  ADD CONSTRAINT fk_nr_notice
  FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_nr_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE notice_replies
  ADD CONSTRAINT fk_reply_notice
  FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_reply_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE feedback
  ADD CONSTRAINT fk_feedback_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_feedback_ticket
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;

ALTER TABLE feedback_replies
  ADD CONSTRAINT fk_fr_feedback
  FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_fr_user
  FOREIGN KEY (replied_by) REFERENCES users(id);

ALTER TABLE knowledge_base
  ADD CONSTRAINT fk_kb_user
  FOREIGN KEY (author_id) REFERENCES users(id),
  ADD CONSTRAINT fk_kb_department
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_kb_approved_by
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_kb_published_by
  FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_kb_archived_by
  FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE office_locations
  ADD CONSTRAINT fk_ol_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE office_bookings
  ADD CONSTRAINT fk_ob_office
  FOREIGN KEY (office_location_id) REFERENCES office_locations(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ob_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ob_user
  FOREIGN KEY (booked_by_user_id) REFERENCES users(id);

ALTER TABLE office_feedback
  ADD CONSTRAINT fk_of_office
  FOREIGN KEY (office_location_id) REFERENCES office_locations(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_of_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_of_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE office_feedback_replies
  ADD CONSTRAINT fk_ofr_feedback
  FOREIGN KEY (office_feedback_id) REFERENCES office_feedback(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ofr_user
  FOREIGN KEY (replied_by) REFERENCES users(id);

ALTER TABLE chat_rooms
  ADD CONSTRAINT fk_cr_ticket
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_cr_department
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_cr_created_by
  FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE chat_participants
  ADD CONSTRAINT fk_cp_room
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_cp_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE chat_messages
  ADD CONSTRAINT fk_cm_room
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_cm_sender
  FOREIGN KEY (sender_id) REFERENCES users(id);

ALTER TABLE chat_attachments
  ADD CONSTRAINT fk_ca_message
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE;

ALTER TABLE message_read_status
  ADD CONSTRAINT fk_mrs_message
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_mrs_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE typing_indicators
  ADD CONSTRAINT fk_ti_room
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE;

ALTER TABLE user_online_status
  ADD CONSTRAINT fk_uos_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------
-- Step 5: Triggers
-- ------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_ticket_attachments_ai;
DELIMITER $$
CREATE TRIGGER trg_ticket_attachments_ai
  AFTER INSERT ON ticket_attachments
  FOR EACH ROW
BEGIN
  UPDATE tickets
     SET attachment_count = (SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = NEW.ticket_id)
   WHERE id = NEW.ticket_id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_ticket_attachments_ad;
DELIMITER $$
CREATE TRIGGER trg_ticket_attachments_ad
  AFTER DELETE ON ticket_attachments
  FOR EACH ROW
BEGIN
  UPDATE tickets
     SET attachment_count = (SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = OLD.ticket_id)
   WHERE id = OLD.ticket_id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_tickets_au;
DELIMITER $$
CREATE TRIGGER trg_tickets_au
  BEFORE UPDATE ON tickets
  FOR EACH ROW
BEGIN
  IF NEW.department_id IS NULL OR NEW.department_id <> OLD.department_id THEN
    SET NEW.current_department_id = NEW.department_id;
  END IF;
  IF NEW.assigned_to IS NULL OR NEW.assigned_to <> OLD.assigned_to THEN
    SET NEW.current_assigned_user_id = NEW.assigned_to;
  END IF;
END$$
DELIMITER ;
