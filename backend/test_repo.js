import * as authRepo from './repository/authRepository.js';
import pool from './config/db.js';

async function test() {
  try {
    const user = await authRepo.findUserByUsernameOrEmail('admin');
    console.log('User found:', user ? user.username : 'NULL');
    
    // Also test raw query
    const [rows] = await pool.query(
      `SELECT u.*, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.username = :identifier OR u.email = :identifier
       LIMIT 1`,
      { identifier: 'admin' }
    );
    console.log('Raw query found:', rows.length > 0 ? rows[0].username : 'NULL');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}
test();
