import dotenv from 'dotenv';
import './env.js';

export default {
  accessSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'dms_jwt_access_secret_min_32_chars_2026',
  refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'dms_jwt_refresh_secret_min_32_chars_2026',
  accessExpires: process.env.JWT_ACCESS_EXPIRES || '1h',
  refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
};
