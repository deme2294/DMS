import pool from '../config/db.js';

export const findUserByUsernameOrEmail = async (identifier) => {
  const [rows] = await pool.query(
    `SELECT u.*, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.username = :identifier OR u.email = :identifier OR u.user_code = :identifier
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
     LEFT JOIN users u ON u.id = rt.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE rt.token_hash = :tokenHash AND rt.revoked = 0 AND rt.expires_at > NOW()
     LIMIT 1`,
    { tokenHash }
  );
  if (!rows.length) return null;
  const row = rows[0];
  if (!row.username) {
    const [uRows] = await pool.query(
      `SELECT u.id, r.name AS role, u.username
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = :uid OR u.user_code = :uid
       LIMIT 1`,
      { uid: row.user_id }
    );
    if (uRows.length) {
      return { ...row, user_id: uRows[0].id, role: uRows[0].role, username: uRows[0].username };
    }
  }
  return row;
};

export const revokeRefreshToken = async (tokenHash) => {
  await pool.query(`UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = :tokenHash`, { tokenHash });
};

export const logLoginAttempt = async (payload) => {
  try {
    await pool.query(
      `INSERT INTO login_history (id, user_id, username, ip_address, user_agent, success, message)
       VALUES (:id, :userId, :username, :ip, :userAgent, :success, :message)`,
      {
        id: payload.id,
        userId: payload.userId ?? null,
        username: payload.username ?? null,
        ip: payload.ip ?? null,
        userAgent: payload.userAgent ?? null,
        success: payload.success ? 1 : 0,
        message: payload.message ?? null,
      }
    );
  } catch (err) {
    console.warn('⚠️  Could not log login attempt:', err.message);
  }
};

export const updateLoginState = async ({ userId, failedAttempts, lockedUntil, lastLoginAt }) => {
  await pool.query(
    `UPDATE users
     SET failed_login_attempts = :failedAttempts,
         locked_until = :lockedUntil,
         last_login_at = :lastLoginAt
     WHERE id = :userId`,
    {
      userId,
      failedAttempts: failedAttempts ?? 0,
      lockedUntil: lockedUntil ?? null,
      lastLoginAt: lastLoginAt ?? null,
    }
  );
};

