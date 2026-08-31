// run-migration.js — run with: node run-migration.js
import pool from './config/db.js';

async function runMigration() {
  try {
    console.log('Checking and applying corporate office migration...');

    // Add attachment column if not exists
    const [colCheck] = await pool.query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'office_locations'
        AND COLUMN_NAME = 'attachment'
    `);
    if (colCheck[0].cnt === 0) {
      await pool.query(`ALTER TABLE office_locations ADD COLUMN attachment VARCHAR(500) NULL`);
      console.log('Added column: attachment');
    } else {
      console.log('Column already exists: attachment');
    }

    // Add attachment_name column if not exists
    const [colCheck2] = await pool.query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'office_locations'
        AND COLUMN_NAME = 'attachment_name'
    `);
    if (colCheck2[0].cnt === 0) {
      await pool.query(`ALTER TABLE office_locations ADD COLUMN attachment_name VARCHAR(255) NULL`);
      console.log('Added column: attachment_name');
    } else {
      console.log('Column already exists: attachment_name');
    }

    // Add theme_preference column to users table if not exists
    const [themeCheck] = await pool.query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'theme_preference'
    `);
    if (themeCheck[0].cnt === 0) {
      await pool.query(`ALTER TABLE users ADD COLUMN theme_preference ENUM('system', 'light', 'dark') NOT NULL DEFAULT 'system'`);
      console.log('Added column: theme_preference to users');
    } else {
      console.log('Column already exists: theme_preference in users');
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
