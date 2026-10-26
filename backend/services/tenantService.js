import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as tenantRepo from '../repository/tenantRepository.js';
import pool from '../config/db.js';
import { sanitizeTenant } from '../models/Tenant.js';
import { generateUserCode } from './userService.js';
import {
  sendTenantRegistrationPendingEmail,
  sendTenantRegistrationAdminAlert,
  sendTenantApprovedEmail,
} from './emailService.js';

const SALT_ROUNDS = 10;

const trimPayload = (payload) => {
  const textFields = [
    'organizationName',
    'registrationNumber',
    'contactPerson',
    'email',
    'phone',
    'address',
    'notes',
    'status',
    'username',
    'password',
    'confirmPassword',
  ];
  const trimmed = { ...payload };
  textFields.forEach((field) => {
    if (typeof trimmed[field] === 'string') {
      trimmed[field] = trimmed[field].trim();
    }
  });
  return trimmed;
};

export const listTenants = async (query) => {
  const result = await tenantRepo.findAll(query);
  return {
    ...result,
    data: result.data.map(sanitizeTenant),
  };
};

export const getTenant = async (id) => {
  const tenant = await tenantRepo.findById(id);
  if (!tenant) throw Object.assign(new Error('Tenant not found'), { statusCode: 404 });
  return sanitizeTenant(tenant);
};

export const getTenantWithUsers = async (id) => {
  const tenant = await getTenant(id);
  const users = await tenantRepo.findUsersByTenantId(id);

  // Automatically reflect and synchronize user profile changes (name, email, phone) to tenant organization
  const primaryUser = users[0];
  if (primaryUser) {
    const fullName = [primaryUser.first_name, primaryUser.last_name].filter(Boolean).join(' ').trim();
    let needsDbSync = false;
    const syncFields = {};

    if (primaryUser.email && tenant.email !== primaryUser.email) {
      tenant.email = primaryUser.email;
      syncFields.email = primaryUser.email;
      needsDbSync = true;
    }
    if (primaryUser.phone && tenant.phone !== primaryUser.phone) {
      tenant.phone = primaryUser.phone;
      syncFields.phone = primaryUser.phone;
      needsDbSync = true;
    }
    if (fullName && tenant.contactPerson !== fullName) {
      tenant.contactPerson = fullName;
      syncFields.contact_person = fullName;
      needsDbSync = true;
    }
    if (needsDbSync) {
      await tenantRepo.update(id, syncFields).catch(() => {});
    }
  }

  return {
    ...tenant,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      phone: u.phone,
      status: u.status,
      lastLoginAt: u.last_login_at,
      profileImage: u.profile_image || null,
      role: u.role || 'tenant',
      userCode: u.user_code || null,
      createdAt: u.created_at || null,
    })),
  };
};

export const createTenant = async (payload, options = { createUser: false, createdBy: null }) => {
  const trimmed = trimPayload(payload);

  if (!trimmed.organizationName || trimmed.organizationName.length < 2) {
    throw Object.assign(new Error('Organization name is required'), { statusCode: 400 });
  }

  if (!trimmed.registrationNumber) {
    throw Object.assign(new Error('Registration number is required'), { statusCode: 400 });
  }

  if (!trimmed.contactPerson) {
    throw Object.assign(new Error('Contact person is required'), { statusCode: 400 });
  }

  if (!trimmed.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.email)) {
    throw Object.assign(new Error('Valid email is required'), { statusCode: 400 });
  }

  if (!trimmed.phone) {
    throw Object.assign(new Error('Phone number is required'), { statusCode: 400 });
  }

  if (!trimmed.username || trimmed.username.length < 3) {
    throw Object.assign(new Error('Username is required and must be at least 3 characters'), { statusCode: 400 });
  }

  if (!trimmed.password || trimmed.password.length < 8) {
    throw Object.assign(new Error('Password must be at least 8 characters'), { statusCode: 400 });
  }

  if (trimmed.password !== trimmed.confirmPassword) {
    throw Object.assign(new Error('Passwords do not match'), { statusCode: 400 });
  }

  const existingEmail = await tenantRepo.findByEmail(trimmed.email);
  if (existingEmail) {
    throw Object.assign(new Error('Email already exists'), { statusCode: 409 });
  }

  const existingUsername = await tenantRepo.findByUsername(trimmed.username);
  if (existingUsername) {
    throw Object.assign(new Error('Username already exists'), { statusCode: 409 });
  }

  const existingRegistration = await tenantRepo.findByRegistrationNumber(trimmed.registrationNumber);
  if (existingRegistration) {
    throw Object.assign(new Error('Registration number already exists'), { statusCode: 409 });
  }

  const passwordHash = await bcrypt.hash(trimmed.password, SALT_ROUNDS);
  const tenantId = uuidv4();
  const status = trimmed.status === 'inactive' ? 'inactive' : 'active';

  await tenantRepo.create({
    id: tenantId,
    organizationName: trimmed.organizationName,
    registrationNumber: trimmed.registrationNumber,
    contactPerson: trimmed.contactPerson,
    email: trimmed.email,
    phone: trimmed.phone || null,
    address: trimmed.address || null,
    notes: trimmed.notes || null,
    status,
    username: trimmed.username,
    password: passwordHash,
    createdBy: options.createdBy || null,
  });

  const saved = await tenantRepo.findById(tenantId);
  if (!saved) {
    throw Object.assign(new Error('Failed to retrieve created tenant'), { statusCode: 500 });
  }

  return {
    success: true,
    message: 'Tenant created successfully',
    data: {
      tenant_id: saved.tenant_id,
    },
  };
};

