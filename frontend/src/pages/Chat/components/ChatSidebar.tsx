import React from 'react';
import {
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  PlusIcon,
} from '@heroicons/react/24/solid';
import type { ChatRoom } from '../../../api/chatApi';
import { getAvatarGradient, formatTimeOnly } from '../types';
import styles from '../ChatPage.module.css';

interface ChatSidebarProps {
  rooms: ChatRoom[];
  displayRooms: ChatRoom[];
  selectedRoom: ChatRoom | null;
  loading: boolean;
  searchTerm: string;
  activeFilter: 'all' | 'direct' | 'department' | 'ticket' | 'video';
  unreadCount: number;
  mobileSidebarOpen: boolean;
  isSidebarCollapsed?: boolean;
  roomTypeCounts: {
    all: number;
    direct: number;
    department: number;
    ticket: number;
    video: number;
  };
  onSelectRoom: (room: ChatRoom) => void;
  onSearchChange: (val: string) => void;
  onFilterChange: (filter: 'all' | 'direct' | 'department' | 'ticket' | 'video') => void;
  onStartNewChat: () => void;
  onStartVideoConference: () => void;
  onCloseMobileSidebar: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  rooms,
  displayRooms,
  selectedRoom,
  loading,
  searchTerm,
  activeFilter,
  unreadCount,
  mobileSidebarOpen,
  isSidebarCollapsed,
  roomTypeCounts,
  onSelectRoom,
  onSearchChange,
  onFilterChange,
  onStartNewChat,
  onStartVideoConference,
  onCloseMobileSidebar,
}) => {
  return (
    <div
      className={`${styles.chatSidebar} ${
        mobileSidebarOpen ? styles.sidebarOpenMobile : ''
      } ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}
    >
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarTitleRow}>
          <div className={styles.sidebarTitleGroup}>
            <div className={styles.sidebarIconBubble}>
              <ChatBubbleLeftRightIcon className={styles.sidebarHeaderSvg} />
            </div>
            <h2>Conversations</h2>
          </div>
        </div>

        <div className={styles.sidebarActionsGroup}>
          <button
            type="button"
            className={styles.newConferenceBtn}
            onClick={onStartVideoConference}
            title="Start or schedule Video Conference (Today or custom date)"
          >
            <VideoCameraIcon className={styles.btnSvgIcon} />
            <span className={styles.newChatBtnText}>Video Call</span>
          </button>
          <button
            type="button"
            className={styles.newChatBtn}
            onClick={onStartNewChat}
            title="Start new conversation"
          >
            <PlusIcon className={styles.btnSvgIcon} />
            <span className={styles.newChatBtnText}>New Chat</span>
          </button>
        </div>

        {unreadCount > 0 && (
          <div className={styles.unreadBanner}>
            <span className={styles.pulseDot} />
            <span>
              {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={() => onSearchChange('')}
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className={styles.filterPills}>
          <button
            type="button"
            className={`${styles.filterPill} ${styles.filterPillAll} ${
              activeFilter === 'all' ? styles.filterActiveAll : ''
            }`}
            onClick={() => onFilterChange('all')}
          >
            <span>💬 All</span>
            <span className={styles.pillCount}>{roomTypeCounts.all}</span>
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${styles.filterPillVideo} ${
              activeFilter === 'video' ? styles.filterActiveVideo : ''
            }`}
            onClick={() => onFilterChange('video')}
            title="Video conferences & active call channels"
          >
            <span>📹 Video</span>
            <span className={styles.pillCount}>{roomTypeCounts.video}</span>
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${styles.filterPillDirect} ${
              activeFilter === 'direct' ? styles.filterActiveDirect : ''
            }`}
            onClick={() => onFilterChange('direct')}
          >
            <span>👤 Direct</span>
            <span className={styles.pillCount}>{roomTypeCounts.direct}</span>
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${styles.filterPillDept} ${
              activeFilter === 'department' ? styles.filterActiveDept : ''
            }`}
            onClick={() => onFilterChange('department')}
          >
            <span>🏢 Dept</span>
            <span className={styles.pillCount}>{roomTypeCounts.department}</span>
          </button>
          <button
            type="button"
            className={`${styles.filterPill} ${styles.filterPillTicket} ${
              activeFilter === 'ticket' ? styles.filterActiveTicket : ''
            }`}
            onClick={() => onFilterChange('ticket')}
          >
            <span>🎫 Tickets</span>
            <span className={styles.pillCount}>{roomTypeCounts.ticket}</span>
          </button>
        </div>
      </div>

      {/* Room List */}
      <div className={styles.roomList}>
        {loading && rooms.length === 0 ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Loading your conversations...</p>
          </div>
        ) : displayRooms.length === 0 ? (
          <div className={styles.sidebarEmptyState}>
            <div className={styles.sidebarEmptyIconWrapper}>
              {activeFilter === 'video' ? (
                <VideoCameraIcon className={styles.sidebarEmptyIcon} />
              ) : (
                <ChatBubbleLeftRightIcon className={styles.sidebarEmptyIcon} />
              )}
            </div>
            <h4 className={styles.sidebarEmptyTitle}>
              {activeFilter === 'video' ? 'No video conferences' : 'No conversations'}
            </h4>
            <p className={styles.sidebarEmptySubtitle}>
              {searchTerm
                ? 'No chats match your search query.'
                : activeFilter === 'video'
                ? 'Launch or schedule an in-app video conference.'
                : 'Start a direct chat, department channel, or ticket discussion.'}
            </p>
            <div className={styles.sidebarEmptyActions}>
              <button
                type="button"
                className={styles.sidebarEmptyVideoBtn}
                onClick={onStartVideoConference}
              >
                <VideoCameraIcon className={styles.btnSmallIcon} />
                <span>Video Conference</span>
              </button>
              <button
                type="button"
                className={styles.sidebarEmptyChatBtn}
                onClick={onStartNewChat}
              >
                <PlusIcon className={styles.btnSmallIcon} />
                <span>Start New Chat</span>
              </button>
            </div>
          </div>
        ) : (
          displayRooms.map((room) => {
            const isSelected = selectedRoom?.id === room.id;
            const avatarBg = getAvatarGradient(room.name || room.id);
            const isDirect = room.room_type === 'direct';
            const isDirectOnline = Boolean(room.other_user_online);
            const onlineCount = room.online_members_count ?? 0;
            const isVideoRoom = Boolean(
              room.last_message?.includes('[VIDEO_CONFERENCE]') ||
              room.last_message?.includes('[GOOGLE_MEET_CALL]') ||
              room.last_message?.toLowerCase().includes('video conference') ||
              room.name?.toLowerCase().includes('conference')
            );

            return (
              <div
                key={room.id}
                className={`${styles.roomItem} ${isSelected ? styles.activeRoom : ''}`}
                onClick={() => {
                  onSelectRoom(room);
                  onCloseMobileSidebar();
                }}
              >
                <div className={styles.roomAvatarWrapper}>
                  <div className={styles.roomAvatar} style={{ background: avatarBg }}>
                    {isDirect
                      ? room.name?.[0] || 'U'
                      : room.room_type === 'ticket'
                      ? '🎫'
                      : '🏢'}
                  </div>
                  {isDirect ? (
                    <span
                      className={`${styles.onlineIndicator} ${
                        isDirectOnline ? styles.online : styles.offline
                      }`}
                      title={isDirectOnline ? 'Active now on Chat Page' : 'Offline'}
                    />
                  ) : (
                    onlineCount > 0 && (
                      <span
                        className={`${styles.onlineIndicator} ${styles.online}`}
                        title={`${onlineCount} online now`}
                      />
                    )
                  )}
                </div>

                <div className={styles.roomContent}>
                  <div className={styles.roomTopRow}>
                    <div className={styles.roomNameWrapper}>
                      <span className={styles.roomName}>{room.name}</span>
                      <span
                        className={`${styles.roomTypeBadge} ${
                          room.room_type === 'direct'
                            ? styles.badgeDirect
                            : room.room_type === 'department'
                            ? styles.badgeDepartment
                            : styles.badgeTicket
                        }`}
                      >
                        {room.room_type}
                      </span>
                      {isVideoRoom && (
                        <span className={styles.videoRoomBadge} title="Video Conference Available">
                          <VideoCameraIcon className={styles.videoBadgeIcon} />
                          <span>Video</span>
                        </span>
                      )}
                    </div>
                    {room.last_message_at && (
                      <span className={styles.roomTime}>
                        {formatTimeOnly(room.last_message_at)}
                      </span>
                    )}
                  </div>

                  <div className={styles.roomBottomRow}>
                    <p className={styles.lastMessagePreview}>
                      {room.last_message
                        ? room.last_message.startsWith('🎥 [VIDEO_CONFERENCE]')
                          ? '📹 Video Conference Invitation'
                          : room.last_message.startsWith('🎥 [GOOGLE_MEET_CALL]')
                          ? '🎥 Video Meeting Invitation'
                          : room.last_message
                        : 'No messages yet'}
                    </p>
                    {Boolean(room.unread_count && room.unread_count > 0) && (
                      <span className={styles.unreadBadge}>
                        {(room.unread_count ?? 0) > 99 ? '99+' : room.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
