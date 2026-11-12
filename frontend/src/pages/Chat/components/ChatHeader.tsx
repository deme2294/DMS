import React from 'react';
import {
  Bars3Icon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  ArrowsRightLeftIcon,
  EnvelopeIcon,
  UserGroupIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import type { ChatRoom, ChatParticipant } from '../../../api/chatApi';
import { getAvatarGradient } from '../types';
import ThemeToggle from '../../../components/ThemeToggle/ThemeToggle';
import styles from '../ChatPage.module.css';

interface ChatHeaderProps {
  selectedRoom: ChatRoom;
  participants: ChatParticipant[];
  onlineParticipants: ChatParticipant[];
  isDirectPartnerOnline: boolean;
  directPartner: ChatParticipant | null;
  activeViewMode: 'chat' | 'video' | 'split';
  isVideoActive: boolean;
  connected: boolean;
  showMembersPanel: boolean;
  isWholePageMode?: boolean;
  isSidebarCollapsed?: boolean;
  onSetViewMode: (mode: 'chat' | 'video' | 'split') => void;
  onOpenMeetModal: () => void;
  onToggleMembersPanel: () => void;
  onToggleMobileSidebar: () => void;
  onToggleWholePageMode?: () => void;
  onToggleSidebarCollapse?: () => void;
  onDirectStartVideo?: (room: ChatRoom) => void;
  onDirectStartChat?: (room: ChatRoom) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  selectedRoom,
  participants,
  onlineParticipants,
  isDirectPartnerOnline,
  directPartner,
  activeViewMode,
  isVideoActive,
  connected,
  showMembersPanel,
  isWholePageMode,
  isSidebarCollapsed,
  onSetViewMode,
  onOpenMeetModal,
  onToggleMembersPanel,
  onToggleMobileSidebar,
  onToggleWholePageMode,
  onToggleSidebarCollapse,
  onDirectStartVideo,
  onDirectStartChat,
}) => {
  const isDirect = selectedRoom.room_type === 'direct';
  const partnerName = directPartner
    ? `${directPartner.first_name} ${directPartner.last_name}`
    : selectedRoom.name;

  return (
    <header className={styles.chatHeader}>
      <div className={styles.chatHeaderLeft}>
        <button
          type="button"
          className={styles.mobileSidebarToggle}
          onClick={onToggleSidebarCollapse || onToggleMobileSidebar}
          aria-label="Toggle Conversations List"
          title={isSidebarCollapsed ? 'Show conversations list' : 'Hide conversations list to expand space'}
        >
          <Bars3Icon style={{ width: '18px', height: '18px' }} />
        </button>

        <div
          className={styles.roomAvatar}
          style={{ background: getAvatarGradient(selectedRoom.name || selectedRoom.id) }}
        >
          {isDirect
            ? partnerName?.[0] || 'U'
            : selectedRoom.room_type === 'ticket'
            ? '🎫'
            : '🏢'}
        </div>

        <div className={styles.chatHeaderInfo}>
          <div className={styles.chatHeaderTitleRow}>
            <h3 className={styles.chatHeaderTitle} title={isDirect ? partnerName : selectedRoom.name}>
              {isDirect ? partnerName : selectedRoom.name}
            </h3>
            <span
              className={`${styles.roomTypeTag} ${
                selectedRoom.room_type === 'direct'
                  ? styles.tagDirect
                  : selectedRoom.room_type === 'department'
                  ? styles.tagDepartment
                  : styles.tagTicket
              }`}
            >
              {selectedRoom.room_type}
            </span>
          </div>

          {isDirect ? (
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
                {isDirectPartnerOnline ? 'Active now' : 'Offline'}
              </span>
              {directPartner?.email && (
                <>
                  <span className={styles.metaDivider}>•</span>
                  <span className={styles.partnerEmail} title={directPartner.email}>{directPartner.email}</span>
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
                {onlineParticipants.length} online
              </span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.chatHeaderRight}>
        {/* ===================== MODE SWITCHER SEGMENTED PILL ===================== */}
        <div className={styles.modeSwitcherContainer}>
          <button
            type="button"
            className={`${styles.modeSwitchBtn} ${
              activeViewMode === 'chat' && !isVideoActive ? styles.modeSwitchBtnActive : ''
            }`}
            onClick={() => {
              if (onDirectStartChat) {
                onDirectStartChat(selectedRoom);
              } else {
                onSetViewMode('chat');
              }
            }}
            title="Pure Text Chat mode"
          >
            <ChatBubbleLeftRightIcon className={styles.modeHeaderIcon} />
            <span className={styles.modeText}>Chat</span>
          </button>

          <button
            type="button"
            className={`${styles.modeSwitchBtn} ${
              activeViewMode === 'video' || isVideoActive ? styles.modeSwitchBtnActive : ''
            }`}
            onClick={() => {
              if (onDirectStartVideo) {
                onDirectStartVideo(selectedRoom);
              } else {
                onSetViewMode('video');
              }
            }}
            title="In-App Video Conference & Screen Share"
          >
            <VideoCameraIcon className={styles.modeHeaderIcon} />
            <span className={styles.modeText}>Video</span>
            {isVideoActive && <span className={styles.liveTag}>LIVE</span>}
          </button>

          <button
            type="button"
            className={`${styles.modeSwitchBtn} ${
              activeViewMode === 'split' ? styles.modeSwitchBtnActive : ''
            }`}
            onClick={() => onSetViewMode('split')}
            title="Split Screen: View Chat and Video side-by-side"
          >
            <ArrowsRightLeftIcon className={styles.modeHeaderIcon} />
            <span className={styles.modeText}>Split</span>
          </button>
        </div>

        {/* Invite Registered Users / Schedule Event Time */}
        <button
          type="button"
          className={`${styles.headerActionBtn} ${styles.inviteMeetBtn}`}
          onClick={onOpenMeetModal}
          title="Schedule conference date and invite registered users"
        >
          <EnvelopeIcon className={styles.headerBtnIcon} />
          <span className={styles.headerActionBtnLabel}>Invite</span>
        </button>

        {/* Members Roster Toggle */}
        <button
          type="button"
          className={`${styles.headerActionBtn} ${showMembersPanel ? styles.headerActionBtnActive : ''}`}
          onClick={onToggleMembersPanel}
          title="Toggle participants and online status roster"
        >
          <UserGroupIcon className={styles.headerBtnIcon} />
          <span className={styles.headerActionBtnLabel}>Members</span>
          <span className={styles.headerMembersBadge}>{onlineParticipants.length}</span>
        </button>

        {/* Whole Page Mode Toggle */}
        {onToggleWholePageMode && (
          <button
            type="button"
            className={`${styles.headerActionBtn} ${isWholePageMode ? styles.headerActionBtnActive : ''}`}
            onClick={onToggleWholePageMode}
            title={
              isWholePageMode
                ? 'Exit whole page mode (restore standard view)'
                : 'Expand whole page mode (maximize screen share, video and chat visibility)'
            }
          >
            {isWholePageMode ? (
              <ArrowsPointingInIcon className={styles.headerBtnIcon} />
            ) : (
              <ArrowsPointingOutIcon className={styles.headerBtnIcon} />
            )}
            <span className={styles.headerActionBtnLabel}>{isWholePageMode ? 'Standard' : 'Whole Page'}</span>
          </button>
        )}

        {/* Header Theme Toggle (only in full-screen whole page mode when top navbar is hidden) */}
        {isWholePageMode && (
          <div className={styles.headerThemeToggleWrapper} title="Toggle between Light, Dark, or System mode">
            <ThemeToggle showLabels={false} />
          </div>
        )}

        {/* Socket Status Indicator */}
        <div
          className={`${styles.socketStatus} ${
            connected ? styles.statusConnected : styles.statusDisconnected
          }`}
          title={connected ? 'Real-time WebSocket connected' : 'WebSocket connecting...'}
        >
          <span className={styles.statusDot} />
          <span className={styles.socketStatusText}>{connected ? 'Live' : 'Offline'}</span>
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;