export const registerTenant = async (payload) => {
  const trimmed = trimPayload(payload);
  if (!trimmed.password || trimmed.password.length < 8) {
    throw Object.assign(new Error('Password must be at least 8 characters'), { statusCode: 400 });
  }
  if (trimmed.password !== trimmed.confirmPassword) {
    throw Object.assign(new Error('Passwords do not match'), { statusCode: 400 });
  }

  const existingEmail = await tenantRepo.findByEmail(trimmed.email);
  if (existingEmail) {
    throw Object.assign(new Error('Email already exists'), { statusCode: 409 });
  }

  const existingUsername = await tenantRepo.findByUsername(trimmed.username);
  if (existingUsername) {
    throw Object.assign(new Error('Username already exists'), { statusCode: 409 });
  }

  if (trimmed.registrationNumber) {
    const existingRegistration = await tenantRepo.findByRegistrationNumber(trimmed.registrationNumber);
    if (existingRegistration) {
      throw Object.assign(new Error('Registration number already exists'), { statusCode: 409 });
    }
  }

  const passwordHash = await bcrypt.hash(trimmed.password, SALT_ROUNDS);
  const tenantId = uuidv4();
  const roleId = await tenantRepo.getTenantRoleId();
  if (!roleId) throw Object.assign(new Error('Tenant role not configured'), { statusCode: 500 });

  await tenantRepo.create({
    id: tenantId,
    organizationName: trimmed.organizationName,
    registrationNumber: trimmed.registrationNumber || `REG-${tenantId.slice(0, 8).toUpperCase()}`,
    contactPerson: trimmed.contactPerson,
    email: trimmed.email,
    phone: trimmed.phone || null,
    address: trimmed.address || null,
    notes: trimmed.notes || null,
    status: 'pending',
    username: trimmed.username,
    password: passwordHash,
    createdBy: null,
  });

  const [existingUser] = await pool.query(
    'SELECT id FROM users WHERE username = :username OR email = :email LIMIT 1',
    { username: trimmed.username, email: trimmed.email }
  );

  if (existingUser.length) {
    throw Object.assign(new Error('Login username or email already exists'), { statusCode: 409 });
  }

  const nameParts = trimmed.contactPerson.trim().split(' ');
  const firstName = nameParts[0] || trimmed.contactPerson;
  const lastName = nameParts.slice(1).join(' ') || 'User';

  const userCode = await generateUserCode('tenant');

  await tenantRepo.createTenantUser({
    id: uuidv4(),
    tenantId,
    roleId,
    username: trimmed.username,
    email: trimmed.email,
    passwordHash,
    firstName,
    lastName,
    phone: trimmed.phone || null,
    status: 'inactive',
    userCode,
  });

  const saved = await tenantRepo.findById(tenantId);
  if (!saved) {
    throw Object.assign(new Error('Failed to retrieve registered tenant'), { statusCode: 500 });
  }

  // 1. Send confirmation to tenant's created email
  sendTenantRegistrationPendingEmail({
    email: trimmed.email,
    organizationName: trimmed.organizationName,
    contactPerson: trimmed.contactPerson,
    username: trimmed.username,
  }).catch(() => {});

  // 2. Alert HDMS system email (demshuterefe94@gmail.com) of the new external registration
  sendTenantRegistrationAdminAlert({
    tenant: {
      organizationName: trimmed.organizationName,
      contactPerson: trimmed.contactPerson,
      email: trimmed.email,
      phone: trimmed.phone,
      registrationNumber: trimmed.registrationNumber || `REG-${tenantId.slice(0, 8).toUpperCase()}`,
    },
  }).catch(() => {});

  return {
    success: true,
    message: 'Registration submitted. Awaiting admin approval.',
    data: { tenant_id: saved.tenant_id },
  };
};

