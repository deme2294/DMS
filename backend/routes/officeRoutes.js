import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as officeController from '../controllers/officeController.js';
import * as officeFeedbackController from '../controllers/officeFeedbackController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRole } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';

import { uploadOfficeAttachment } from '../config/multer.js';

const router = Router();

router.get('/offices/public/search', officeController.searchOffices);
router.get('/offices/buildings', officeController.getBuildings);

router.use(authenticate);

// Tenant can view all offices (corporate directory) - MUST be before /offices/:id
router.get('/offices/tenant/view', requireRole('tenant'), officeController.getTenantOffices);

// Admin/Manager office management
router.get('/offices', authorize('office.read'), officeController.getOffices);
router.get('/offices/:id', officeController.getOfficeById);
router.post('/offices', authorize('departments.manage'), uploadOfficeAttachment.single('attachment'), officeController.createOffice);
router.put('/offices/:id', authorize('departments.manage'), uploadOfficeAttachment.single('attachment'), officeController.updateOffice);
router.delete('/offices/:id', authorize('departments.manage'), officeController.deleteOffice);

router.post('/offices/:id/book', requireRole('tenant'), officeController.bookOffice);
router.get('/bookings/my', requireRole('tenant'), officeController.getMyBookings);
router.get('/bookings/:id', requireRole('tenant'), officeController.getBookingById);
router.put('/bookings/:id', requireRole('tenant'), officeController.updateBooking);
router.delete('/bookings/:id', requireRole('tenant'), officeController.cancelBooking);
router.get('/offices/:id/bookings', authorize('office.read'), officeController.getOfficeBookings);

router.get('/offices/stats', requireRole('tenant'), officeController.getOfficeStats);

router.get('/offices/:id/feedback', officeFeedbackController.getOfficeFeedback);
router.post('/offices/:id/feedback', requireRole('tenant'), officeFeedbackController.createOfficeFeedback);
router.put('/offices/feedback/:id', authorize('feedback.update'), officeFeedbackController.updateOfficeFeedback);
router.delete('/offices/feedback/:id', authorize('feedback.delete'), officeFeedbackController.deleteOfficeFeedback);

// Office feedback replies
router.get('/offices/feedback/:id/replies', officeFeedbackController.getOfficeFeedbackReplies);
router.post('/offices/feedback/:id/replies', authorize('feedback.update'), officeFeedbackController.addOfficeFeedbackReply);

// Tenant office feedback view
router.get('/feedback/my-office-inquiries', requireRole('tenant'), officeFeedbackController.getTenantOfficeFeedback);

export default router;