import pool from './config/db.js';

async function check() {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log('User count:', rows[0].count);
    if (rows[0].count > 0) {
      const [admin] = await pool.query('SELECT username, password_hash FROM users WHERE username = "admin"');
      console.log('Admin data:', admin[0]);
    }
  } catch (err) {
    console.error('Error checking DB:', err.message);
  } finally {
    process.exit();
  }
}
check();
