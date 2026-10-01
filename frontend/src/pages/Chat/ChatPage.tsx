import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader';
import * as chatApi from '../../api/chatApi';
import api from '../../api/axios';
import { canContact } from '../../config/contact';
import type { ChatRoom, ChatMessage, ChatParticipant, ChatMember, RegisteredContact } from '../../api/chatApi';
import type { OnlineUser, Department, Ticket } from './types';
import { formatMessageDateGroup, parseMeetingMessage, getMeetingEventStatus } from './types';

import { ChatSidebar } from './components/ChatSidebar';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessagesArea } from './components/ChatMessagesArea';
import { ChatInputArea } from './components/ChatInputArea';
import { InAppVideoConference } from './components/InAppVideoConference';
import { ChatMembersPanel } from './components/ChatMembersPanel';
import { NewChatModal } from './components/NewChatModal';
import { MeetingInviteModal } from './components/MeetingInviteModal';
import { DeleteMessageModal } from './components/DeleteMessageModal';

import styles from './ChatPage.module.css';

export default function ChatPage() {
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  // Primary Conversation State
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [messageText, setMessageText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'direct' | 'department' | 'ticket' | 'video'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);

  // Message Deletion State
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  // ===================== VIEW MODE STATE =====================
  // 'chat': Pure text chat
  // 'video': 100% in-app native WebRTC video conference
  // 'split': Side-by-side view with both Video & Text Chat
  const [activeViewMode, setActiveViewMode] = useState<'chat' | 'video' | 'split'>('chat');
  const [isVideoActive, setIsVideoActive] = useState(false);

  // New Chat Modal State
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allUsers, setAllUsers] = useState<OnlineUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [modalUserTab, setModalUserTab] = useState<'all' | 'online' | 'admin'>('all');
  const [chatType, setChatType] = useState<'direct' | 'department' | 'ticket' | 'video_conference'>('direct');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [modalMembers, setModalMembers] = useState<ChatMember[]>([]);
  const [loadingModalMembers, setLoadingModalMembers] = useState(false);

  // Video Conference Creation in New Chat Modal
  const [videoConferenceTarget, setVideoConferenceTarget] = useState<'user' | 'department' | 'ticket'>('user');
  const [conferenceTitle, setConferenceTitle] = useState('');
  const [conferenceScheduleMode, setConferenceScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [conferenceScheduledTime, setConferenceScheduledTime] = useState<string>('');
  const [conferenceDurationMinutes, setConferenceDurationMinutes] = useState<number>(30);
  const [conferenceScreenShare, setConferenceScreenShare] = useState<boolean>(true);
  const [conferenceStartAudioMuted, setConferenceStartAudioMuted] = useState<boolean>(false);
  const [conferenceStartVideoMuted, setConferenceStartVideoMuted] = useState<boolean>(false);

  // Customizable Meeting Invitation State
  const [showMeetModal, setShowMeetModal] = useState(false);
  const [meetingPlatform, setMeetingPlatform] = useState<'dms_conference' | 'google_meet' | 'custom'>('dms_conference');
  const [meetUrl, setMeetUrl] = useState('');
  const [selectedRecipientEmails, setSelectedRecipientEmails] = useState<string[]>([]);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [meetTitle, setMeetTitle] = useState('');
  const [meetNotes, setMeetNotes] = useState('');
  const [meetingScreenShare, setMeetingScreenShare] = useState(true);
  const [meetingStartAudioMuted, setMeetingStartAudioMuted] = useState(false);
  const [meetingStartVideoMuted, setMeetingStartVideoMuted] = useState(false);
  const [meetingRequireRegisteredOnly, setMeetingRequireRegisteredOnly] = useState(true);
  const [meetingPasscode, setMeetingPasscode] = useState('');
  const [meetingScheduleMode, setMeetingScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [meetingScheduledTime, setMeetingScheduledTime] = useState<string>('');
  const [meetingDurationMinutes, setMeetingDurationMinutes] = useState<number>(30);
  const [sendingMeetInvite, setSendingMeetInvite] = useState(false);
  const [meetSuccessMsg, setMeetSuccessMsg] = useState('');
  const [registeredContacts, setRegisteredContacts] = useState<RegisteredContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [incomingMeetingInvite, setIncomingMeetingInvite] = useState<any | null>(null);

  // Whole Page View & Sidebar Collapse State
  const [isWholePageMode, setIsWholePageMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user: authUser } = useAuth();
  const currentUser = authUser || JSON.parse(localStorage.getItem('user') || '{}');

  // Reset layout scroll on mount so page stays at top
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const content = document.querySelector('main');
    if (content) content.scrollTop = 0;
  }, []);

  // Auto-scroll ONLY the chat messages container to bottom without scrolling outer window/page
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        if (behavior === 'smooth' && typeof container.scrollTo === 'function') {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        } else {
          container.scrollTop = container.scrollHeight;
        }
      }
    }
  };

  const selectedRoomRef = useRef<ChatRoom | null>(null);
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  const hasLoadedRoomsOnce = useRef(false);
  const handledLocationTargetRef = useRef<string | null>(null);

  // 1. Initial Rooms and Unread Counts (Stable callback, no infinite loop)
  const loadRooms = useCallback(async () => {
    try {
      if (!hasLoadedRoomsOnce.current) {
        setLoading(true);
      }
      const [roomsRes, unreadRes] = await Promise.all([
        chatApi.fetchUserRooms(),
        chatApi.fetchUnreadCount(),
      ]);

      const fetchedRooms: ChatRoom[] = roomsRes.data.data || [];
      const unreadCountVal = (unreadRes.data.data as any)?.count ?? 0;

      setRooms(fetchedRooms);
      setUnreadCount(unreadCountVal);
      hasLoadedRoomsOnce.current = true;
      return fetchedRooms;
    } catch (err) {
      console.error('Failed to load chat rooms:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const initRoomsAndSelection = async () => {
      const fetchedRooms = await loadRooms();
      if (isCancelled) return;

      const targetRoomId = (location.state as any)?.selectedRoomId;
      if (targetRoomId && handledLocationTargetRef.current !== targetRoomId) {
        handledLocationTargetRef.current = targetRoomId;
        const found = fetchedRooms.find((r) => r.id === targetRoomId);
        if (found) {
          setSelectedRoom(found);
        } else {
          try {
            const res = await chatApi.fetchRoomById(targetRoomId);
            if (!isCancelled && res.data?.data) {
              const directRoom = res.data.data;
              setSelectedRoom(directRoom);
              setRooms((prev) => (prev.some((r) => r.id === directRoom.id) ? prev : [directRoom, ...prev]));
            }
          } catch (err) {
            console.error('Failed to load room by target ID:', err);
          }
        }
        if ((location.state as any)?.autoJoinVideo) {
          setIsVideoActive(true);
          setActiveViewMode('video');
        }
      } else if (!selectedRoomRef.current && fetchedRooms.length > 0) {
        setSelectedRoom(fetchedRooms[0]);
      }
    };

    initRoomsAndSelection();

    return () => {
      isCancelled = true;
    };
  }, [loadRooms, location.state]);

  // 2. Load Messages and Participants when Selected Room Changes
  useEffect(() => {
    if (!selectedRoom) {
      setMessages([]);
      setParticipants([]);
      return;
    }

    let isCancelled = false;

    const loadRoomData = async () => {
      try {
        const [msgRes, partRes] = await Promise.all([
          chatApi.fetchRoomMessages(selectedRoom.id),
          chatApi.fetchRoomParticipants(selectedRoom.id),
        ]);

        if (!isCancelled) {
          setMessages(msgRes.data.data || []);
          setParticipants(partRes.data.data || []);
          setTimeout(scrollToBottom, 80);
        }

        // Mark as read
        if (selectedRoom.unread_count && selectedRoom.unread_count > 0) {
          await chatApi.markMessagesAsRead(selectedRoom.id);
          setRooms((prev) =>
            prev.map((r) => (r.id === selectedRoom.id ? { ...r, unread_count: 0 } : r))
          );
          setUnreadCount((prev) => Math.max(0, prev - (selectedRoom.unread_count || 0)));
        }
      } catch (err) {
        console.error('Failed to load messages or participants:', err);
      }
    };

    loadRoomData();

    if (socket?.connected) {
      socket.emit('join-room', selectedRoom.id);
    }

    return () => {
      isCancelled = true;
      if (socket?.connected) {
        socket.emit('leave-room', selectedRoom.id);
      }
    };
  }, [selectedRoom?.id, socket]);

  // 3. Socket.IO Listeners (Messages, Read receipts, Incoming meeting alerts)
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: ChatMessage) => {
      if (selectedRoom && msg.room_id === selectedRoom.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(scrollToBottom, 60);
      } else {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === msg.room_id
              ? {
                  ...r,
                  last_message: msg.message,
                  last_message_at: msg.created_at,
                  unread_count: (r.unread_count || 0) + 1,
                }
              : r
          )
        );
        setUnreadCount((prev) => prev + 1);
      }
    };

    const handleMeetingInvite = (data: any) => {
      setIncomingMeetingInvite(data);
    };

    const handleUserTyping = ({ roomId, firstName, lastName }: any) => {
      if (selectedRoom && roomId === selectedRoom.id) {
        const name = `${firstName} ${lastName}`.trim();
        setTypingUsers((prev) => new Set(prev).add(name));
      }
    };

    const handleUserStoppedTyping = ({ roomId, firstName, lastName }: any) => {
      if (selectedRoom && roomId === selectedRoom.id) {
        const name = `${firstName} ${lastName}`.trim();
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }
    };

    const handleDirectRoomCreated = (newRoom: any) => {
      setRooms((prev) => {
        if (prev.some((r) => r.id === newRoom.id)) return prev;
        return [newRoom, ...prev];
      });
    };

    const handleMessageDeleted = ({ messageId }: { messageId: string; roomId?: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    };

    socket.on('new-message', handleNewMessage);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('meeting-invite-received', handleMeetingInvite);
    socket.on('direct-room-created', handleDirectRoomCreated);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-stopped-typing', handleUserStoppedTyping);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('meeting-invite-received', handleMeetingInvite);
      socket.off('direct-room-created', handleDirectRoomCreated);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stopped-typing', handleUserStoppedTyping);
    };
  }, [socket, selectedRoom?.id]);

  // 4. Send Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !messageText.trim() || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      const res = await chatApi.sendMessage({
        roomId: selectedRoom.id,
        message: text,
        messageType: 'text',
      });

      if (res.data?.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data.data.id)) return prev;
          return [...prev, res.data.data];
        });
        setTimeout(scrollToBottom, 60);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  // 5. Send File Attachment
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom) return;

    const formData = new FormData();
    formData.append('attachment', file);
    formData.append('roomId', selectedRoom.id);
    formData.append('message', `Shared file: ${file.name}`);
    formData.append('messageType', file.type.startsWith('image/') ? 'image' : 'file');

    try {
      setSending(true);
      const res = await api.post('/chat/attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.data) {
        setMessages((prev) => [...prev, res.data.data]);
        setTimeout(scrollToBottom, 60);
      }
    } catch (err) {
      console.error('Failed to upload attachment:', err);
      alert('Failed to upload file. Please ensure it is an approved format under 10MB.');
    } finally {
      setSending(false);
      e.target.value = '';
    }
  };

  // 6. Typing notifications
  const handleTyping = () => {
    if (!socket?.connected || !selectedRoom) return;
    socket.emit('typing-start', selectedRoom.id);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing-stop', selectedRoom.id);
    }, 2000);
  };

  // 6b. Message Deletion
  const handleRequestDeleteMessage = (msg: ChatMessage) => {
    setMessageToDelete(msg);
  };

  const handleConfirmDeleteMessage = async (deleteType: 'everyone' | 'for_me' = 'everyone') => {
    if (!messageToDelete) return;
    setDeletingMessage(true);
    try {
      await chatApi.deleteMessage(messageToDelete.id, deleteType);
      if (deleteType === 'everyone' && socket?.connected) {
        socket.emit('delete-message', { messageId: messageToDelete.id, deleteType: 'everyone' });
      }
      setMessages((prev) => prev.filter((m) => m.id !== messageToDelete.id));
      setMessageToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete message:', err);
      alert(err.response?.data?.message || 'Failed to delete message. Please try again.');
    } finally {
      setDeletingMessage(false);
    }
  };

  // 7. Filtering and Derived State
  const roomTypeCounts = useMemo(() => {
    return {
      all: rooms.length,
      direct: rooms.filter((r) => r.room_type === 'direct').length,
      department: rooms.filter((r) => r.room_type === 'department').length,
      ticket: rooms.filter((r) => r.room_type === 'ticket').length,
      video: rooms.filter((r) =>
        Boolean(
          r.last_message?.includes('[VIDEO_CONFERENCE]') ||
          r.last_message?.includes('[GOOGLE_MEET_CALL]') ||
          r.last_message?.toLowerCase().includes('video conference') ||
          r.name?.toLowerCase().includes('conference')
        )
      ).length,
    };
  }, [rooms]);

  const displayRooms = useMemo(() => {
    let list = rooms;
    if (activeFilter === 'video') {
      list = list.filter((r) =>
        Boolean(
          r.last_message?.includes('[VIDEO_CONFERENCE]') ||
          r.last_message?.includes('[GOOGLE_MEET_CALL]') ||
          r.last_message?.toLowerCase().includes('video conference') ||
          r.name?.toLowerCase().includes('conference')
        )
      );
    } else if (activeFilter !== 'all') {
      list = list.filter((r) => r.room_type === activeFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((r) => r.name?.toLowerCase().includes(q));
    }
    return list;
  }, [rooms, activeFilter, searchTerm]);

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

  const directPartner = useMemo(() => {
    if (selectedRoom?.room_type !== 'direct') return null;
    return participants.find((p) => p.user_id !== currentUser.id) || null;
  }, [selectedRoom, participants, currentUser.id]);

  const isDirectPartnerOnline = useMemo(() => {
    if (directPartner) return Boolean(directPartner.is_online);
    if (selectedRoom?.room_type === 'direct') return Boolean(selectedRoom.other_user_online);
    return false;
  }, [directPartner, selectedRoom]);

  // ===================== MEETING INVITATION MODAL LOGIC =====================
  const openMeetModal = async () => {
    setMeetingPlatform('dms_conference');
    setMeetTitle(
      selectedRoom
        ? `${selectedRoom.name} - Support Video Call`
        : 'Help Desk In-App Video Conference & Screen Sharing'
    );
    setMeetNotes('');
    setMeetSuccessMsg('');
    setSelectedRoleFilter('all');
    setMeetingScheduleMode('now');
    setMeetingScheduledTime('');
    setMeetingDurationMinutes(30);

    const roomUrl = `https://meet.dms.gov/room/${selectedRoom?.id || 'general'}`;
    setMeetUrl(roomUrl);

    if (selectedRoom?.room_type === 'direct' && directPartner?.email) {
      setSelectedRecipientEmails([directPartner.email.toLowerCase()]);
    } else {
      setSelectedRecipientEmails([]);
    }
    setShowMeetModal(true);

    // Fetch registered contacts
    setLoadingContacts(true);
    try {
      const res = await chatApi.fetchRegisteredContacts();
      if (res.data?.data) {
        setRegisteredContacts(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load registered contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSendMeetInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRecipientEmails.length === 0) {
      alert('Please select at least one registered user to invite.');
      return;
    }

    setSendingMeetInvite(true);
    try {
      const res = await chatApi.sendMeetingInvite({
        recipientEmails: selectedRecipientEmails,
        meetingUrl: meetUrl.trim() || `https://meet.dms.gov/room/${selectedRoom?.id || 'general'}`,
        roomId: selectedRoom?.id,
        title: meetTitle.trim() || 'DMS Video Conference & Screen Sharing',
        notes: meetNotes.trim(),
        meetingType: meetingPlatform,
        scheduledTime: meetingScheduleMode === 'scheduled' && meetingScheduledTime ? meetingScheduledTime : undefined,
        durationMinutes: meetingDurationMinutes,
        customSettings: {
          screenShareEnabled: meetingScreenShare,
          startAudioMuted: meetingStartAudioMuted,
          startVideoMuted: meetingStartVideoMuted,
          requireRegisteredOnly: meetingRequireRegisteredOnly,
          passcode: meetingPasscode.trim() || undefined,
        },
      });

      if (res.data?.data?.message) {
        if (selectedRoom && selectedRoom.id === res.data.data.roomId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === res.data.data.message.id)) return prev;
            return [...prev, res.data.data.message];
          });
          setTimeout(scrollToBottom, 60);
        } else if (!selectedRoom) {
          loadRooms();
        }
      }

      setMeetSuccessMsg(
        meetingScheduleMode === 'scheduled'
          ? '✅ Event scheduled! Notification and email dispatched with event time.'
          : '✅ Invitation dispatched with notifications and emails!'
      );
      setTimeout(() => {
        setShowMeetModal(false);
        setMeetSuccessMsg('');
      }, 1500);
    } catch (err: any) {
      console.error('Failed to send meet invite:', err);
      const validationDetails = err?.response?.data?.errors
        ?.map((e: any) => e.msg || e.message)
        .filter(Boolean)
        .join('\n• ');
      const errMsg = validationDetails
        ? `Validation error:\n• ${validationDetails}`
        : err?.response?.data?.message || err?.message || 'Failed to dispatch meeting invitation';
      alert(`Error: ${errMsg}`);
    } finally {
      setSendingMeetInvite(false);
    }
  };

  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    registeredContacts.forEach((c) => {
      if (c.role) set.add(c.role.toLowerCase());
    });
    return Array.from(set).sort();
  }, [registeredContacts]);

  const filteredRegisteredContacts = useMemo(() => {
    let list = registeredContacts;
    if (selectedRoleFilter !== 'all') {
      list = list.filter((c) => c.role?.toLowerCase() === selectedRoleFilter.toLowerCase());
    }
    if (contactSearchQuery.trim()) {
      const q = contactSearchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.first_name.toLowerCase().includes(q) ||
          c.last_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q)
      );
    }
    return list;
  }, [registeredContacts, selectedRoleFilter, contactSearchQuery]);

  const toggleRecipientSelection = (email: string) => {
    const em = email.toLowerCase();
    setSelectedRecipientEmails((prev) =>
      prev.includes(em) ? prev.filter((e) => e !== em) : [...prev, em]
    );
  };

  const selectAllInRole = (role: string) => {
    const targetContacts =
      role === 'all'
        ? filteredRegisteredContacts
        : registeredContacts.filter((c) => c.role?.toLowerCase() === role.toLowerCase());
    const targetEmails = targetContacts.map((c) => c.email.toLowerCase());
    const allAlreadySelected = targetEmails.every((em) => selectedRecipientEmails.includes(em));

    if (allAlreadySelected) {
      setSelectedRecipientEmails((prev) => prev.filter((em) => !targetEmails.includes(em)));
    } else {
      setSelectedRecipientEmails((prev) => Array.from(new Set([...prev, ...targetEmails])));
    }
  };

  // ===================== NEW CHAT MODAL LOGIC =====================
  const handleStartNewChat = async () => {
    setShowNewChatModal(true);
    setLoadingUsers(true);
    try {
      const [usersRes, deptsRes, ticketsRes] = await Promise.all([
        chatApi.fetchChatUsers(),
        chatApi.fetchChatDepartments(),
        api.get('/tickets'),
      ]);
      setAllUsers(usersRes.data.data || []);
      setDepartments(deptsRes.data.data || []);
      setTickets(ticketsRes.data.data || []);
    } catch (err) {
      console.error('Failed to load new chat data:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenVideoConferenceModal = async () => {
    setChatType('video_conference');
    setVideoConferenceTarget('user');
    setConferenceTitle('');
    setConferenceScheduleMode('now');
    const defaultDate = new Date(Date.now() + 15 * 60 * 1000);
    const isoLocal = new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setConferenceScheduledTime(isoLocal);
    setConferenceDurationMinutes(30);
    setConferenceScreenShare(true);
    setConferenceStartAudioMuted(false);
    setConferenceStartVideoMuted(false);

    setShowNewChatModal(true);
    setLoadingUsers(true);
    try {
      const [usersRes, deptsRes, ticketsRes] = await Promise.all([
        chatApi.fetchChatUsers(),
        chatApi.fetchChatDepartments(),
        api.get('/tickets'),
      ]);
      setAllUsers(usersRes.data.data || []);
      setDepartments(deptsRes.data.data || []);
      setTickets(ticketsRes.data.data || []);
    } catch (err) {
      console.error('Failed to load new chat data:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateVideoConference = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingRoom(true);

    try {
      let targetEmails: string[] = [];
      let targetRoomId: string | undefined = undefined;

      if (videoConferenceTarget === 'user') {
        const targetUser = allUsers.find((u) => u.id === selectedUserId);
        if (!targetUser?.email) {
          alert('Please select a registered user to invite to the video conference.');
          setCreatingRoom(false);
          return;
        }
        targetEmails = [targetUser.email.toLowerCase()];
      } else if (videoConferenceTarget === 'department') {
        if (!selectedDepartmentId) {
          alert('Please select a department channel.');
          setCreatingRoom(false);
          return;
        }
        const existingDeptRoom = rooms.find(
          (r) => r.room_type === 'department' && r.department_id === selectedDepartmentId
        );
        if (existingDeptRoom) {
          targetRoomId = existingDeptRoom.id;
        } else {
          const deptRoomRes = await chatApi.createDepartmentRoom({ departmentId: selectedDepartmentId });
          targetRoomId = deptRoomRes.data.data.id;
        }
        try {
          const membersRes = await chatApi.fetchDepartmentChatMembers(selectedDepartmentId);
          const members = membersRes.data.data || [];
          targetEmails = members.map((m: any) => m.email).filter(Boolean);
        } catch {}
        if (targetEmails.length === 0 && currentUser.email) {
          targetEmails = [currentUser.email];
        }
      } else if (videoConferenceTarget === 'ticket') {
        if (!selectedTicketId) {
          alert('Please select a support ticket.');
          setCreatingRoom(false);
          return;
        }
        const existingTicketRoom = rooms.find(
          (r) => r.room_type === 'ticket' && r.ticket_id === selectedTicketId
        );
        if (existingTicketRoom) {
          targetRoomId = existingTicketRoom.id;
        } else {
          const ticketRoomRes = await chatApi.createTicketRoom({ ticketId: selectedTicketId });
          targetRoomId = ticketRoomRes.data.data.id;
        }
        try {
          const membersRes = await chatApi.fetchTicketChatMembers(selectedTicketId);
          const members = membersRes.data.data || [];
          targetEmails = members.map((m: any) => m.email).filter(Boolean);
        } catch {}
        if (targetEmails.length === 0 && currentUser.email) {
          targetEmails = [currentUser.email];
        }
      }

      const effectiveDate =
        conferenceScheduleMode === 'scheduled' && conferenceScheduledTime
          ? conferenceScheduledTime
          : new Date().toISOString();

      const inviteRes = await chatApi.sendMeetingInvite({
        recipientEmails: targetEmails,
        meetingUrl: `https://meet.dms.gov/room/${targetRoomId || 'general'}`,
        roomId: targetRoomId,
        title: conferenceTitle.trim() || 'Help Desk Video Conference & Screen Walkthrough',
        notes: `Conference initiated ${
          conferenceScheduleMode === 'now' ? 'Today' : `for ${new Date(effectiveDate).toLocaleString()}`
        }`,
        meetingType: 'dms_conference',
        scheduledTime: effectiveDate,
        durationMinutes: conferenceDurationMinutes,
        customSettings: {
          screenShareEnabled: conferenceScreenShare,
          startAudioMuted: conferenceStartAudioMuted,
          startVideoMuted: conferenceStartVideoMuted,
          requireRegisteredOnly: true,
        },
      });

      const returnedRoomId = inviteRes.data?.data?.roomId || targetRoomId;
      setShowNewChatModal(false);

      const refreshedRooms = await loadRooms();
      let foundRoom = refreshedRooms.find((r) => r.id === returnedRoomId);
      if (!foundRoom && returnedRoomId) {
        try {
          const rRes = await chatApi.fetchRoomById(returnedRoomId);
          foundRoom = rRes.data.data;
          if (foundRoom) {
            setRooms((prev) => [foundRoom!, ...prev.filter((r) => r.id !== foundRoom!.id)]);
          }
        } catch {}
      }

      if (foundRoom) {
        setSelectedRoom(foundRoom);
      }

      if (conferenceScheduleMode === 'now') {
        setIsVideoActive(true);
        setActiveViewMode('video');
      } else {
        setActiveViewMode('chat');
      }
    } catch (err: any) {
      console.error('Failed to create video conference:', err);
      alert(err.response?.data?.message || 'Failed to start video conference');
    } finally {
      setCreatingRoom(false);
    }
  };

  const filteredUsers = useMemo(() => {
    let list = allUsers.filter((u) => u.id !== currentUser.id && canContact(currentUser.role, u.role));
    if (modalUserTab === 'online') {
      list = list.filter((u) => u.is_online);
    } else if (modalUserTab === 'admin') {
      list = list.filter((u) => u.role?.toLowerCase() === 'admin');
    }
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.toLowerCase().trim();
      list = list.filter(
        (u) =>
          u.first_name.toLowerCase().includes(q) ||
          u.last_name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allUsers, currentUser, modalUserTab, userSearchQuery]);

  // 1-Click Auto-Accept Direct Chat with a registered user or Admin (Text or Video)
  const handleStartDirectUserChat = async (userId: string, initialMode: 'chat' | 'video' = 'chat') => {
    setCreatingRoom(true);
    try {
      const payload: { userId?: string; targetRole?: string; initialMode?: 'chat' | 'video' } = { initialMode };
      if (userId === 'admin') {
        payload.targetRole = 'admin';
      } else {
        payload.userId = userId;
      }
      const res = await chatApi.createDirectRoom(payload);
      const createdRoom = res.data.data;
      if (createdRoom) {
        setSelectedRoom(createdRoom);
        loadRooms();
        setShowNewChatModal(false);
        if (initialMode === 'video') {
          setIsVideoActive(true);
          setActiveViewMode('video');
        } else {
          setIsVideoActive(false);
          setActiveViewMode('chat');
        }
      }
    } catch (err: any) {
      console.error('Failed to start direct chat:', err);
      alert(err.response?.data?.message || 'Failed to start direct conversation');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingRoom(true);

    try {
      let createdRoom: ChatRoom | null = null;
      if (chatType === 'direct') {
        const payload: { userId?: string; targetRole?: string; initialMode?: 'chat' | 'video' } = { initialMode: 'chat' };
        if (selectedUserId === 'admin') {
          payload.targetRole = 'admin';
        } else {
          payload.userId = selectedUserId;
        }
        const res = await chatApi.createDirectRoom(payload);
        createdRoom = res.data.data;
      } else if (chatType === 'department') {
        const res = await chatApi.createDepartmentRoom({
          departmentId: selectedDepartmentId,
          name: newChatName.trim() || undefined,
        });
        createdRoom = res.data.data;
      } else if (chatType === 'ticket') {
        const res = await chatApi.createTicketRoom({
          ticketId: selectedTicketId,
          name: newChatName.trim() || undefined,
          timing: 'now',
        });
        createdRoom = res.data.data;
      }

      if (createdRoom) {
        setSelectedRoom(createdRoom);
        loadRooms();
        setShowNewChatModal(false);
        setActiveViewMode('chat');
      }
    } catch (err: any) {
      console.error('Failed to create chat room:', err);
      alert(err.response?.data?.message || 'Failed to create conversation');
    } finally {
      setCreatingRoom(false);
    }
  };

  // Switch to In-App Video Mode
  const handleStartInAppVideo = () => {
    setIsVideoActive(true);
    setActiveViewMode('video');
  };

  const handleLeaveInAppVideo = () => {
    setIsVideoActive(false);
    setActiveViewMode('chat');
  };

  // Clicked Screen Share Session state - only displayed when clicked and not yet entered
  const [clickedScreenShareSession, setClickedScreenShareSession] = useState<any | null>(null);
  const [consumedMeetingKeys, setConsumedMeetingKeys] = useState<Set<string>>(new Set());

  // Reset clicked screen share session on room change
  useEffect(() => {
    setClickedScreenShareSession(null);
  }, [selectedRoom?.id]);

  const handleJoinScreenShare = (sessionInfo?: any) => {
    const targetSession = sessionInfo || clickedScreenShareSession;
    if (targetSession) {
      const key = targetSession.meetingUrl || targetSession.title || targetSession.scheduledTime;
      if (key) {
        setConsumedMeetingKeys((prev) => new Set(prev).add(key));
      }
    }
    // Remove the screen share banner immediately
    setClickedScreenShareSession(null);
    handleStartInAppVideo();
  };

  const handleSelectScreenShare = (sessionInfo: any) => {
    const key = sessionInfo.meetingUrl || sessionInfo.title || sessionInfo.scheduledTime;
    if (!consumedMeetingKeys.has(key) && activeViewMode !== 'video' && !isVideoActive) {
      setClickedScreenShareSession(sessionInfo);
    }
  };

  return (
    <div
      className={`${styles.chatPageWrapper} ${
        isWholePageMode ? styles.chatPageWrapperWholePage : ''
      }`}
    >
      {!isWholePageMode && (
        <div className={styles.chatPageHeaderCompact}>
          <PageHeader
            title="Help Desk Communications"
            description="Unified real-time text chat, department channels, and 100% in-app video conferencing"
          />
        </div>
      )}

      {/* Incoming Real-Time Meeting Alert Banner */}
      {incomingMeetingInvite && (
        <div className={styles.incomingInviteBanner}>
          <div className={styles.incomingInviteLeft}>
            <span className={styles.incomingInvitePulse} />
            <div>
              <strong>{incomingMeetingInvite.senderName}</strong> ({incomingMeetingInvite.senderRole})
              {incomingMeetingInvite.scheduledTime ? (
                <>
                  {' '}scheduled an in-app video & screen share event: "{incomingMeetingInvite.meetingTitle}" for{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {incomingMeetingInvite.formattedScheduledTime ||
                      new Date(incomingMeetingInvite.scheduledTime).toLocaleString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                  </strong>{' '}
                  ({incomingMeetingInvite.durationMinutes || 30} mins)
                </>
              ) : (
                <> invited you to an in-app video conference: "{incomingMeetingInvite.meetingTitle}"</>
              )}
            </div>
          </div>
          <div className={styles.incomingInviteActions}>
            <button
              type="button"
              className={styles.incomingJoinBtn}
              onClick={async () => {
                let targetRoom = rooms.find((r) => r.id === incomingMeetingInvite.roomId);
                if (!targetRoom) {
                  try {
                    const res = await chatApi.fetchRoomById(incomingMeetingInvite.roomId);
                    targetRoom = res.data.data;
                  } catch (e) {
                    console.warn('Could not fetch target room by id', e);
                  }
                }
                if (targetRoom) setSelectedRoom(targetRoom);
                handleStartInAppVideo();
                setIncomingMeetingInvite(null);
                loadRooms();
              }}
            >
              {incomingMeetingInvite.customSettings?.screenShareEnabled ? '🖥️ Accept & Join Screen Share' : '📹 Accept Video Call'}
            </button>
            <button
              type="button"
              className={styles.incomingDismissBtn}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={async () => {
                let targetRoom = rooms.find((r) => r.id === incomingMeetingInvite.roomId);
                if (!targetRoom) {
                  try {
                    const res = await chatApi.fetchRoomById(incomingMeetingInvite.roomId);
                    targetRoom = res.data.data;
                  } catch (e) {}
                }
                if (targetRoom) setSelectedRoom(targetRoom);
                setActiveViewMode('chat');
                setIsVideoActive(false);
                setIncomingMeetingInvite(null);
                loadRooms();
              }}
            >
              💬 Open Chat
            </button>
            <button
              type="button"
              className={styles.incomingDismissBtn}
              onClick={() => setIncomingMeetingInvite(null)}
              title="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div
        className={`${styles.chatMainContainer} ${
          isWholePageMode ? styles.chatMainContainerWholePage : ''
        }`}
      >
        {/* Left Sidebar: Conversations & Channels */}
        <ChatSidebar
          rooms={rooms}
          displayRooms={displayRooms}
          selectedRoom={selectedRoom}
          loading={loading}
          searchTerm={searchTerm}
          activeFilter={activeFilter}
          unreadCount={unreadCount}
          mobileSidebarOpen={mobileSidebarOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          roomTypeCounts={roomTypeCounts}
          onSelectRoom={(r) => setSelectedRoom(r)}
          onSearchChange={(q) => setSearchTerm(q)}
          onFilterChange={(f) => setActiveFilter(f)}
          onStartNewChat={handleStartNewChat}
          onStartVideoConference={handleOpenVideoConferenceModal}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        />

        {/* Center Active Workspace */}
        <main className={styles.chatConversationArea}>
          {selectedRoom ? (
            <>
              {/* Header with Mode Switcher Buttons */}
              <ChatHeader
                selectedRoom={selectedRoom}
                participants={participants}
                onlineParticipants={onlineParticipants}
                isDirectPartnerOnline={isDirectPartnerOnline}
                directPartner={directPartner}
                activeViewMode={activeViewMode}
                isVideoActive={isVideoActive}
                connected={connected}
                showMembersPanel={showMembersPanel}
                isWholePageMode={isWholePageMode}
                isSidebarCollapsed={isSidebarCollapsed}
                onSetViewMode={(mode) => {
                  setActiveViewMode(mode);
                  if (mode === 'video' || mode === 'split') {
                    setIsVideoActive(true);
                  }
                }}
                onOpenMeetModal={openMeetModal}
                onToggleMembersPanel={() => setShowMembersPanel(!showMembersPanel)}
                onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                onToggleWholePageMode={() => setIsWholePageMode(!isWholePageMode)}
                onToggleSidebarCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              />

              {/* Event Timing Banner for Scheduled Video & Screen Share Session - Shown ONLY when clicked and not yet in video conference */}
              {clickedScreenShareSession &&
                !consumedMeetingKeys.has(
                  clickedScreenShareSession.meetingUrl ||
                    clickedScreenShareSession.title ||
                    clickedScreenShareSession.scheduledTime
                ) &&
                activeViewMode !== 'video' &&
                !isVideoActive && (
                  <div
                    style={{
                      background:
                        clickedScreenShareSession.statusObj?.status === 'live'
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'var(--bg-hover)',
                      borderBottom: `1px solid ${
                        clickedScreenShareSession.statusObj?.status === 'live' ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-light)'
                      }`,
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.25rem' }}>
                        {clickedScreenShareSession.screenShareEnabled ? '🖥️' : '📹'}
                      </span>
                      <div>
                        <div
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            color: 'var(--text-main)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span>{clickedScreenShareSession.title}</span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background:
                                clickedScreenShareSession.statusObj?.status === 'live'
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : 'rgba(37, 99, 235, 0.15)',
                              color: clickedScreenShareSession.statusObj?.badgeColor,
                              border: `1px solid ${clickedScreenShareSession.statusObj?.badgeColor}40`,
                            }}
                          >
                            {clickedScreenShareSession.statusObj?.label}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Scheduled Event Time:{' '}
                          <strong style={{ color: 'var(--text-main)' }}>
                            {clickedScreenShareSession.scheduledTime
                              ? new Date(clickedScreenShareSession.scheduledTime).toLocaleString([], {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Upcoming'}
                          </strong>{' '}
                          • Host: {clickedScreenShareSession.senderName}
                          {clickedScreenShareSession.screenShareEnabled && (
                            <span style={{ color: '#0284c7', marginLeft: '6px', fontWeight: 600 }}>
                              • 🖥️ Screen Sharing Enabled
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleJoinScreenShare(clickedScreenShareSession)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          border: 'none',
                          background:
                            clickedScreenShareSession.statusObj?.status === 'live'
                              ? 'linear-gradient(135deg, #16a34a 0%, #059669 100%)'
                              : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                          color: '#ffffff',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        }}
                      >
                        {clickedScreenShareSession.statusObj?.status === 'live'
                          ? '🚀 Join Screen Share Call (Live)'
                          : '🗓️ Join / Enter Conference Room'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const key =
                            clickedScreenShareSession.meetingUrl ||
                            clickedScreenShareSession.title ||
                            clickedScreenShareSession.scheduledTime;
                          if (key) {
                            setConsumedMeetingKeys((prev) => new Set(prev).add(key));
                          }
                          setClickedScreenShareSession(null);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-muted)',
                          borderRadius: '6px',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                        title="Remove screen share banner"
                        aria-label="Remove screen share banner"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
              )}

              {/* VIEW 1: Pure Text Chat Mode */}
              {activeViewMode === 'chat' && (
                <div className={styles.chatMessagesWrapper}>
                  <ChatMessagesArea
                    selectedRoom={selectedRoom}
                    currentUser={currentUser}
                    messageGroups={messageGroups}
                    typingUsers={typingUsers}
                    messagesEndRef={messagesEndRef}
                    onJoinInAppVideo={(_url, sessionInfo) => {
                      handleJoinScreenShare(sessionInfo);
                    }}
                    onSelectScreenShare={handleSelectScreenShare}
                    onDeleteMessage={handleRequestDeleteMessage}
                  />
                  <ChatInputArea
                    messageText={messageText}
                    sending={sending}
                    onMessageTextChange={(val) => setMessageText(val)}
                    onSendMessage={handleSendMessage}
                    onFileSelect={handleFileSelect}
                    onTyping={handleTyping}
                  />
                </div>
              )}

              {/* VIEW 2: 100% In-App Video Conference Mode */}
              {activeViewMode === 'video' && (
                <InAppVideoConference
                  room={selectedRoom}
                  currentUser={currentUser}
                  socket={socket}
                  onLeave={handleLeaveInAppVideo}
                  onSwitchToChat={() => setActiveViewMode('chat')}
                  onOpenInviteModal={openMeetModal}
                  onStartNewVideoConference={handleOpenVideoConferenceModal}
                  isWholePageMode={isWholePageMode}
                  onToggleWholePageMode={() => setIsWholePageMode(!isWholePageMode)}
                />
              )}

              {/* VIEW 3: Split View (Side-by-side Video + Text Chat) */}
              {activeViewMode === 'split' && (
                <div className={styles.chatSplitArea}>
                  <div className={styles.splitVideoPane}>
                    <InAppVideoConference
                      room={selectedRoom}
                      currentUser={currentUser}
                      socket={socket}
                      onLeave={handleLeaveInAppVideo}
                      onSwitchToChat={() => setActiveViewMode('chat')}
                      onOpenInviteModal={openMeetModal}
                      onStartNewVideoConference={handleOpenVideoConferenceModal}
                      isWholePageMode={isWholePageMode}
                      onToggleWholePageMode={() => setIsWholePageMode(!isWholePageMode)}
                    />
                  </div>
                  <div className={styles.splitChatPane}>
                    <ChatMessagesArea
                      selectedRoom={selectedRoom}
                      currentUser={currentUser}
                      messageGroups={messageGroups}
                      typingUsers={typingUsers}
                      messagesEndRef={messagesEndRef}
                      onJoinInAppVideo={() => {
                        handleStartInAppVideo();
                      }}
                      onDeleteMessage={handleRequestDeleteMessage}
                    />
                    <ChatInputArea
                      messageText={messageText}
                      sending={sending}
                      onMessageTextChange={(val) => setMessageText(val)}
                      onSendMessage={handleSendMessage}
                      onFileSelect={handleFileSelect}
                      onTyping={handleTyping}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={styles.noRoomSelected}>
              <div className={styles.noRoomGraphic}>💬</div>
              <h3>No Conversation Selected</h3>
              <p>Choose a conversation from the sidebar or start a new chat channel.</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  className={styles.newConferenceBtn}
                  onClick={handleOpenVideoConferenceModal}
                  style={{ padding: '9px 18px', fontSize: '0.85rem' }}
                >
                  📹 Start Video Conference (Today)
                </button>
                <button
                  type="button"
                  className={styles.startChatBtn}
                  onClick={handleStartNewChat}
                >
                  ➕ Start New Conversation
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar: Members & Online Status */}
        {selectedRoom && showMembersPanel && (
          <ChatMembersPanel
            participants={participants}
            onlineParticipants={onlineParticipants}
            onClose={() => setShowMembersPanel(false)}
          />
        )}
      </div>

      {/* New Conversation Modal (Text Chat & Video Conference) */}
      <NewChatModal
        show={showNewChatModal}
        chatType={chatType}
        modalUserTab={modalUserTab}
        userSearchQuery={userSearchQuery}
        selectedUserId={selectedUserId}
        selectedDepartmentId={selectedDepartmentId}
        selectedTicketId={selectedTicketId}
        newChatName={newChatName}
        creatingRoom={creatingRoom}
        loadingUsers={loadingUsers}
        loadingModalMembers={loadingModalMembers}
        filteredUsers={filteredUsers}
        departments={departments}
        tickets={tickets}
        modalMembers={modalMembers}
        videoConferenceTarget={videoConferenceTarget}
        conferenceTitle={conferenceTitle}
        conferenceScheduleMode={conferenceScheduleMode}
        conferenceScheduledTime={conferenceScheduledTime}
        conferenceDurationMinutes={conferenceDurationMinutes}
        conferenceScreenShare={conferenceScreenShare}
        conferenceStartAudioMuted={conferenceStartAudioMuted}
        conferenceStartVideoMuted={conferenceStartVideoMuted}
        onSetVideoConferenceTarget={(t) => setVideoConferenceTarget(t)}
        onSetConferenceTitle={(title) => setConferenceTitle(title)}
        onSetConferenceScheduleMode={(m) => setConferenceScheduleMode(m)}
        onSetConferenceScheduledTime={(time) => setConferenceScheduledTime(time)}
        onSetConferenceDurationMinutes={(mins) => setConferenceDurationMinutes(mins)}
        onSetConferenceScreenShare={(s) => setConferenceScreenShare(s)}
        onSetConferenceStartAudioMuted={(a) => setConferenceStartAudioMuted(a)}
        onSetConferenceStartVideoMuted={(v) => setConferenceStartVideoMuted(v)}
        onCreateVideoConference={handleCreateVideoConference}
        onClose={() => setShowNewChatModal(false)}
        onSetChatType={(t) => setChatType(t)}
        onSetModalUserTab={(tab) => setModalUserTab(tab)}
        onSetUserSearchQuery={(q) => setUserSearchQuery(q)}
        onSelectUserId={(id) => setSelectedUserId(id)}
        onSelectDepartmentId={(id) => setSelectedDepartmentId(id)}
        onSelectTicketId={(id) => setSelectedTicketId(id)}
        onSetNewChatName={(name) => setNewChatName(name)}
        onCreateRoom={handleCreateRoom}
        onStartDirectChat={handleStartDirectUserChat}
      />

      {/* Meeting Customization & Role-Based Invitation Modal */}
      <MeetingInviteModal
        show={showMeetModal}
        meetTitle={meetTitle}
        meetNotes={meetNotes}
        meetUrl={meetUrl}
        meetingPlatform={meetingPlatform}
        meetingScreenShare={meetingScreenShare}
        meetingStartAudioMuted={meetingStartAudioMuted}
        meetingStartVideoMuted={meetingStartVideoMuted}
        meetingRequireRegisteredOnly={meetingRequireRegisteredOnly}
        meetingPasscode={meetingPasscode}
        meetingScheduleMode={meetingScheduleMode}
        meetingScheduledTime={meetingScheduledTime}
        meetingDurationMinutes={meetingDurationMinutes}
        sendingMeetInvite={sendingMeetInvite}
        meetSuccessMsg={meetSuccessMsg}
        loadingContacts={loadingContacts}
        contactSearchQuery={contactSearchQuery}
        selectedRoleFilter={selectedRoleFilter}
        selectedRecipientEmails={selectedRecipientEmails}
        registeredContacts={registeredContacts}
        availableRoles={availableRoles}
        filteredRegisteredContacts={filteredRegisteredContacts}
        onClose={() => setShowMeetModal(false)}
        onSetMeetTitle={(t) => setMeetTitle(t)}
        onSetMeetNotes={(n) => setMeetNotes(n)}
        onSetMeetUrl={(u) => setMeetUrl(u)}
        onSetMeetingPlatform={(p) => setMeetingPlatform(p)}
        onSetMeetingScreenShare={(s) => setMeetingScreenShare(s)}
        onSetMeetingStartAudioMuted={(a) => setMeetingStartAudioMuted(a)}
        onSetMeetingStartVideoMuted={(v) => setMeetingStartVideoMuted(v)}
        onSetMeetingRequireRegisteredOnly={(r) => setMeetingRequireRegisteredOnly(r)}
        onSetMeetingPasscode={(c) => setMeetingPasscode(c)}
        onSetMeetingScheduleMode={(m) => setMeetingScheduleMode(m)}
        onSetMeetingScheduledTime={(t) => setMeetingScheduledTime(t)}
        onSetMeetingDurationMinutes={(d) => setMeetingDurationMinutes(d)}
        onSetContactSearchQuery={(q) => setContactSearchQuery(q)}
        onSetSelectedRoleFilter={(f) => setSelectedRoleFilter(f)}
        onToggleRecipientSelection={toggleRecipientSelection}
        onSelectAllInRole={selectAllInRole}
        onClearSelection={() => setSelectedRecipientEmails([])}
        onSendMeetInvite={handleSendMeetInvite}
        onStartInAppVideo={() => {
          setShowMeetModal(false);
          handleStartInAppVideo();
        }}
      />

      {/* Delete Message Confirmation Modal (Delete for Everyone & Delete Only for Me) */}
      <DeleteMessageModal
        show={Boolean(messageToDelete)}
        message={messageToDelete}
        currentUserId={currentUser.id}
        deleting={deletingMessage}
        onClose={() => setMessageToDelete(null)}
        onConfirmDelete={handleConfirmDeleteMessage}
      />
    </div>
  );
}
