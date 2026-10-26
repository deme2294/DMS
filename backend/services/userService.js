import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as userRepo from '../repository/userRepository.js';
import * as tenantRepo from '../repository/tenantRepository.js';
import { sanitizeUser } from '../models/User.js';
import * as auditService from './auditService.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from './emailService.js';

const SALT_ROUNDS = 10;

export const generateUserCode = async (_roleName) => {
  return userRepo.getNextUserCode();
};

export const listUsers = async (query) => {
  const result = await userRepo.findAll(query);
  return {
    ...result,
    data: result.data.map(sanitizeUser),
  };
};

export const getUser = async (id) => {
  const user = await userRepo.findById(id);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return sanitizeUser(user);
};

export const createUser = async (payload) => {
  const existingUsername = await userRepo.findByUsername(payload.username);
  if (existingUsername) throw Object.assign(new Error('Username already exists'), { statusCode: 409 });

  const existingEmail = await userRepo.findByEmail(payload.email);
  if (existingEmail) throw Object.assign(new Error('Email already exists'), { statusCode: 409 });

  const role = await userRepo.findRoleById(payload.roleId);
  if (!role || role.name === 'tenant') {
    throw Object.assign(new Error('Tenant users must be created through tenant registration'), { statusCode: 400 });
  }

  const userCode = await generateUserCode(role.name);
  const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);
  const id = uuidv4();

  await userRepo.create({
    id,
    tenantId: payload.tenantId || null,
    roleId: payload.roleId,
    username: payload.username,
    email: payload.email,
    passwordHash,
    firstName: payload.firstName,
    lastName: payload.lastName,
    phone: payload.phone || null,
    profileImage: payload.profileImage || null,
    status: payload.status || 'active',
    userCode,
  });

  if (payload.departmentId) {
    await userRepo.setDepartment(id, payload.departmentId);
  }

  // Send welcome email (fire-and-forget)
  sendWelcomeEmail({
    email: payload.email,
    firstName: payload.firstName,
    username: payload.username,
    tempPassword: payload.password,
  }).catch(() => { });

  // Audit log
  auditService.logAction(payload.createdBy || null, 'create', 'user', id, null, { username: payload.username }).catch(() => { });

  return getUser(id);
};

export const updateUser = async (id, payload, currentUserId) => {
  if (currentUserId && id === currentUserId && payload.status && payload.status !== 'active') {
    throw Object.assign(new Error('You cannot deactivate your own account'), { statusCode: 400 });
  }
  const existing = await userRepo.findById(id);
  if (!existing) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  if (payload.username) {
    const dup = await userRepo.findByUsername(payload.username, id);
    if (dup) throw Object.assign(new Error('Username already exists'), { statusCode: 409 });
  }

  if (payload.email) {
    const dup = await userRepo.findByEmail(payload.email, id);
    if (dup) throw Object.assign(new Error('Email already exists'), { statusCode: 409 });
  }

  if (payload.roleId && existing.role_id !== payload.roleId) {
    const role = await userRepo.findRoleById(payload.roleId);
    if (role && role.name === 'tenant') {
      throw Object.assign(new Error('Cannot assign tenant role via user management'), { statusCode: 400 });
    }
  }

  await userRepo.update(id, {
    tenant_id: payload.tenantId,
    role_id: payload.roleId,
    username: payload.username,
    email: payload.email,
    first_name: payload.firstName,
    last_name: payload.lastName,
    phone: payload.phone,
    profile_image: payload.profileImage,
    status: payload.status,
  });

  if (payload.departmentId !== undefined) {
    await userRepo.setDepartment(id, payload.departmentId);
  }

  return getUser(id);
};

export const deleteUser = async (id, currentUserId) => {
  if (id === currentUserId) {
    throw Object.assign(new Error('You cannot delete your own account'), { statusCode: 400 });
  }
  const existing = await userRepo.findById(id);
  if (!existing) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  await userRepo.remove(id);
};

export const activateUser = async (id) => updateUser(id, { status: 'active' });
export const deactivateUser = async (id, currentUserId) => {
  if (currentUserId && id === currentUserId) {
    throw Object.assign(new Error('You cannot deactivate your own account'), { statusCode: 400 });
  }
  return updateUser(id, { status: 'inactive' }, currentUserId);
};

export const resetUserPassword = async (id, newPassword, actorId) => {
  const existing = await userRepo.findById(id);
  if (!existing) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await userRepo.updatePassword(id, passwordHash);

  sendPasswordResetEmail({
    email: existing.email,
    firstName: existing.first_name,
    newPassword,
  }).catch(() => { });

  auditService.logAction(actorId || null, 'password_reset', 'user', id, null, { targetUser: existing.username }).catch(() => { });
};

export const updateMyProfile = async (userId, payload) => {
  const existing = await userRepo.findById(userId);
  if (!existing) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  if (payload.username) {
    const dup = await userRepo.findByUsername(payload.username, userId);
    if (dup) throw Object.assign(new Error('Username already exists'), { statusCode: 409 });
  }

  if (payload.email) {
    const dup = await userRepo.findByEmail(payload.email, userId);
    if (dup) throw Object.assign(new Error('Email already exists'), { statusCode: 409 });
  }

  if (payload.newPassword) {
    const valid = await bcrypt.compare(payload.currentPassword, existing.password_hash);
    if (!valid) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 401 });

    const passwordHash = await bcrypt.hash(payload.newPassword, SALT_ROUNDS);
    await userRepo.updatePassword(userId, passwordHash);
  }

  await userRepo.update(userId, {
    username: payload.username,
    email: payload.email,
    first_name: payload.firstName,
    last_name: payload.lastName,
    phone: payload.phone,
    profile_image: payload.profileImage,
    theme_preference: payload.themePreference,
  });

  if (existing.tenant_id) {
    const contactPerson = [payload.firstName, payload.lastName].filter(Boolean).join(' ').trim() || undefined;
    const tenantUpdates = {};
    if (contactPerson) tenantUpdates.contact_person = contactPerson;
    if (payload.email) tenantUpdates.email = payload.email;
    if (payload.phone !== undefined) tenantUpdates.phone = payload.phone;
    if (payload.username) tenantUpdates.username = payload.username;
    if (Object.keys(tenantUpdates).length > 0) {
      await tenantRepo.update(existing.tenant_id, tenantUpdates).catch(() => {});
    }
  }

  return getUser(userId);
};

export const updateMyTheme = async (userId, themePreference) => {
  const allowed = ['system', 'light', 'dark'];
  if (!allowed.includes(themePreference)) {
    throw Object.assign(new Error('Invalid theme preference'), { statusCode: 400 });
  }
  await userRepo.update(userId, { theme_preference: themePreference });
  return getUser(userId);
};

export const getRoles = async () => userRepo.getAllRoles();