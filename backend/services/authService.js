import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import jwtConfig from '../config/jwt.js';
import * as authRepo from '../repository/authRepository.js';
import * as userRepo from '../repository/userRepository.js';
import { sanitizeUser } from '../models/User.js';
import * as auditService from './auditService.js';
import { sendAccountLockedEmail } from './emailService.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const buildTokens = (user) => {
  const payload = { sub: user.id, role: user.role, username: user.username };
  const accessToken = jwt.sign(payload, jwtConfig.accessSecret, { expiresIn: jwtConfig.accessExpires });
  const refreshToken = jwt.sign({ sub: user.id }, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpires });
  return { accessToken, refreshToken };
};

export const login = async ({ identifier, password, rememberMe, ip, userAgent }) => {
  const user = await authRepo.findUserByUsernameOrEmail(identifier);

  if (!user) {
    await authRepo.logLoginAttempt({
      id: uuidv4(), userId: null, username: identifier, ip, userAgent, success: 0, message: 'User not found',
    });
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  if (user.status === 'locked' || (user.locked_until && new Date(user.locked_until) > new Date())) {
    throw Object.assign(new Error('Account locked. Try again later.'), { statusCode: 423 });
  }

  if (!user.password_hash) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const valid = await bcrypt.compare(password || '', user.password_hash);
  if (!valid) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    const maxAttempts = Number(process.env.MAX_LOGIN_ATTEMPTS || 5);
    const lockMinutes = Number(process.env.LOCKOUT_MINUTES || 30);
    const isNowLocked = attempts >= maxAttempts;
    const lockedUntil = isNowLocked ? new Date(Date.now() + lockMinutes * 60000) : null;

    await authRepo.updateLoginState({
      userId: user.id,
      failedAttempts: isNowLocked ? 0 : attempts,
      lockedUntil,
      lastLoginAt: user.last_login_at,
    });

    await authRepo.logLoginAttempt({
      id: uuidv4(), userId: user.id, username: user.username, ip, userAgent, success: 0, message: 'Invalid password',
    });

    // Send lock email when account gets locked
    if (isNowLocked) {
      sendAccountLockedEmail({
        email: user.email,
        firstName: user.first_name,
        unlockAfterMinutes: lockMinutes,
      }).catch(() => { });
    }

    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  await authRepo.updateLoginState({
    userId: user.id,
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: new Date(),
  });

  const tokens = buildTokens(user);
  const refreshHash = hashToken(tokens.refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await authRepo.saveRefreshToken({
    id: uuidv4(),
    userId: user.id,
    tokenHash: refreshHash,
    expiresAt,
  });

  await authRepo.logLoginAttempt({
    id: uuidv4(), userId: user.id, username: user.username, ip, userAgent, success: 1, message: 'Login successful',
  });

  // Audit log
  auditService.logAction(user.id, 'login', 'user', user.id, ip, { username: user.username }).catch(() => { });

  const fullUser = await userRepo.findById(user.id);

  return {
    user: sanitizeUser(fullUser || user),
    ...tokens,
    rememberMe: !!rememberMe,
  };
};

export const refresh = async (refreshToken) => {
  if (!refreshToken) {
    throw Object.assign(new Error('Refresh token required'), { statusCode: 401 });
  }
  try {
    jwt.verify(refreshToken, jwtConfig.refreshSecret);
  } catch (err) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }
  const stored = await authRepo.findRefreshToken(hashToken(refreshToken));
  if (!stored) throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });

  const user = { id: stored.user_id, role: stored.role, username: stored.username };
  const tokens = buildTokens(user);

  await authRepo.revokeRefreshToken(hashToken(refreshToken));
  await authRepo.saveRefreshToken({
    id: uuidv4(),
    userId: stored.user_id,
    tokenHash: hashToken(tokens.refreshToken),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return tokens;
};

export const logout = async (refreshToken, userId, ip) => {
  if (refreshToken) await authRepo.revokeRefreshToken(hashToken(refreshToken));
  if (userId) {
    auditService.logAction(userId, 'logout', 'user', userId, ip, {}).catch(() => { });
  }
};