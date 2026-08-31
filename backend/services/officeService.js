import { v4 as uuidv4 } from 'uuid';
import * as officeRepo from '../repository/officeRepository.js';

export const listOffices = async (filters) => {
  return officeRepo.findAll(filters);
};

export const searchOffices = async (search) => {
  return officeRepo.searchPublic(search);
};

export const getOffice = async (id) => {
  const office = await officeRepo.findById(id);
  if (!office) throw Object.assign(new Error('Office location not found'), { statusCode: 404 });
  return office;
};

export const createOffice = async (data, userId) => {
  const office = {
    id: uuidv4(),
    userId,
    employeeName: data.employeeName,
    employeeNumber: data.employeeNumber || null,
    email: data.email || null,
    phoneExtension: data.phoneExtension || null,
    officeNumber: data.officeNumber || null,
    floor: data.floor || null,
    building: data.building,
    buildingId: data.buildingId || null,
    description: data.description || null,
    attachment: data.attachment || null,
    attachmentName: data.attachmentName || null,
    address: data.address || null,
    notes: data.notes || null,
  };
  await officeRepo.create(office);
  return officeRepo.findById(office.id);
};

export const updateOffice = async (id, data) => {
  const office = await officeRepo.findById(id);
  if (!office) throw Object.assign(new Error('Office location not found'), { statusCode: 404 });
  const allowed = [
    'employeeName', 'employeeNumber', 'email', 'phoneExtension', 'officeNumber',
    'floor', 'building', 'buildingId', 'description', 'attachment', 'attachmentName',
    'address', 'notes',
  ];
  const updateData = {};
  Object.keys(data).forEach(key => {
    if (allowed.includes(key)) updateData[key] = data[key];
  });
  if (Object.keys(updateData).length) {
    await officeRepo.update(id, updateData);
  }
  return officeRepo.findById(id);
};

export const deleteOffice = async (id) => {
  const office = await officeRepo.findById(id);
  if (!office) throw Object.assign(new Error('Office location not found'), { statusCode: 404 });
  await officeRepo.remove(id);
};

export const getBuildings = async () => {
  return officeRepo.getBuildings();
};

export const bookOffice = async (data, tenantId, bookedByUserId) => {
  const office = await officeRepo.findById(data.officeLocationId);
  if (!office) throw Object.assign(new Error('Office location not found'), { statusCode: 404 });
  if (office.availabilityStatus !== 'available') {
    throw Object.assign(new Error('Office is not available for booking'), { statusCode: 400 });
  }
  if (!data.startDate) {
    throw Object.assign(new Error('Start date is required'), { statusCode: 400 });
  }
  const booking = {
    id: uuidv4(),
    officeLocationId: data.officeLocationId,
    tenantId,
    bookedByUserId,
    purpose: data.purpose || 'Personal office use',
    startDate: data.startDate,
    endDate: data.endDate || null,
    notes: data.notes || null,
  };
  await officeRepo.createBooking(booking);
  return officeRepo.findBookingById(booking.id);
};

export const getMyBookings = async (tenantId, params) => {
  return officeRepo.findBookingsByTenant(tenantId, params);
};

export const getBookingById = async (id) => {
  const booking = await officeRepo.findBookingById(id);
  if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  return booking;
};

export const updateBooking = async (id, data, tenantId) => {
  const booking = await officeRepo.findBookingById(id);
  if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  if (booking.tenant_id !== tenantId) throw Object.assign(new Error('Not authorized'), { statusCode: 403 });
  const allowed = ['purpose', 'startDate', 'endDate', 'notes', 'status'];
  const updateData = {};
  Object.keys(data).forEach(key => {
    if (allowed.includes(key)) updateData[key] = data[key];
  });
  if (Object.keys(updateData).length) {
    await officeRepo.updateBooking(id, updateData);
  }
  return officeRepo.findBookingById(id);
};

export const cancelBooking = async (id, tenantId) => {
  const booking = await officeRepo.findBookingById(id);
  if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  if (booking.tenant_id !== tenantId) throw Object.assign(new Error('Not authorized'), { statusCode: 403 });
  await officeRepo.updateBooking(id, { status: 'cancelled' });
  return { success: true, message: 'Booking cancelled' };
};

export const getOfficeBookings = async (officeLocationId) => {
  return officeRepo.findBookingsByOffice(officeLocationId);
};

export const getOfficeStats = async (tenantId) => {
  return officeRepo.getOfficeStats(tenantId);
};