export const updateTenant = async (id, payload, restrictFields = false) => {
  const existing = await tenantRepo.findById(id);
  if (!existing) throw Object.assign(new Error('Tenant not found'), { statusCode: 404 });

  const trimmed = trimPayload(payload);

  if (trimmed.email) {
    const dup = await tenantRepo.findByEmail(trimmed.email, id);
    if (dup) throw Object.assign(new Error('Email already exists'), { statusCode: 409 });
  }

  if (trimmed.username) {
    const dup = await tenantRepo.findByUsername(trimmed.username, id);
    if (dup) throw Object.assign(new Error('Username already exists'), { statusCode: 409 });
  }

  if (trimmed.registrationNumber) {
    const dup = await tenantRepo.findByRegistrationNumber(trimmed.registrationNumber, id);
    if (dup) throw Object.assign(new Error('Registration number already exists'), { statusCode: 409 });
  }

  const updatePayload = restrictFields
    ? {
        contact_person: trimmed.contactPerson,
        email: trimmed.email,
        phone: trimmed.phone,
        address: trimmed.address,
        notes: trimmed.notes,
      }
    : {
        organization_name: trimmed.organizationName,
        registration_number: trimmed.registrationNumber,
        contact_person: trimmed.contactPerson,
        email: trimmed.email,
        phone: trimmed.phone,
        address: trimmed.address,
        notes: trimmed.notes,
        status: trimmed.status,
        username: trimmed.username,
        password: trimmed.password ? await bcrypt.hash(trimmed.password, SALT_ROUNDS) : undefined,
      };

  await tenantRepo.update(id, updatePayload);

  // Synchronize changes to linked user accounts for this tenant
  const userSync = {};
  if (trimmed.email) userSync.email = trimmed.email;
  if (trimmed.phone !== undefined) userSync.phone = trimmed.phone;
  if (trimmed.contactPerson) {
    const parts = trimmed.contactPerson.trim().split(' ');
    userSync.first_name = parts[0] || trimmed.contactPerson;
    userSync.last_name = parts.slice(1).join(' ') || '';
  }
  if (Object.keys(userSync).length > 0) {
    const setClause = Object.keys(userSync).map((k) => `${k} = :${k}`).join(', ');
    await pool.query(
      `UPDATE users SET ${setClause} WHERE tenant_id = :tenantId`,
      { ...userSync, tenantId: id }
    ).catch(() => {});
  }

  return getTenant(id);
};

export const deleteTenant = async (id) => {
  const existing = await tenantRepo.findById(id);
  if (!existing) throw Object.assign(new Error('Tenant not found'), { statusCode: 404 });

  const ticketCount = await tenantRepo.countTickets(id);
  if (ticketCount > 0) {
    throw Object.assign(
      new Error('Cannot delete tenant with existing tickets'),
      { statusCode: 400 }
    );
  }

  await tenantRepo.remove(id);
};

export const activateTenant = async (id) => {
  const tenant = await getTenant(id);
  await tenantRepo.update(id, { status: 'active' });

  await pool.query(
    `UPDATE users SET status = 'active'
     WHERE tenant_id = :tenantId`,
    { tenantId: id }
  );

  const updatedTenant = await getTenant(id);

  // Send activation notice to tenant's email address
  if (updatedTenant && updatedTenant.email) {
    sendTenantApprovedEmail({
      email: updatedTenant.email,
      organizationName: updatedTenant.organization_name || updatedTenant.organizationName,
      contactPerson: updatedTenant.contact_person || updatedTenant.contactPerson,
    }).catch(() => {});
  }

  return updatedTenant;
};

export const deactivateTenant = async (id) => {
  await tenantRepo.update(id, { status: 'inactive' });

  await pool.query(
    `UPDATE users SET status = 'inactive'
     WHERE tenant_id = :tenantId`,
    { tenantId: id }
  );

  return getTenant(id);
};

export const approveTenant = async (id) => activateTenant(id);

export const getMyTenantProfile = async (user) => {
  if (!user.tenant_id) {
    throw Object.assign(new Error('Tenant profile not found'), { statusCode: 404 });
  }
  return getTenantWithUsers(user.tenant_id);
};

export const updateMyTenantProfile = async (user, payload) => {
  if (!user.tenant_id) {
    throw Object.assign(new Error('Tenant profile not found'), { statusCode: 404 });
  }
  return updateTenant(user.tenant_id, payload, true);
};
