import * as operationalService from '../services/operationalEscalationService.js';
import * as slaEscalationRepo from '../repository/slaEscalationRepository.js';
import * as ticketRepo from '../repository/ticketRepository.js';
import { canAccessTicket } from '../services/ticketService.js';

export const requestEscalation = async (req, res, next) => {
  try {
    const meta = { ip: req.ip, browser: req.headers['user-agent'] };
    const escalation = await operationalService.requestOperationalEscalation(
      req.user,
      req.params.id,
      req.body,
      meta
    );
    res.status(201).json({ success: true, data: escalation, message: 'Operational escalation submitted successfully' });
  } catch (err) {
    next(err);
  }
};

export const managerReview = async (req, res, next) => {
  try {
    const meta = { ip: req.ip, browser: req.headers['user-agent'] };
    const updated = await operationalService.reviewByManager(
      req.user,
      req.params.id,
      req.params.escalationId,
      req.body,
      meta
    );
    res.json({ success: true, data: updated, message: 'Manager review recorded successfully' });
  } catch (err) {
    next(err);
  }
};

export const adminReview = async (req, res, next) => {
  try {
    const meta = { ip: req.ip, browser: req.headers['user-agent'] };
    const updated = await operationalService.reviewByAdmin(
      req.user,
      req.params.id,
      req.params.escalationId,
      req.body,
      meta
    );
    res.json({ success: true, data: updated, message: 'Admin decision recorded successfully' });
  } catch (err) {
    next(err);
  }
};

export const getEscalations = async (req, res, next) => {
  try {
    const escalations = await operationalService.getOperationalEscalations(req.user, req.params.id);
    res.json({ success: true, data: escalations });
  } catch (err) {
    next(err);
  }
};

export const getSlaEscalations = async (req, res, next) => {
  try {
    const ticket = await ticketRepo.findById(req.params.id);
    if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
    if (!(await canAccessTicket(req.user, ticket))) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const slaEscalations = await slaEscalationRepo.findByTicketId(ticket.id);
    res.json({ success: true, data: slaEscalations });
  } catch (err) {
    next(err);
  }
};
