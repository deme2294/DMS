import * as auditService from '../services/auditService.js';
import pool from '../config/db.js';
import { HTTP } from '../config/constants.js';

export const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, userId, action, entityType, startDate, endDate } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let where = 'WHERE 1=1';
    const params = [];

    if (userId) {
      where += ' AND al.user_id = ?';
      params.push(userId);
    }
    if (action) {
      where += ' AND al.action LIKE ?';
      params.push(`%${action}%`);
    }
    if (entityType) {
      where += ' AND al.entity_type = ?';
      params.push(entityType);
    }
    if (startDate) {
      where += ' AND al.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      where += ' AND al.created_at <= ?';
      params.push(endDate);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs al ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT al.id, al.user_id, al.action, al.entity_type AS entity,
              al.entity_id, al.ip_address, al.details, al.created_at,
              u.username, u.first_name, u.last_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const data = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username || r.user_id,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      ipAddress: r.ip_address,
      details: r.details ? (typeof r.details === 'string' ? r.details : JSON.stringify(r.details)) : null,
      createdAt: r.created_at,
    }));

    res.status(HTTP.OK).json({
      success: true,
      data,
      pagination: {
        total: countRows[0].total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(countRows[0].total / Number(limit)) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getAuditActions = async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT action FROM audit_logs ORDER BY action ASC'
    );
    res.status(HTTP.OK).json({ success: true, data: rows.map((r) => r.action) });
  } catch (err) {
    next(err);
  }
};

export const logAction = async (req, res, next) => {
  try {
    const { action, entityType, entityId, details } = req.body;
    await auditService.logAction(req.user.id, action, entityType, entityId, req.ip, details);
    res.status(HTTP.OK).json({ success: true, message: 'Audit logged' });
  } catch (err) {
    next(err);
  }
};

const toCsv = (headers, rows) => {
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const str = String(v).replace(/"/g, '""');
    return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(','));
  return lines.join('\r\n');
};

export const exportAuditLogs = async (req, res, next) => {
  try {
    const { userId, action, entityType, startDate, endDate } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (userId) { where += ' AND al.user_id = ?'; params.push(userId); }
    if (action) { where += ' AND al.action LIKE ?'; params.push(`%${action}%`); }
    if (entityType) { where += ' AND al.entity_type = ?'; params.push(entityType); }
    if (startDate) { where += ' AND al.created_at >= ?'; params.push(startDate); }
    if (endDate) { where += ' AND al.created_at <= ?'; params.push(endDate); }

    const [rows] = await pool.query(
      `SELECT al.user_id, u.username, al.action, al.entity_type AS entity,
              al.entity_id, al.ip_address, al.details, al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC`,
      params
    );

    const data = rows.map((r) => ({
      user: r.username || r.user_id,
      action: r.action,
      entity: r.entity,
      entity_id: r.entity_id || '',
      ip_address: r.ip_address || '',
      date: new Date(r.created_at).toISOString(),
      details: r.details ? (typeof r.details === 'string' ? r.details : JSON.stringify(r.details)) : '',
    }));

    const csv = toCsv(['user', 'action', 'entity', 'entity_id', 'ip_address', 'date', 'details'], data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
};
