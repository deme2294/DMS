import pool from '../config/db.js';

export const findUserByUsernameOrEmail = async (identifier) => {
  const [rows] = await pool.query(
    `SELECT u.*, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.username = :identifier OR u.email = :identifier
     LIMIT 1`,
    { identifier }
  );
  return rows[0] || null;
};

export const saveRefreshToken = async ({ id, userId, tokenHash, expiresAt }) => {
  await pool.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
     VALUES (:id, :userId, :tokenHash, :expiresAt)`,
    { id, userId, tokenHash, expiresAt }
  );
};

export const findRefreshToken = async (tokenHash) => {
  const [rows] = await pool.query(
    `SELECT rt.*, u.id AS user_id, r.name AS role, u.username
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE rt.token_hash = :tokenHash AND rt.revoked = 0 AND rt.expires_at > NOW()
     LIMIT 1`,
    { tokenHash }
  );
  return rows[0] || null;
};

export const revokeRefreshToken = async (tokenHash) => {
  await pool.query(`UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = :tokenHash`, { tokenHash });
};

export const logLoginAttempt = async (payload) => {
  await pool.query(
    `INSERT INTO login_history (id, user_id, username, ip_address, user_agent, success, message)
     VALUES (:id, :userId, :username, :ip, :userAgent, :success, :message)`,
    payload
  );
};

export const updateLoginState = async ({ userId, failedAttempts, lockedUntil, lastLoginAt }) => {
  await pool.query(
    `UPDATE users
     SET failed_login_attempts = :failedAttempts,
         locked_until = :lockedUntil,
         last_login_at = :lastLoginAt
     WHERE id = :userId`,
    { userId, failedAttempts, lockedUntil, lastLoginAt }
  );
};