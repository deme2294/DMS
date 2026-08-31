import api from './axios';

export interface ChatRoom {
  id: string;
  room_type: 'ticket' | 'direct' | 'department';
  ticket_id?: string;
  department_id?: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator_first_name?: string;
  creator_last_name?: string;
  department_name?: string;
  ticket_reference?: string;
  ticket_title?: string;
  other_user_id?: string;
  other_user_first_name?: string;
  other_user_last_name?: string;
  other_user_username?: string;
  other_user_role?: string;
  other_user_online?: boolean | number;
  other_user_last_seen?: string;
  online_members_count?: number;
  total_members_count?: number;
  message_count?: number;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

export interface ChatMember {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email?: string;
  role?: string;
  is_online: boolean;
  last_seen?: string;
  ticket_role?: string;
}


export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: 'text' | 'image' | 'file';
  message: string;
  attachment_path?: string;
  attachment_name?: string;
  attachment_size?: number;
  is_edited: boolean;
  edited_at?: string;
  is_deleted: boolean;
  deleted_at?: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role_name?: string;
  sender_role?: string;
}

export interface ChatParticipant {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  last_seen?: string;
  is_active: boolean;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  role_name: string;
  is_online?: boolean;
}

// ===================== ROOMS =====================

export const fetchUserRooms = async () => {
  return api.get<{ success: boolean; data: ChatRoom[] }>('/chat/rooms');
};

export const fetchRoomById = async (roomId: string) => {
  return api.get<{ success: boolean; data: ChatRoom }>(`/chat/rooms/${roomId}`);
};

export const createTicketRoom = async (payload: { ticketId: string; name?: string }) => {
  return api.post<{ success: boolean; data: ChatRoom }>('/chat/rooms/ticket', payload);
};

export const createDepartmentRoom = async (payload: { departmentId: string; name?: string }) => {
  return api.post<{ success: boolean; data: ChatRoom }>('/chat/rooms/department', payload);
};

export const createDirectRoom = async (payload: { userId: string; name?: string }) => {
  return api.post<{ success: boolean; data: ChatRoom }>('/chat/rooms/direct', payload);
};

export const fetchRoomParticipants = async (roomId: string) => {
  return api.get<{ success: boolean; data: ChatParticipant[] }>(`/chat/rooms/${roomId}/participants`);
};

export const addParticipant = async (roomId: string, userId: string) => {
  return api.post<{ success: boolean; data: ChatParticipant }>(`/chat/rooms/${roomId}/participants`, { userId });
};

// ===================== MESSAGES =====================

export const fetchRoomMessages = async (roomId: string, limit = 50, offset = 0) => {
  return api.get<{ success: boolean; data: ChatMessage[] }>(`/chat/rooms/${roomId}/messages`, {
    params: { limit, offset },
  });
};

export const sendMessage = async (data: {
  roomId: string;
  message: string;
  messageType?: 'text' | 'image' | 'file';
  attachmentPath?: string;
  attachmentName?: string;
  attachmentSize?: number;
}) => {
  return api.post<{ success: boolean; data: ChatMessage }>('/chat/messages', data);
};

export const editMessage = async (messageId: string, message: string) => {
  return api.put<{ success: boolean; data: ChatMessage }>(`/chat/messages/${messageId}`, { message });
};

export const deleteMessage = async (messageId: string) => {
  return api.delete<{ success: boolean; data: { success: boolean } }>(`/chat/messages/${messageId}`);
};

export const markMessagesAsRead = async (roomId: string, messageIds?: string[]) => {
  return api.post<{ success: boolean; data: { success: boolean } }>(`/chat/rooms/${roomId}/read`, {
    messageIds,
  });
};

export const fetchUnreadCount = async () => {
  return api.get<{ success: boolean; data: { count: number } }>('/chat/unread');
};

// ===================== SEARCH =====================

export const searchMessages = async (query: string) => {
  return api.get<{ success: boolean; data: ChatMessage[] }>('/chat/search', {
    params: { q: query },
  });
};

// ===================== UPLOAD =====================

export const uploadChatFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  return api.post<{
    success: boolean;
    data: {
      path: string;
      name: string;
      size: number;
      mimetype: string;
    };
  }>('/chat/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const fetchDepartmentChatMembers = async (departmentId: string) => {
  return api.get<{ success: boolean; data: ChatMember[] }>(`/chat/departments/${departmentId}/members`);
};

export const fetchTicketChatMembers = async (ticketId: string) => {
  return api.get<{ success: boolean; data: ChatMember[] }>(`/chat/tickets/${ticketId}/members`);
};

