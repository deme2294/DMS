let ioInstance = null;

export const setIo = (io) => {
  ioInstance = io;
};

export const getIo = () => ioInstance;

export const emitToUser = (userId, event, payload) => {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit(event, payload);
};

export const emitToRoom = (roomId, event, payload) => {
  if (!ioInstance) return;
  ioInstance.to(`room:${roomId}`).emit(event, payload);
};

export const emitToTicket = (ticketId, event, payload) => {
  if (!ioInstance) return;
  ioInstance.to(`ticket:${ticketId}`).emit(event, payload);
};

export const broadcastTicketEvent = (ticketId, event, payload) => {
  emitToTicket(ticketId, event, payload);
};

