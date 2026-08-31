import jwt from 'jsonwebtoken';
import jwtConfig from '../config/jwt.js';
import pool from '../config/db.js';
import { HTTP } from '../config/constants.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.accessToken;

    if (!token) {
      return res.status(HTTP.UNAUTHORIZED).json({ success: false, message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, jwtConfig.accessSecret);

    const [rows] = await pool.query(
      `SELECT u.id, u.tenant_id, u.role_id, u.username, u.email, u.first_name, u.last_name,
              u.phone, u.profile_image, u.status, u.theme_preference, u.user_code,
              u.last_login_at, u.created_at, u.updated_at,
              r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = :id LIMIT 1`,
      { id: decoded.sub }
    );

    if (!rows.length || rows[0].status !== 'active') {
      return res.status(HTTP.UNAUTHORIZED).json({ success: false, message: 'Invalid or inactive user' });
    }

    req.user = rows[0];
    next();
  } catch {
    return res.status(HTTP.UNAUTHORIZED).json({ success: false, message: 'Invalid or expired token' });
  }
};
