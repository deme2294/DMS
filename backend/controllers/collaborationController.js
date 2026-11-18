import * as collaborationService from '../services/collaborationService.js';

export const addCollaborators = async (req, res, next) => {
  try {
    const meta = { ip: req.ip, browser: req.headers['user-agent'] };
    const collaborators = await collaborationService.addCollaborators(
      req.user,
      req.params.id,
      req.body,
      meta
    );
    res.status(201).json({ success: true, data: collaborators, message: 'Collaborator(s) added successfully' });
  } catch (err) {
    next(err);
  }
};

export const recordContribution = async (req, res, next) => {
  try {
    const meta = { ip: req.ip, browser: req.headers['user-agent'] };
    const updated = await collaborationService.recordContribution(
      req.user,
      req.params.id,
      req.body,
      meta
    );
    res.json({ success: true, data: updated, message: 'Contribution recorded successfully' });
  } catch (err) {
    next(err);
  }
};

export const removeCollaborator = async (req, res, next) => {
  try {
    const meta = { ip: req.ip, browser: req.headers['user-agent'] };
    await collaborationService.removeCollaborator(
      req.user,
      req.params.id,
      req.params.userId,
      meta
    );
    res.json({ success: true, message: 'Collaborator removed successfully' });
  } catch (err) {
    next(err);
  }
};

export const getCollaborators = async (req, res, next) => {
  try {
    const collaborators = await collaborationService.getCollaborators(req.user, req.params.id);
    res.json({ success: true, data: collaborators });
  } catch (err) {
    next(err);
  }
};
