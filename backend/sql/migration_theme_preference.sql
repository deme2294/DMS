-- Migration script to add theme_preference to users table
ALTER TABLE users ADD COLUMN theme_preference ENUM('system', 'light', 'dark') NOT NULL DEFAULT 'system';
