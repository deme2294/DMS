import { useState, useEffect, useRef, useMemo } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import * as chatApi from '../../api/chatApi';
import { buildAttachmentUrl } from '../../utils/attachmentUtils';
import api from '../../api/axios';
import { canContact } from '../../config/contact';
import type { ChatRoom, ChatMessage, ChatParticipant, ChatMember } from '../../api/chatApi';
import styles from './ChatPage.module.css';

interface OnlineUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_online: boolean;
}

interface Department {
  id: string;
  name: string;
  code?: string;
}

interface Ticket {
  id: string;
  title: string;
  ticket_number: string;
  priority?: string;
  status?: string;
}

const getRoleColor = (role?: string) => {
  switch (role?.toLowerCase()) {
    case 'ceo':
      return { bg: '#f5f3ff', border: '#ddd6fe', text: '#7c3aed' };
    case 'admin':
      return { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' };
    case 'manager':
      return { bg: '#ecfdf5', border: '#a7f3d0', text: '#059669' };
    case 'staff':
      return { bg: '#f0f9ff', border: '#bae6fd', text: '#0284c7' };
    case 'tenant':
      return { bg: '#fffbeb', border: '#fde68a', text: '#d97706' };
    default:
      return { bg: '#f1f5f9', border: '#e2e8f0', text: '#64748b' };
  }
};

const getAvatarGradient = (str: string) => {
  const gradients = [
    'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    'linear-gradient(135deg, #ec4899, #be185d)',
    'linear-gradient(135deg, #10b981, #047857)',
    'linear-gradient(135deg, #f59e0b, #b45309)',
    'linear-gradient(135deg, #06b6d4, #0e7490)',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
};

const formatMessageDateGroup = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

const formatTimeOnly = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function ChatPage() {
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [messageText, setMessageText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'direct' | 'department' | 'ticket'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);

  // New Chat Modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allUsers, setAllUsers] = useState<OnlineUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [modalUserTab, setModalUserTab] = useState<'all' | 'online'>('all');
  
  const [chatType, setChatType] = useState<'direct' | 'department' | 'ticket'>('direct');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Modal members preview
  const [modalMembers, setModalMembers] = useState<ChatMember[]>([]);
  const [loadingModalMembers, setLoadingModalMembers] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user: authUser } = useAuth();
  // Prefer the authenticated user (has role/id) and fall back to any persisted
  // 'user' object in localStorage for backward compatibility.
  const currentUser = authUser || JSON.parse(localStorage.getItem('user') || '{}');

  // Auto-select room when navigated from notification or with state
  useEffect(() => {
    const state = location.state as { selectedRoomId?: string; userId?: string } | null;
    if (!state?.selectedRoomId && !state?.userId) return;

    if (state.selectedRoomId) {
      const roomId = state.selectedRoomId;
      const existingRoom = rooms.find((r) => r.id === roomId);
      if (existingRoom) {
        setSelectedRoom(existingRoom);
        navigate(location.pathname, { replace: true, state: {} });
        return;
      }

      let cancelled = false;
      const fetchRoom = async () => {
        try {
          const res = await chatApi.fetchRoomById(roomId);
          if (!cancelled && res.data.data) {
            setSelectedRoom(res.data.data);
          }
        } catch (error) {
          if (!cancelled) {
            console.error('Failed to fetch room from notification:', error);
          }
        } finally {
          if (!cancelled) {
            navigate(location.pathname, { replace: true, state: {} });
          }
        }
      };

      fetchRoom();
      return () => {
        cancelled = true;
      };
    } else if (state.userId) {
      let cancelled = false;
      const createDirect = async () => {
        try {
          const res = await chatApi.createDirectRoom({ userId: state.userId! });
          if (!cancelled && res.data.data) {
            setSelectedRoom(res.data.data);
            loadRooms();
          }
        } catch (error) {
          if (!cancelled) {
            console.error('Failed to open direct chat:', error);
          }
        } finally {
          if (!cancelled) {
            navigate(location.pathname, { replace: true, state: {} });
          }
        }
      };

      createDirect();
      return () => {
        cancelled = true;
      };
    }
  }, [location.state, rooms, navigate]);

  const loadRooms = async (autoSelect = false) => {
    setLoading(true);
    try {
      const res = await chatApi.fetchUserRooms();
      const loadedRooms = res.data.data || [];
      setRooms(loadedRooms);
      if (autoSelect && loadedRooms.length > 0) {
        setSelectedRoom((prev) => {
          if (!prev) return loadedRooms[0];
          const updated = loadedRooms.find((r) => r.id === prev.id);
          return updated || prev;
        });
      }
    } catch (error) {
      console.error('Failed to load rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await chatApi.fetchUnreadCount();
      setUnreadCount(res.data.data?.count || 0);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  useEffect(() => {
    loadRooms(true);
    loadUnreadCount();
  }, []);

  const loadAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const usersRes = await api.get('/chat/users');
      const usersData = usersRes.data.data || [];
      setAllUsers(usersData);
      
      try {
        const deptRes = await api.get('/chat/departments');
        setDepartments(deptRes.data.data || []);
      } catch (error: any) {
        console.error('Failed to load departments:', error);
        setDepartments([]);
      }
      
      try {
        const ticketsRes = await api.get('/tickets');
        setTickets(ticketsRes.data.data || []);
      } catch (error: any) {
        if (error.response?.status !== 403) {
          console.error('Failed to load tickets:', error);
        }
        setTickets([]);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleStartNewChat = () => {
    loadAllUsers();
    setUserSearchQuery('');
    setModalUserTab('all');
    setSelectedUserId('');
    setSelectedDepartmentId('');
    setSelectedTicketId('');
    setModalMembers([]);
    setShowNewChatModal(true);
  };

  // Fetch department/ticket members preview in modal
  useEffect(() => {
    if (!showNewChatModal) {
      setModalMembers([]);
      return;
    }

    if (chatType === 'department' && selectedDepartmentId) {
      setLoadingModalMembers(true);
      chatApi.fetchDepartmentChatMembers(selectedDepartmentId)
        .then((res) => setModalMembers(res.data.data || []))
        .catch((err) => {
          console.error('Failed to load department members:', err);
          setModalMembers([]);
        })
        .finally(() => setLoadingModalMembers(false));
    } else if (chatType === 'ticket' && selectedTicketId) {
      setLoadingModalMembers(true);
      chatApi.fetchTicketChatMembers(selectedTicketId)
        .then((res) => setModalMembers(res.data.data || []))
        .catch((err) => {
          console.error('Failed to load ticket members:', err);
          setModalMembers([]);
        })
        .finally(() => setLoadingModalMembers(false));
    } else {
      setModalMembers([]);
    }
  }, [showNewChatModal, chatType, selectedDepartmentId, selectedTicketId]);

  const handleCreateRoom = async () => {
    if (creatingRoom) return;
    
    setCreatingRoom(true);
    try {
      let response;
      
      if (chatType === 'direct') {
        if (!selectedUserId) return;
        response = await chatApi.createDirectRoom({
          userId: selectedUserId,
          name: newChatName || undefined,
        });
      } else if (chatType === 'department') {
        if (!selectedDepartmentId) return;
        response = await chatApi.createDepartmentRoom({
          departmentId: selectedDepartmentId,
          name: newChatName || undefined,
        });
      } else if (chatType === 'ticket') {
        if (!selectedTicketId) return;
        response = await chatApi.createTicketRoom({
          ticketId: selectedTicketId,
          name: newChatName || undefined,
        });
      }
      
      await loadRooms();
      if (response?.data?.data) {
        setSelectedRoom(response.data.data);
      }
      
      setShowNewChatModal(false);
      setChatType('direct');
      setSelectedUserId('');
      setSelectedDepartmentId('');
      setSelectedTicketId('');
      setNewChatName('');
    } catch (error: any) {
      console.error('Failed to create room:', error);
      alert(error.response?.data?.message || 'Failed to create chat room.');
    } finally {
      setCreatingRoom(false);
    }
  };

  // Load messages & participants when room selected
  useEffect(() => {
    if (!selectedRoom) return;
    loadMessages(selectedRoom.id);
    loadParticipants(selectedRoom.id);
    setMobileSidebarOpen(false);
  }, [selectedRoom]);

  // Join socket room
  useEffect(() => {
    if (!socket || !selectedRoom) return;
    socket.emit('join-room', selectedRoom.id);

    return () => {
      socket.emit('leave-room', selectedRoom.id);
    };
  }, [socket, selectedRoom]);

  const loadMessages = async (roomId: string) => {
    try {
      const res = await chatApi.fetchRoomMessages(roomId);
      setMessages(res.data.data || []);
      scrollToBottom();
      
      await chatApi.markMessagesAsRead(roomId);
      loadUnreadCount();
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const loadParticipants = async (roomId: string) => {
    try {
      const res = await chatApi.fetchRoomParticipants(roomId);
      setParticipants(res.data.data || []);
    } catch (error) {
      console.error('Failed to load participants:', error);
    }
  };

  // Socket event listeners with real-time online status updates
  useEffect(() => {
    if (!socket) return;

    socket.on('new-message', (message: ChatMessage) => {
      if (message.room_id === selectedRoom?.id) {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
        
        if (message.sender_id !== currentUser.id) {
          chatApi.markMessagesAsRead(message.room_id, [message.id]);
        }
      }
      loadRooms();
      loadUnreadCount();
    });

    socket.on('message-edited', (message: ChatMessage) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? message : m))
      );
    });

    socket.on('message-deleted', ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    socket.on('user-typing', (data: { userId: string; firstName: string; lastName: string }) => {
      setTypingUsers((prev) => new Set(prev).add(`${data.firstName} ${data.lastName}`));
    });

    socket.on('user-stopped-typing', (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        participants.forEach((p) => {
          if (p.user_id === data.userId) {
            newSet.delete(`${p.first_name} ${p.last_name}`);
          }
        });
        return newSet;
      });
    });

    socket.on('user-online', (data: { userId: string; username?: string }) => {
      if (data?.userId) {
        setParticipants((prev) =>
          prev.map((p) => (p.user_id === data.userId ? { ...p, is_online: true } : p))
        );
        setRooms((prev) =>
          prev.map((r) => {
            if (r.other_user_id === data.userId) {
              return { ...r, other_user_online: true };
            }
            return r;
          })
        );
        setAllUsers((prev) =>
          prev.map((u) => (u.id === data.userId ? { ...u, is_online: true } : u))
        );
        setModalMembers((prev) =>
          prev.map((m) => (m.id === data.userId ? { ...m, is_online: true } : m))
        );
      }
      if (selectedRoom) loadParticipants(selectedRoom.id);
    });

    socket.on('user-offline', (data: { userId: string; username?: string }) => {
      if (data?.userId) {
        setParticipants((prev) =>
          prev.map((p) => (p.user_id === data.userId ? { ...p, is_online: false } : p))
        );
        setRooms((prev) =>
          prev.map((r) => {
            if (r.other_user_id === data.userId) {
              return { ...r, other_user_online: false };
            }
            return r;
          })
        );
        setAllUsers((prev) =>
          prev.map((u) => (u.id === data.userId ? { ...u, is_online: false } : u))
        );
        setModalMembers((prev) =>
          prev.map((m) => (m.id === data.userId ? { ...m, is_online: false } : m))
        );
      }
      if (selectedRoom) loadParticipants(selectedRoom.id);
    });

    return () => {
      socket.off('new-message');
      socket.off('message-edited');
      socket.off('message-deleted');
      socket.off('user-typing');
      socket.off('user-stopped-typing');
      socket.off('user-online');
      socket.off('user-offline');
    };
  }, [socket, selectedRoom, participants, currentUser.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedRoom || !socket || sending) return;

    setSending(true);
    try {
      await chatApi.sendMessage({
        roomId: selectedRoom.id,
        message: messageText.trim(),
      });
      
      setMessageText('');
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socket.emit('typing-stop', selectedRoom.id);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    if (!socket || !selectedRoom) return;

    socket.emit('typing-start', selectedRoom.id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing-stop', selectedRoom.id);
    }, 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom) return;

    try {
      const uploadRes = await chatApi.uploadChatFile(file);
      const uploaded = uploadRes.data.data;

      await chatApi.sendMessage({
        roomId: selectedRoom.id,
        message: `Sent a file: ${uploaded.name}`,
        messageType: uploaded.mimetype.startsWith('image/') ? 'image' : 'file',
        attachmentPath: uploaded.path,
        attachmentName: uploaded.name,
        attachmentSize: uploaded.size,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file');
    }
  };

  // Filter rooms by search and category
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (activeFilter === 'all') return true;
      return room.room_type === activeFilter;
    });
  }, [rooms, searchTerm, activeFilter]);

  const displayRooms = useMemo(() => {
    if (selectedRoom && !filteredRooms.find((r) => r.id === selectedRoom.id)) {
      return [selectedRoom, ...filteredRooms];
    }
    return filteredRooms;
  }, [selectedRoom, filteredRooms]);

  const availableUsers = useMemo(() => {
    return allUsers.filter((u) => {
      if (u.id === currentUser.id) return false;
      // Role-based contact hierarchy: only users the current role may directly
      // contact are offered (e.g. CEO cannot contact staff directly).
      if (!canContact(currentUser.role, u.role)) return false;
      if (!userSearchQuery) return true;
      const q = userSearchQuery.toLowerCase();
      return (
        u.first_name?.toLowerCase().includes(q) ||
        u.last_name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    });
  }, [allUsers, currentUser.id, currentUser.role, userSearchQuery]);

  const displayedModalUsers = useMemo(() => {
    if (modalUserTab === 'online') {
      return availableUsers.filter((u) => u.is_online);
    }
    return availableUsers;
  }, [availableUsers, modalUserTab]);

  const roomTypeCounts = useMemo(() => {
    return {
      all: rooms.length,
      direct: rooms.filter((r) => r.room_type === 'direct').length,
      department: rooms.filter((r) => r.room_type === 'department').length,
      ticket: rooms.filter((r) => r.room_type === 'ticket').length,
    };
  }, [rooms]);

  // Group messages by date for elegant separators
  const messageGroups = useMemo(() => {
    const groups: { date: string; items: ChatMessage[] }[] = [];
    let currentDate = '';
    let currentGroup: ChatMessage[] = [];

    messages.forEach((msg) => {
      const msgDate = formatMessageDateGroup(msg.created_at);
      if (msgDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, items: currentGroup });
        }
        currentDate = msgDate;
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, items: currentGroup });
    }

    return groups;
  }, [messages]);

  const onlineParticipants = useMemo(() => participants.filter((p) => p.is_online), [participants]);
  const offlineParticipants = useMemo(() => participants.filter((p) => !p.is_online), [participants]);

  const directPartner = useMemo(() => {
    if (selectedRoom?.room_type !== 'direct') return null;
    return participants.find((p) => p.user_id !== currentUser.id) || null;
  }, [selectedRoom, participants, currentUser.id]);

  const isDirectPartnerOnline = useMemo(() => {
    if (directPartner) return Boolean(directPartner.is_online);
    if (selectedRoom?.room_type === 'direct') return Boolean(selectedRoom.other_user_online);
    return false;
  }, [directPartner, selectedRoom]);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Enterprise Messaging"
        description="Collaborate in real-time with teams, direct peers, and ticket threads"
      />

      <div className={styles.chatContainer}>
        {/* Mobile Header Toggle */}
        <div className={styles.mobileNav}>
          <button
            type="button"
            className={styles.mobileNavBtn}
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          >
            💬 {mobileSidebarOpen ? 'Close Chats' : 'View Chats'} ({rooms.length})
          </button>
          {selectedRoom && (
            <span className={styles.mobileCurrentRoom}>
              {selectedRoom.name}
            </span>
          )}
        </div>

        {/* Sidebar */}
        <aside className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarHeaderTop}>
              <div className={styles.sidebarTitleGroup}>
                <span className={styles.sidebarTitleIcon}>💬</span>
                <h3>Conversations</h3>
              </div>
              <button
                type="button"
                className={styles.newChatBtn}
                onClick={handleStartNewChat}
                title="Start a new conversation"
              >
                <span className={styles.plusIcon}>+</span>
                <span>New Chat</span>
              </button>
            </div>

            {unreadCount > 0 && (
              <div className={styles.unreadBanner}>
                <span className={styles.pulseDot} />
                <span>{unreadCount} unread message{unreadCount !== 1 ? 's' : ''}</span>
              </div>
            )}

            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className={styles.clearSearchBtn}
                  onClick={() => setSearchTerm('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className={styles.filterPills}>
              <button
                type="button"
                className={`${styles.filterPill} ${activeFilter === 'all' ? styles.filterActive : ''}`}
                onClick={() => setActiveFilter('all')}
              >
                All <span className={styles.pillCount}>{roomTypeCounts.all}</span>
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${activeFilter === 'direct' ? styles.filterActive : ''}`}
                onClick={() => setActiveFilter('direct')}
              >
                Direct <span className={styles.pillCount}>{roomTypeCounts.direct}</span>
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${activeFilter === 'department' ? styles.filterActive : ''}`}
                onClick={() => setActiveFilter('department')}
              >
                Dept <span className={styles.pillCount}>{roomTypeCounts.department}</span>
              </button>
              <button
                type="button"
                className={`${styles.filterPill} ${activeFilter === 'ticket' ? styles.filterActive : ''}`}
                onClick={() => setActiveFilter('ticket')}
              >
                Tickets <span className={styles.pillCount}>{roomTypeCounts.ticket}</span>
              </button>
            </div>
          </div>

          {/* Room List */}
          <div className={styles.roomList}>
            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
                <p>Loading your conversations...</p>
              </div>
            ) : displayRooms.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>💬</div>
                <h4>No conversations found</h4>
                <p>
                  {searchTerm
                    ? 'No chats match your search query.'
                    : 'Start a direct chat, department channel, or ticket discussion.'}
                </p>
                <button
                  type="button"
                  className={styles.startChatBtn}
                  onClick={handleStartNewChat}
                >
                  ➕ Start First Chat
                </button>
              </div>
            ) : (
              displayRooms.map((room) => {
                const isSelected = selectedRoom?.id === room.id;
                const avatarBg = getAvatarGradient(room.name || room.id);
                const isDirect = room.room_type === 'direct';
                const isDirectOnline = Boolean(room.other_user_online);
                const onlineCount = room.online_members_count ?? 0;

                return (
                  <div
                    key={room.id}
                    className={`${styles.roomItem} ${isSelected ? styles.activeRoom : ''}`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <div className={styles.roomAvatarWrapper}>
                      <div className={styles.roomAvatar} style={{ background: avatarBg }}>
                        {room.room_type === 'ticket' && '🎫'}
                        {room.room_type === 'department' && '👥'}
                        {room.room_type === 'direct' && (room.other_user_first_name?.[0] || '👤')}
                      </div>
                      {isDirect ? (
                        <span
                          className={isDirectOnline ? styles.roomOnlineDot : styles.roomOfflineDot}
                          title={isDirectOnline ? 'Online on Chat Page' : 'Offline'}
                        />
                      ) : null}
                    </div>

                    <div className={styles.roomInfo}>
                      <div className={styles.roomHeaderRow}>
                        <span className={styles.roomName}>{room.name}</span>
                        {room.last_message_at && (
                          <span className={styles.roomTime}>
                            {formatTimeOnly(room.last_message_at)}
                          </span>
                        )}
                      </div>

                      <div className={styles.roomSubRow}>
                        <span className={styles.lastMessage}>
                          {room.last_message ? (
                            room.last_message
                          ) : (
                            <span className={styles.emptyMessageText}>No messages yet</span>
                          )}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {!isDirect && onlineCount > 0 && (
                            <span className={styles.roomOnlineCountBadge} title={`${onlineCount} members online`}>
                              <span className={styles.miniDot} />
                              {onlineCount} online
                            </span>
                          )}
                          {room.unread_count! > 0 && (
                            <span className={styles.unreadCountBadge}>
                              {room.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Chat Window + Side Drawer */}
        <div className={styles.chatWindowWrapper}>
          <main className={styles.chatWindowInner}>
            {selectedRoom ? (
              <>
                {/* Top Header */}
                <header className={styles.chatHeader}>
                  <div className={styles.chatHeaderLeft}>
                    <div className={styles.chatHeaderAvatarWrapper}>
                      <div
                        className={styles.chatHeaderAvatar}
                        style={{ background: getAvatarGradient(selectedRoom.name || selectedRoom.id) }}
                      >
                        {selectedRoom.room_type === 'ticket' && '🎫'}
                        {selectedRoom.room_type === 'department' && '👥'}
                        {selectedRoom.room_type === 'direct' && (directPartner?.first_name?.[0] || '👤')}
                      </div>
                      {selectedRoom.room_type === 'direct' && (
                        <span
                          className={isDirectPartnerOnline ? styles.headerOnlineDot : styles.headerOfflineDot}
                          title={isDirectPartnerOnline ? 'Online on Chat Page' : 'Offline'}
                        />
                      )}
                    </div>

                    <div className={styles.chatHeaderInfo}>
                      <div className={styles.chatTitleGroup}>
                        <h3>{selectedRoom.name}</h3>
                        <span className={styles.roomTypeTag}>
                          {selectedRoom.room_type === 'ticket'
                            ? 'Ticket Chat'
                            : selectedRoom.room_type === 'department'
                            ? 'Department'
                            : 'Direct Message'}
                        </span>
                        {selectedRoom.room_type === 'direct' && directPartner?.role_name && (
                          <span
                            className={styles.memberRoleTag}
                            style={{
                              background: getRoleColor(directPartner.role_name).bg,
                              borderColor: getRoleColor(directPartner.role_name).border,
                              color: getRoleColor(directPartner.role_name).text,
                            }}
                          >
                            {directPartner.role_name}
                          </span>
                        )}
                      </div>

                      {selectedRoom.room_type === 'direct' ? (
                        <div className={styles.participantsSummary}>
                          <span
                            className={`${styles.directStatusBadge} ${
                              isDirectPartnerOnline ? styles.directStatusOnline : styles.directStatusOffline
                            }`}
                          >
                            <span
                              className={styles.onlineDotIndicator}
                              style={{ background: isDirectPartnerOnline ? '#22c55e' : '#94a3b8' }}
                            />
                            {isDirectPartnerOnline ? 'Active now on Chat Page' : 'Offline'}
                          </span>
                          {directPartner?.email && (
                            <>
                              <span className={styles.metaDivider}>•</span>
                              <span>{directPartner.email}</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className={styles.participantsSummary}>
                          <span className={styles.participantCount}>
                            {participants.length} member{participants.length !== 1 ? 's' : ''}
                          </span>
                          <span className={styles.metaDivider}>•</span>
                          <span className={styles.onlineBadge}>
                            <span className={styles.onlineDotIndicator} />
                            {onlineParticipants.length} online now
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.chatHeaderRight}>
                    <button
                      type="button"
                      className={`${styles.membersToggleBtn} ${showMembersPanel ? styles.membersToggleBtnActive : ''}`}
                      onClick={() => setShowMembersPanel(!showMembersPanel)}
                      title="Toggle members and online status roster"
                    >
                      <span>👥</span>
                      <span>Members ({onlineParticipants.length} online)</span>
                    </button>

                    <div
                      className={`${styles.socketStatus} ${
                        connected ? styles.statusConnected : styles.statusDisconnected
                      }`}
                      title={connected ? 'Real-time WebSocket connected' : 'WebSocket connecting...'}
                    >
                      <span className={styles.statusDot} />
                      <span>{connected ? 'Live Sync' : 'Connecting...'}</span>
                    </div>
                  </div>
                </header>

                {/* Messages Area */}
                <div className={styles.messagesArea}>
                  {messages.length === 0 ? (
                    <div className={styles.emptyMessagesArea}>
                      <div className={styles.emptyMessageGraphic}>👋</div>
                      <h3>Start the Conversation</h3>
                      <p>
                        This is the beginning of the discussion in <strong>{selectedRoom.name}</strong>.
                        Send a message or share files below.
                      </p>
                    </div>
                  ) : (
                    messageGroups.map((group) => (
                      <div key={group.date} className={styles.dateGroup}>
                        <div className={styles.dateDivider}>
                          <span>{group.date}</span>
                        </div>

                        {group.items.map((msg) => {
                          const isOwn = msg.sender_id === currentUser.id;
                          const roleStyle = getRoleColor(msg.sender_role || msg.role_name || '');

                          return (
                            <div
                              key={msg.id}
                              className={`${styles.messageRow} ${isOwn ? styles.ownMessageRow : styles.otherMessageRow}`}
                            >
                              {!isOwn && (
                                <div
                                  className={styles.senderAvatar}
                                  style={{ background: getAvatarGradient(`${msg.first_name} ${msg.last_name}`) }}
                                >
                                  {msg.first_name?.[0] || 'U'}
                                </div>
                              )}

                              <div className={styles.messageBubbleContainer}>
                                {!isOwn && (
                                  <div className={styles.senderDetails}>
                                    <span className={styles.senderName}>
                                      {msg.first_name} {msg.last_name}
                                    </span>
                                    {(msg.sender_role || msg.role_name) && (
                                      <span
                                        className={styles.senderRoleBadge}
                                        style={{
                                          background: roleStyle.bg,
                                          borderColor: roleStyle.border,
                                          color: roleStyle.text,
                                        }}
                                      >
                                        {msg.sender_role || msg.role_name}
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div
                                  className={`${styles.messageBubble} ${
                                    isOwn ? styles.ownBubble : styles.otherBubble
                                  }`}
                                >
                                  {msg.attachment_path && msg.message_type === 'image' ? (
                                    <div className={styles.imageAttachment}>
                                      <img
                                        src={buildAttachmentUrl(msg.attachment_path)}
                                        alt={msg.attachment_name || 'Attached Image'}
                                        className={styles.messageImage}
                                        onClick={() =>
                                          window.open(
                                            buildAttachmentUrl(msg.attachment_path),
                                            '_blank'
                                          )
                                        }
                                      />
                                    </div>
                                  ) : msg.attachment_path ? (
                                    <a
                                      href={buildAttachmentUrl(msg.attachment_path)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={styles.fileAttachmentCard}
                                    >
                                      <span className={styles.fileIcon}>📄</span>
                                      <div className={styles.fileInfo}>
                                        <span className={styles.fileName}>{msg.attachment_name || 'Download File'}</span>
                                        <span className={styles.fileAction}>Click to open / download</span>
                                      </div>
                                      <span className={styles.downloadIcon}>⬇</span>
                                    </a>
                                  ) : null}

                                  <div className={styles.messageText}>{msg.message}</div>

                                  <div className={styles.messageMeta}>
                                    <span className={styles.messageTimestamp}>
                                      {formatTimeOnly(msg.created_at)}
                                    </span>
                                    {msg.is_edited && <span className={styles.editedTag}>(edited)</span>}
                                    {isOwn && <span className={styles.checkmarks}>✓✓</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}

                  {typingUsers.size > 0 && (
                    <div className={styles.typingIndicatorBar}>
                      <div className={styles.typingWave}>
                        <span />
                        <span />
                        <span />
                      </div>
                      <span className={styles.typingText}>
                        {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                      </span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input Area */}
                <form className={styles.inputArea} onSubmit={handleSendMessage}>
                  <label className={styles.attachBtn} title="Attach file or image">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                    />
                    📎
                  </label>

                  <div className={styles.inputWrapper}>
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => {
                        setMessageText(e.target.value);
                        handleTyping();
                      }}
                      placeholder={connected ? `Message ${selectedRoom.name}...` : 'Connecting to chat service...'}
                      disabled={sending || !connected}
                      className={styles.messageInput}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!messageText.trim() || sending || !connected}
                    className={styles.sendButton}
                    title="Send message (Enter)"
                  >
                    {sending ? (
                      <span className={styles.miniSpinner} />
                    ) : (
                      <span className={styles.sendIcon}>➤</span>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className={styles.noRoomSelectedView}>
                <div className={styles.noRoomGraphic}>💬</div>
                <h2>Select a Conversation</h2>
                <p>Choose an ongoing discussion from the sidebar or start a new team or direct chat.</p>
                <button
                  type="button"
                  className={styles.bigStartChatBtn}
                  onClick={handleStartNewChat}
                >
                  ➕ Start New Conversation
                </button>
              </div>
            )}
          </main>

          {/* Collapsible Members & Presence Roster Panel */}
          {selectedRoom && showMembersPanel && (
            <aside className={styles.membersPanel}>
              <div className={styles.membersPanelHeader}>
                <div className={styles.membersPanelTitleGroup}>
                  <span>👥</span>
                  <h4>Room Members ({participants.length})</h4>
                </div>
                <button
                  type="button"
                  className={styles.membersCloseBtn}
                  onClick={() => setShowMembersPanel(false)}
                  title="Close members panel"
                >
                  ✕
                </button>
              </div>

              <div className={styles.membersPanelBody}>
                {/* Online Members Section */}
                <div>
                  <div className={styles.membersSectionTitle}>
                    <span>🟢 Online Now ({onlineParticipants.length})</span>
                  </div>
                  <div className={styles.membersList}>
                    {onlineParticipants.length === 0 ? (
                      <p className={styles.emptyMessageText} style={{ padding: '6px 8px', fontSize: '0.75rem' }}>
                        No members currently online
                      </p>
                    ) : (
                      onlineParticipants.map((p) => {
                        const isMe = p.user_id === currentUser.id;
                        const rStyle = getRoleColor(p.role_name);
                        return (
                          <div key={p.id || p.user_id} className={styles.memberCard}>
                            <div className={styles.memberAvatarWrapper}>
                              <div
                                className={styles.memberAvatar}
                                style={{ background: getAvatarGradient(`${p.first_name} ${p.last_name}`) }}
                              >
                                {p.first_name?.[0] || 'U'}
                              </div>
                              <span className={styles.memberOnlineDot} title="Online on Chat Page" />
                            </div>
                            <div className={styles.memberDetails}>
                              <div className={styles.memberNameRow}>
                                <span className={styles.memberName}>
                                  {p.first_name} {p.last_name}
                                </span>
                                {isMe && <span className={styles.youBadge}>You</span>}
                              </div>
                              <div className={styles.memberSubRow}>
                                <span
                                  className={styles.memberRoleTag}
                                  style={{
                                    background: rStyle.bg,
                                    borderColor: rStyle.border,
                                    color: rStyle.text,
                                  }}
                                >
                                  {p.role_name}
                                </span>
                                <span className={styles.memberStatusText}>Active on Chat</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Offline Members Section */}
                <div>
                  <div className={styles.membersSectionTitle}>
                    <span>⚪ Offline ({offlineParticipants.length})</span>
                  </div>
                  <div className={styles.membersList}>
                    {offlineParticipants.length === 0 ? (
                      <p className={styles.emptyMessageText} style={{ padding: '6px 8px', fontSize: '0.75rem' }}>
                        All room members are currently online!
                      </p>
                    ) : (
                      offlineParticipants.map((p) => {
                        const isMe = p.user_id === currentUser.id;
                        const rStyle = getRoleColor(p.role_name);
                        return (
                          <div key={p.id || p.user_id} className={styles.memberCard} style={{ opacity: 0.75 }}>
                            <div className={styles.memberAvatarWrapper}>
                              <div
                                className={styles.memberAvatar}
                                style={{ background: getAvatarGradient(`${p.first_name} ${p.last_name}`) }}
                              >
                                {p.first_name?.[0] || 'U'}
                              </div>
                              <span className={styles.memberOfflineDot} title="Offline" />
                            </div>
                            <div className={styles.memberDetails}>
                              <div className={styles.memberNameRow}>
                                <span className={styles.memberName}>
                                  {p.first_name} {p.last_name}
                                </span>
                                {isMe && <span className={styles.youBadge}>You</span>}
                              </div>
                              <div className={styles.memberSubRow}>
                                <span
                                  className={styles.memberRoleTag}
                                  style={{
                                    background: rStyle.bg,
                                    borderColor: rStyle.border,
                                    color: rStyle.text,
                                  }}
                                >
                                  {p.role_name}
                                </span>
                                <span className={styles.memberStatusText}>Offline</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Modern New Chat Modal */}
      {showNewChatModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowNewChatModal(false)}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <span className={styles.modalHeaderIcon}>✨</span>
                <div>
                  <h3>New Conversation</h3>
                  <p>Choose your communication channel and recipients</p>
                </div>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setShowNewChatModal(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Segmented Type Selector */}
              <div className={styles.typeSegmentContainer}>
                <button
                  type="button"
                  className={`${styles.typeSegmentBtn} ${chatType === 'direct' ? styles.typeSegmentActive : ''}`}
                  onClick={() => {
                    setChatType('direct');
                    setSelectedDepartmentId('');
                    setSelectedTicketId('');
                  }}
                >
                  <span className={styles.typeIcon}>👤</span>
                  <span>Direct User</span>
                </button>
                <button
                  type="button"
                  className={`${styles.typeSegmentBtn} ${chatType === 'department' ? styles.typeSegmentActive : ''}`}
                  onClick={() => {
                    setChatType('department');
                    setSelectedUserId('');
                    setSelectedTicketId('');
                  }}
                >
                  <span className={styles.typeIcon}>👥</span>
                  <span>Department</span>
                </button>
                <button
                  type="button"
                  className={`${styles.typeSegmentBtn} ${chatType === 'ticket' ? styles.typeSegmentActive : ''}`}
                  onClick={() => {
                    setChatType('ticket');
                    setSelectedUserId('');
                    setSelectedDepartmentId('');
                  }}
                >
                  <span className={styles.typeIcon}>🎫</span>
                  <span>Ticket Room</span>
                </button>
              </div>

              {/* Direct Message User Selection */}
              {chatType === 'direct' && (
                <div className={styles.formSection}>
                  <div className={styles.userSearchContainer}>
                    <span className={styles.searchIcon}>🔍</span>
                    <input
                      type="text"
                      placeholder="Search users by name, username, or role..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className={styles.modalSearchInput}
                    />
                  </div>

                  {currentUser.role === 'ceo' && (
                    <p className={styles.fieldHint}>
                      Executive oversight mode: you can start a direct conversation with
                      department managers and admins only. To reach staff, contact the
                      relevant department manager.
                    </p>
                  )}

                  <div className={styles.modalFilterTabs}>
                    <button
                      type="button"
                      className={`${styles.modalFilterTab} ${modalUserTab === 'all' ? styles.modalFilterTabActive : ''}`}
                      onClick={() => setModalUserTab('all')}
                    >
                      All Users ({availableUsers.length})
                    </button>
                    <button
                      type="button"
                      className={`${styles.modalFilterTab} ${modalUserTab === 'online' ? styles.modalFilterTabActive : ''}`}
                      onClick={() => setModalUserTab('online')}
                    >
                      🟢 Online Now ({availableUsers.filter((u) => u.is_online).length})
                    </button>
                  </div>

                  {loadingUsers ? (
                    <div className={styles.modalLoadingState}>
                      <div className={styles.spinner} />
                      <p>Loading directory...</p>
                    </div>
                  ) : displayedModalUsers.length === 0 ? (
                    <div className={styles.modalEmptyState}>
                      <p>
                        {modalUserTab === 'online'
                          ? 'No users are currently online.'
                          : 'No matching users found.'}
                      </p>
                    </div>
                  ) : (
                    <div className={styles.userListScroll}>
                      {displayedModalUsers.map((user) => {
                        const isSelected = selectedUserId === user.id;
                        const roleStyle = getRoleColor(user.role);
                        const userAvatarBg = getAvatarGradient(`${user.first_name} ${user.last_name}`);

                        return (
                          <div
                            key={user.id}
                            className={`${styles.userCard} ${isSelected ? styles.userCardSelected : ''}`}
                            onClick={() => setSelectedUserId(user.id)}
                          >
                            <div className={styles.userAvatarWrapper}>
                              <div className={styles.userAvatar} style={{ background: userAvatarBg }}>
                                {user.first_name?.[0] || 'U'}
                              </div>
                              <span
                                className={`${styles.userOnlineIndicator} ${
                                  user.is_online ? styles.userOnline : styles.userOffline
                                }`}
                                title={user.is_online ? 'Online on Chat Page' : 'Offline'}
                              />
                            </div>

                            <div className={styles.userCardDetails}>
                              <div className={styles.userCardName}>
                                {user.first_name} {user.last_name}
                              </div>
                              <div className={styles.userCardMeta}>
                                @{user.username}
                                {user.email && ` • ${user.email}`}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                className={user.is_online ? styles.directStatusOnline : styles.directStatusOffline}
                                style={{ fontSize: '0.72rem', fontWeight: 600 }}
                              >
                                {user.is_online ? '🟢 Online' : '⚪ Offline'}
                              </span>
                              <span
                                className={styles.userRoleTag}
                                style={{
                                  background: roleStyle.bg,
                                  borderColor: roleStyle.border,
                                  color: roleStyle.text,
                                }}
                              >
                                {user.role}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Department Selection */}
              {chatType === 'department' && (
                <div className={styles.formSection}>
                  <label className={styles.fieldLabel}>Select Department Channel</label>
                  <div className={styles.selectWrapper}>
                    <select
                      value={selectedDepartmentId}
                      onChange={(e) => setSelectedDepartmentId(e.target.value)}
                      className={styles.modalSelect}
                    >
                      <option value="">Choose department channel...</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          🏢 {dept.name} {dept.code ? `(${dept.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className={styles.fieldHint}>
                    All members assigned to this department will be part of this channel.
                  </p>

                  {/* Live Department Members & Online Roster Preview */}
                  {selectedDepartmentId && (
                    <div className={styles.modalRosterBox}>
                      <div className={styles.modalRosterHeader}>
                        <span className={styles.modalRosterTitle}>
                          <span>👥</span> Department Members ({modalMembers.length})
                        </span>
                        <span className={styles.modalOnlineBadge}>
                          <span className={styles.onlineDotIndicator} />
                          {modalMembers.filter((m) => m.is_online).length} Online Now
                        </span>
                      </div>
                      {loadingModalMembers ? (
                        <div className={styles.spinner} style={{ margin: '8px auto' }} />
                      ) : modalMembers.length === 0 ? (
                        <p className={styles.emptyMessageText}>No members found in this department.</p>
                      ) : (
                        <div className={styles.modalRosterList}>
                          {modalMembers.map((m) => {
                            const rStyle = getRoleColor(m.role);
                            return (
                              <div
                                key={m.id}
                                className={`${styles.modalRosterCard} ${
                                  m.is_online ? styles.modalRosterCardOnline : styles.modalRosterCardOffline
                                }`}
                              >
                                <div className={styles.memberAvatarWrapper}>
                                  <div
                                    className={styles.memberAvatar}
                                    style={{
                                      background: getAvatarGradient(`${m.first_name} ${m.last_name}`),
                                      width: '26px',
                                      height: '26px',
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    {m.first_name?.[0] || 'U'}
                                  </div>
                                  <span className={m.is_online ? styles.memberOnlineDot : styles.memberOfflineDot} />
                                </div>
                                <div className={styles.modalRosterInfo}>
                                  <div className={styles.modalRosterName}>
                                    {m.first_name} {m.last_name}
                                  </div>
                                  <div className={styles.modalRosterSub}>
                                    <span
                                      className={styles.memberRoleTag}
                                      style={{
                                        background: rStyle.bg,
                                        borderColor: rStyle.border,
                                        color: rStyle.text,
                                        fontSize: '0.65rem',
                                        padding: '0 4px',
                                      }}
                                    >
                                      {m.role}
                                    </span>
                                    <span>{m.is_online ? '🟢 Online' : '⚪ Offline'}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Ticket Selection */}
              {chatType === 'ticket' && (
                <div className={styles.formSection}>
                  <label className={styles.fieldLabel}>Select Support Ticket</label>
                  <div className={styles.selectWrapper}>
                    <select
                      value={selectedTicketId}
                      onChange={(e) => setSelectedTicketId(e.target.value)}
                      className={styles.modalSelect}
                    >
                      <option value="">Choose ticket thread...</option>
                      {tickets.map((ticket) => (
                        <option key={ticket.id} value={ticket.id}>
                          🎫 #{ticket.ticket_number} - {ticket.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className={styles.fieldHint}>
                    Creates a dedicated workspace discussion tied directly to this ticket.
                  </p>

                  {/* Live Ticket Members & Online Roster Preview */}
                  {selectedTicketId && (
                    <div className={styles.modalRosterBox}>
                      <div className={styles.modalRosterHeader}>
                        <span className={styles.modalRosterTitle}>
                          <span>🎫</span> Ticket Discussion Members ({modalMembers.length})
                        </span>
                        <span className={styles.modalOnlineBadge}>
                          <span className={styles.onlineDotIndicator} />
                          {modalMembers.filter((m) => m.is_online).length} Online Now
                        </span>
                      </div>
                      {loadingModalMembers ? (
                        <div className={styles.spinner} style={{ margin: '8px auto' }} />
                      ) : modalMembers.length === 0 ? (
                        <p className={styles.emptyMessageText}>No participants found for this ticket.</p>
                      ) : (
                        <div className={styles.modalRosterList}>
                          {modalMembers.map((m) => {
                            const rStyle = getRoleColor(m.role);
                            return (
                              <div
                                key={m.id}
                                className={`${styles.modalRosterCard} ${
                                  m.is_online ? styles.modalRosterCardOnline : styles.modalRosterCardOffline
                                }`}
                              >
                                <div className={styles.memberAvatarWrapper}>
                                  <div
                                    className={styles.memberAvatar}
                                    style={{
                                      background: getAvatarGradient(`${m.first_name} ${m.last_name}`),
                                      width: '26px',
                                      height: '26px',
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    {m.first_name?.[0] || 'U'}
                                  </div>
                                  <span className={m.is_online ? styles.memberOnlineDot : styles.memberOfflineDot} />
                                </div>
                                <div className={styles.modalRosterInfo}>
                                  <div className={styles.modalRosterName}>
                                    {m.first_name} {m.last_name}
                                  </div>
                                  <div className={styles.modalRosterSub}>
                                    <span
                                      className={styles.memberRoleTag}
                                      style={{
                                        background: rStyle.bg,
                                        borderColor: rStyle.border,
                                        color: rStyle.text,
                                        fontSize: '0.65rem',
                                        padding: '0 4px',
                                      }}
                                    >
                                      {m.ticket_role || m.role}
                                    </span>
                                    <span>{m.is_online ? '🟢 Online' : '⚪ Offline'}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Custom Name */}
              <div className={styles.formSection}>
                <label className={styles.fieldLabel}>Custom Channel / Thread Title (Optional)</label>
                <input
                  type="text"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  placeholder="e.g. Project Onboarding, Urgent Follow-up"
                  className={styles.modalTextInput}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setShowNewChatModal(false)}
                disabled={creatingRoom}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalSubmitBtn}
                onClick={handleCreateRoom}
                disabled={
                  creatingRoom ||
                  (chatType === 'direct' && !selectedUserId) ||
                  (chatType === 'department' && !selectedDepartmentId) ||
                  (chatType === 'ticket' && !selectedTicketId)
                }
              >
                {creatingRoom ? 'Creating Channel...' : '🚀 Start Conversation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
