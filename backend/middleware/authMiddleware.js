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
              r.name AS role,
              t.organization_name AS tenant_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = :id LIMIT 1`,
      { id: decoded.sub }
    );

    if (!rows.length || rows[0].status !== 'active') {
      return res.status(HTTP.UNAUTHORIZED).json({ success: false, message: 'Invalid or inactive user' });
    }

    const [deptRows] = await pool.query(
      `SELECT d.id, d.name, d.code
       FROM user_departments ud
       JOIN departments d ON d.id = ud.department_id
       WHERE ud.user_id = :id`,
      { id: decoded.sub }
    );

    req.user = {
      ...rows[0],
      departments: deptRows.map((r) => ({ id: r.id, name: r.name, code: r.code })),
    };
    next();
  } catch {
    return res.status(HTTP.UNAUTHORIZED).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.accessToken;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, jwtConfig.accessSecret);

    const [rows] = await pool.query(
      `SELECT u.id, u.tenant_id, u.role_id, u.username, u.email, u.first_name, u.last_name,
              u.phone, u.profile_image, u.status, u.theme_preference, u.user_code,
              u.last_login_at, u.created_at, u.updated_at,
              r.name AS role,
              t.organization_name AS tenant_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = :id LIMIT 1`,
      { id: decoded.sub }
    );

    if (rows.length && rows[0].status === 'active') {
      const [deptRows] = await pool.query(
        `SELECT d.id, d.name, d.code
         FROM user_departments ud
         JOIN departments d ON d.id = ud.department_id
         WHERE ud.user_id = :id`,
        { id: decoded.sub }
      );

      req.user = {
        ...rows[0],
        departments: deptRows.map((r) => ({ id: r.id, name: r.name, code: r.code })),
      };
    }
  } catch {
    // Non-blocking: proceed as unauthenticated guest or fallback
  }
  next();
};
