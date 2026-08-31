import * as officeService from '../services/officeService.js';
import { HTTP } from '../config/constants.js';

export const getOffices = async (req, res, next) => {
  try {
    const result = await officeService.listOffices(req.query);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getTenantOffices = async (req, res, next) => {
  try {
    const result = await officeService.listOffices(req.query);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const searchOffices = async (req, res, next) => {
  try {
    const results = await officeService.searchOffices(req.query.q);
    res.status(HTTP.OK).json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};

export const getBuildings = async (req, res, next) => {
  try {
    const buildings = await officeService.getBuildings();
    res.status(HTTP.OK).json({ success: true, data: buildings });
  } catch (err) {
    next(err);
  }
};

export const getOfficeById = async (req, res, next) => {
  try {
    const office = await officeService.getOffice(req.params.id);
    res.status(HTTP.OK).json({ success: true, data: office });
  } catch (err) {
    next(err);
  }
};

export const createOffice = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (req.file) {
      payload.attachment = `/uploads/offices/${req.file.filename}`;
      payload.attachmentName = req.file.originalname;
    }
    const office = await officeService.createOffice(payload, req.user.id);
    res.status(HTTP.CREATED).json({ success: true, message: 'Office location created', data: office });
  } catch (err) {
    next(err);
  }
};

export const updateOffice = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (req.file) {
      payload.attachment = `/uploads/offices/${req.file.filename}`;
      payload.attachmentName = req.file.originalname;
    }
    const office = await officeService.updateOffice(req.params.id, payload);
    res.status(HTTP.OK).json({ success: true, message: 'Office location updated', data: office });
  } catch (err) {
    next(err);
  }
};

export const deleteOffice = async (req, res, next) => {
  try {
    await officeService.deleteOffice(req.params.id);
    res.status(HTTP.OK).json({ success: true, message: 'Office location deleted' });
  } catch (err) {
    next(err);
  }
};

export const bookOffice = async (req, res, next) => {
  try {
    const booking = await officeService.bookOffice(req.body, req.user.tenant_id, req.user.id);
    res.status(HTTP.CREATED).json({ success: true, message: 'Office booked successfully', data: booking });
  } catch (err) {
    next(err);
  }
};

export const getMyBookings = async (req, res, next) => {
  try {
    const result = await officeService.getMyBookings(req.user.tenant_id, req.query);
    res.status(HTTP.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const booking = await officeService.getBookingById(req.params.id);
    res.status(HTTP.OK).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

export const updateBooking = async (req, res, next) => {
  try {
    const booking = await officeService.updateBooking(req.params.id, req.body, req.user.tenant_id);
    res.status(HTTP.OK).json({ success: true, message: 'Booking updated', data: booking });
  } catch (err) {
    next(err);
  }
};

export const cancelBooking = async (req, res, next) => {
  try {
    await officeService.cancelBooking(req.params.id, req.user.tenant_id);
    res.status(HTTP.OK).json({ success: true, message: 'Booking cancelled' });
  } catch (err) {
    next(err);
  }
};

export const getOfficeBookings = async (req, res, next) => {
  try {
    const bookings = await officeService.getOfficeBookings(req.params.id);
    res.status(HTTP.OK).json({ success: true, data: bookings });
  } catch (err) {
    next(err);
  }
};

export const getOfficeStats = async (req, res, next) => {
  try {
    const stats = await officeService.getOfficeStats(req.user.tenant_id);
    res.status(HTTP.OK).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};