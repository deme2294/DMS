import * as chatService from '../services/chatService.js';
import { HTTP } from '../config/constants.js';
import path from 'path';

// ===================== CHAT ROOMS =====================

export const getUserRooms = async (req, res, next) => {
  try {
    const rooms = await chatService.getUserRooms(req.user.id);
    res.status(HTTP.OK).json({ success: true, data: rooms });
  } catch (err) {
    next(err);
  }
};

export const getRoomById = async (req, res, next) => {
  try {
    const room = await chatService.getRoomById(req.params.roomId, req.user.id);
    res.status(HTTP.OK).json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
};

export const createTicketRoom = async (req, res, next) => {
  try {
    const room = await chatService.createTicketRoom(req.body.ticketId, req.user.id);
    res.status(HTTP.CREATED).json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
};

export const createDepartmentRoom = async (req, res, next) => {
  try {
    const room = await chatService.createDepartmentRoom(req.body.departmentId, req.user.id);
    res.status(HTTP.CREATED).json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
};

export const createDirectRoom = async (req, res, next) => {
  try {
    const io = req.app?.get('io');
    const room = await chatService.createDirectRoom(
      req.user.id,
      req.body.userId,
      req.user.role,
      req.body.initialMode || 'chat',
      io
    );
    res.status(HTTP.CREATED).json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
};

export const getRoomParticipants = async (req, res, next) => {
  try {
    const participants = await chatService.getRoomParticipants(req.params.roomId, req.user.id);
    res.status(HTTP.OK).json({ success: true, data: participants });
  } catch (err) {
    next(err);
  }
};

export const addParticipant = async (req, res, next) => {
  try {
    const participant = await chatService.addParticipantToRoom(
      req.params.roomId,
      req.body.userId,
      req.user.id
    );
    res.status(HTTP.CREATED).json({ success: true, data: participant });
  } catch (err) {
    next(err);
  }
};

// ===================== MESSAGES =====================

export const getRoomMessages = async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const messages = await chatService.getRoomMessages(
      req.params.roomId,
      req.user.id,
      parseInt(limit),
      parseInt(offset)
    );
    res.status(HTTP.OK).json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const message = await chatService.sendMessage(req.body, req.user.id);
    res.status(HTTP.CREATED).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
};

export const editMessage = async (req, res, next) => {
  try {
    const message = await chatService.editMessage(
      req.params.messageId,
      req.body.message,
      req.user.id
    );
    res.status(HTTP.OK).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
};

export const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const deleteType = req.body?.deleteType || req.query?.deleteType || 'everyone';
    const result = await chatService.deleteMessage(messageId, req.user.id, deleteType);
    res.status(HTTP.OK).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { messageIds = [] } = req.body;
    const result = await chatService.markMessagesAsRead(roomId, req.user.id, messageIds);
    res.status(HTTP.OK).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await chatService.getUnreadCount(req.user.id);
    res.status(HTTP.OK).json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
};

// ===================== SEARCH =====================

export const searchMessages = async (req, res, next) => {
  try {
    const { q } = req.query;
    const results = await chatService.searchMessages(req.user.id, q);
    res.status(HTTP.OK).json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};

// ===================== UPLOAD =====================

export const uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      throw Object.assign(new Error('No file uploaded'), { statusCode: 400 });
    }

    const relativePath = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');

    const file = {
      path: relativePath,
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    };

    res.status(HTTP.OK).json({ success: true, data: file });
  } catch (err) {
    next(err);
  }
};


// ===================== ONLINE STATUS =====================

export const getUserOnlineStatus = async (req, res, next) => {
  try {
    const status = await chatService.getUserOnlineStatus(req.params.userId);
    res.status(HTTP.OK).json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
};

export const getOnlineUsers = async (req, res, next) => {
  try {
    const users = await chatService.getOnlineUsers();
    res.status(HTTP.OK).json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
};

export const getChatUsers = async (req, res, next) => {
  try {
    const users = await chatService.getChatUsers(req.user.id, req.user.role);
    res.status(HTTP.OK).json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
};

export const getChatDepartments = async (req, res, next) => {
  try {
    const departments = await chatService.getChatDepartments(req.user.id, req.user.role);
    res.status(HTTP.OK).json({ success: true, data: departments });
  } catch (err) {
    next(err);
  }
};

export const getDepartmentChatMembers = async (req, res, next) => {
  try {
    const members = await chatService.getDepartmentChatMembers(req.params.departmentId);
    res.status(HTTP.OK).json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
};

export const getTicketChatMembers = async (req, res, next) => {
  try {
    const members = await chatService.getTicketChatMembers(req.params.ticketId);
    res.status(HTTP.OK).json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
};

export const getRegisteredContacts = async (req, res, next) => {
  try {
    const contacts = await chatService.getRegisteredContactsForMeeting(req.user.id);
    res.status(HTTP.OK).json({ success: true, data: contacts });
  } catch (err) {
    next(err);
  }
};

export const sendMeetingInvite = async (req, res, next) => {
  try {
    const io = req.app?.get('io');
    const origin = req.headers.origin || req.headers.referer || 'http://10.195.207.9:5173';
    const result = await chatService.sendMeetingInvite({ ...req.body, origin }, req.user.id, io);
    res.status(HTTP.CREATED).json({
      success: true,
      message: 'Video conference invitation sent and emailed successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyMeetingAccess = async (req, res, next) => {
  try {
    const result = await chatService.verifyMeetingAccess({
      meetingUrl: req.body.meetingUrl,
      roomId: req.body.roomId,
      passcode: req.body.passcode,
      userId: req.user.id,
      userRole: req.user.role,
    });
    res.status(HTTP.OK).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};



