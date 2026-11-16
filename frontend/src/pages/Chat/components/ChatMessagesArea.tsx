import React, { useState } from 'react';
import type { ChatMessage, ChatRoom } from '../../../api/chatApi';
import { buildAttachmentUrl } from '../../../utils/attachmentUtils';
import {
  parseMeetingMessage,
  getRoleColor,
  getAvatarGradient,
  formatTimeOnly,
  copyToClipboard,
  getMeetingEventStatus,
  getEffectiveConferenceUrl,
} from '../types';
import {
  DocumentDuplicateIcon,
  TrashIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import styles from '../ChatPage.module.css';

interface ChatMessagesAreaProps {
  selectedRoom: ChatRoom;
  currentUser: any;
  messageGroups: { date: string; items: ChatMessage[] }[];
  typingUsers: Set<string>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onJoinInAppVideo: (meetingUrl?: string, sessionInfo?: any) => void;
  onSelectScreenShare?: (sessionInfo: any) => void;
  onDeleteMessage?: (msg: ChatMessage) => void;
  isUserOnline?: (userId?: string, email?: string) => boolean;
  participants?: any[];
}

const getFileMeta = (fileName: string = '') => {
  const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';
  if (['PDF'].includes(ext)) {
    return { ext, label: 'PDF Document', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' };
  }
  if (['DOC', 'DOCX'].includes(ext)) {
    return { ext, label: 'Word Document', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
  }
  if (['XLS', 'XLSX', 'CSV'].includes(ext)) {
    return { ext, label: 'Spreadsheet', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
  }
  if (['PPT', 'PPTX'].includes(ext)) {
    return { ext, label: 'Presentation', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
  }
  if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(ext)) {
    return { ext, label: 'Archive', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
  }
  if (['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(ext)) {
    return { ext, label: 'Image', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' };
  }
  return { ext, label: 'Attachment', color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' };
};

export const ChatMessagesArea: React.FC<ChatMessagesAreaProps> = ({
  selectedRoom,
  currentUser,
  messageGroups,
  typingUsers,
  messagesEndRef,
  onJoinInAppVideo,
  onSelectScreenShare,
  onDeleteMessage,
  isUserOnline,
  participants,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyMessage = (id: string, text: string) => {
    if (!text) return;
    copyToClipboard(text, 'Message copied to clipboard');
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const renderFormattedMessageText = (text: string, isOwn: boolean) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      const parts = line.split(/(https?:\/\/[^\s]+|`[^`]+`)/g);
      return (
        <React.Fragment key={lineIdx}>
          {parts.map((part, partIdx) => {
            if (/^https?:\/\//i.test(part)) {
              return (
                <a
                  key={partIdx}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={isOwn ? styles.ownMessageLink : styles.otherMessageLink}
                  onClick={(e) => e.stopPropagation()}
                >
                  {part}
                </a>
              );
            }
            if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
              return (
                <code key={partIdx} className={isOwn ? styles.ownInlineCode : styles.otherInlineCode}>
                  {part.slice(1, -1)}
                </code>
              );
            }
            return part;
          })}
          {lineIdx < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };
  return (
    <div className={styles.messagesArea}>
      {messageGroups.length === 0 ? (
        <div className={styles.emptyMessagesArea}>
          <div className={styles.emptyMessageIconWrapper}>
            <ChatBubbleLeftRightIcon className={styles.emptyMessageSvg} />
          </div>
          <h3 className={styles.emptyMessagesTitle}>Start the Conversation</h3>
          <p className={styles.emptyMessagesSubtitle}>
            This is the beginning of the workspace discussion in <strong>{selectedRoom.name}</strong>.
            Send a text message, attach relevant documents, or start a video conference.
          </p>
          <div className={styles.emptyMessageBadge}>
            <span>💬 Real-Time Workspace Communications</span>
          </div>
        </div>
      ) : (
        messageGroups.map((group) => (
          <div key={group.date} className={styles.dateGroup}>
            <div className={styles.dateDivider}>
              <span>{group.date}</span>
            </div>

            {group.items.map((msg) => {
              const isOwn = Boolean(
                currentUser?.id &&
                msg.sender_id &&
                String(msg.sender_id).trim() === String(currentUser.id).trim()
              );
              const roleStyle = getRoleColor(msg.sender_role || msg.role_name || '');
              const meetingInfo = parseMeetingMessage(msg.message);

              if (msg.is_deleted || msg.is_deleted_for_me) {
                let deletedText = '';
                if (msg.is_deleted_for_me) {
                  deletedText = 'the chat deleted for you';
                } else if (isOwn) {
                  deletedText = 'you deleted chat';
                } else {
                  deletedText = 'the creator deleted the chat created';
                }

                return (
                  <div
                    key={msg.id}
                    className={`${styles.messageRow} ${
                      isOwn ? styles.ownMessageRow : styles.otherMessageRow
                    }`}
                  >
                    {!isOwn && (
                      <div
                        className={styles.senderAvatar}
                        style={{
                          background: getAvatarGradient(`${msg.first_name} ${msg.last_name}`),
                        }}
                      >
                        {msg.first_name?.[0] || 'U'}
                      </div>
                    )}
                    <div className={styles.messageBubbleWrapper}>
                      <div
                        className={`${styles.messageBubble} ${
                          isOwn ? styles.ownBubble : styles.otherBubble
                        } ${styles.deletedMessageBubble}`}
                      >
                        <div className={styles.deletedMessageContent}>
                          <span className={styles.deletedMessageIcon}>🚫</span>
                          <span className={styles.deletedMessageText}>
                            {deletedText}
                          </span>
                        </div>
                        <div className={styles.messageMeta}>
                          <span className={styles.messageTimestamp}>
                            {formatTimeOnly(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`${styles.messageRow} ${
                    isOwn ? styles.ownMessageRow : styles.otherMessageRow
                  } ${meetingInfo ? styles.meetMessageRow : ''}`}
                >
                  {!isOwn && (
                    <div
                      className={styles.senderAvatar}
                      style={{
                        background: getAvatarGradient(`${msg.first_name} ${msg.last_name}`),
                      }}
                    >
                      {msg.first_name?.[0] || 'U'}
                    </div>
                  )}

                  <div className={styles.messageBubbleWrapper}>
                    {!isOwn && (
                      <div className={styles.senderInfo}>
                        <span className={styles.senderName}>
                          {msg.first_name} {msg.last_name}
                        </span>
                        {(msg.sender_role || msg.role_name) && (
                          <span
                            className={styles.senderRole}
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
                      className={
                        meetingInfo
                          ? styles.meetBubbleWrapper
                          : `${styles.messageBubble} ${
                              isOwn ? styles.ownBubble : styles.otherBubble
                            }`
                      }
                    >
                      {(() => {
                        if (meetingInfo) {
                          const isDms = meetingInfo.meetingType === 'dms_conference';
                          const confInfo = getEffectiveConferenceUrl(meetingInfo.meetingUrl);

                          // Host and peer online status check
                          const isHostOnline =
                            isOwn || (isUserOnline ? isUserOnline(msg.sender_id) : false);
                          const isPeerOnline =
                            selectedRoom.room_type === 'direct'
                              ? isUserOnline
                                ? isUserOnline(selectedRoom.other_user_id || undefined)
                                : Boolean(selectedRoom.other_user_online)
                              : isHostOnline ||
                                (participants
                                  ? participants.some((p: any) => p.user_id !== currentUser.id && p.is_online)
                                  : false);

                          const canJoinPastSession = isHostOnline || isPeerOnline;

                          const eventStatus = getMeetingEventStatus(
                            meetingInfo.scheduledTime,
                            meetingInfo.durationMinutes || 30,
                            canJoinPastSession,
                            meetingInfo.createdAt
                          );

                          return (
                            <div
                              className={styles.meetMessageCard}
                              onClick={() => {
                                onSelectScreenShare?.({
                                  ...meetingInfo,
                                  roomId: confInfo.roomId,
                                  statusObj: eventStatus,
                                  senderName: `${msg.first_name || ''} ${msg.last_name || ''}`.trim() || 'Team Member',
                                  messageId: msg.id,
                                  canJoinPastSession,
                                  isHostOnline,
                                });
                              }}
                              style={{ cursor: 'pointer' }}
                              title="Click to view and connect screen share session"
                            >
                              <div className={styles.meetCardHeader}>
                                <span
                                  className={`${styles.meetBadge} ${
                                    isDms ? styles.meetBadgeDms : ''
                                  }`}
                                >
                                  <span
                                    className={`${styles.meetLivePulse} ${
                                      isDms ? styles.meetLivePulseDms : ''
                                    }`}
                                  />
                                  {isDms ? '🛡️ In-App HD Video & Screen Share' : '🎥 Video Meeting Call'}
                                </span>
                                <div className={styles.meetHeaderRightGroup}>
                                  <span className={styles.meetTimestamp}>
                                    {formatTimeOnly(msg.created_at)}
                                  </span>
                                  {onDeleteMessage && (
                                    <button
                                      type="button"
                                      className={styles.messageDeleteIconBtn}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteMessage(msg);
                                      }}
                                      title="Delete Video Call from conversation"
                                      aria-label="Delete Video Call"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              </div>
                              <h4 className={styles.meetCardTitle}>{meetingInfo.title}</h4>

                              {/* Scheduled Event Timing Banner */}
                              {meetingInfo.scheduledTime && (
                                <div
                                  style={{
                                    background:
                                      eventStatus.status === 'live'
                                        ? 'rgba(16, 185, 129, 0.12)'
                                        : eventStatus.status === 'ended'
                                        ? 'rgba(225, 29, 72, 0.08)'
                                        : 'var(--bg-hover)',
                                    border: `1px solid ${
                                      eventStatus.status === 'live'
                                        ? 'rgba(16, 185, 129, 0.35)'
                                        : eventStatus.status === 'ended'
                                        ? 'rgba(225, 29, 72, 0.28)'
                                        : 'var(--border-light)'
                                    }`,
                                    borderLeft: `4px solid ${eventStatus.badgeColor}`,
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    margin: '8px 0 10px 0',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: '6px',
                                      flexWrap: 'wrap',
                                      minWidth: 0,
                                      width: '100%',
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        color: 'var(--text-main)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        flexWrap: 'wrap',
                                        minWidth: 0,
                                        wordBreak: 'break-word',
                                      }}
                                    >
                                      <span>🗓️</span> Event Time:
                                      <span style={{ color: 'var(--text-main)', wordBreak: 'break-word' }}>
                                        {eventStatus.formattedDateStr ||
                                          new Date(meetingInfo.scheduledTime).toLocaleString([], {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                      </span>
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 700,
                                        padding: '3px 9px',
                                        borderRadius: '12px',
                                        background:
                                          eventStatus.status === 'live'
                                            ? '#dcfce7'
                                            : eventStatus.status === 'upcoming'
                                            ? '#dbeafe'
                                            : '#ffe4e6',
                                        color: eventStatus.badgeColor,
                                        border: `1px solid ${eventStatus.badgeColor}40`,
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word',
                                        textAlign: 'center',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      {eventStatus.status === 'ended' ? '⏱️ ' : ''}
                                      {eventStatus.label}
                                    </span>
                                  </div>

                                  <div
                                    style={{
                                      fontSize: '0.7rem',
                                      color: 'var(--text-muted)',
                                      marginTop: '4px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      flexWrap: 'wrap',
                                      gap: '4px',
                                      minWidth: 0,
                                      wordBreak: 'break-word',
                                      width: '100%',
                                    }}
                                  >
                                    <span style={{ wordBreak: 'break-word' }}>
                                      Window: {eventStatus.formattedWindow || `${meetingInfo.durationMinutes || 30} mins`}{' '}
                                      ({meetingInfo.durationMinutes || 30} mins)
                                    </span>
                                    {meetingInfo.createdAt && (
                                      <span style={{ wordBreak: 'break-word' }}>
                                        Created:{' '}
                                        {new Date(meetingInfo.createdAt).toLocaleDateString([], {
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    )}
                                  </div>

                                  {/* Passed Over schedule indicator and online status */}
                                  {eventStatus.status === 'ended' && (
                                    <div
                                      style={{
                                        marginTop: '6px',
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        background: canJoinPastSession
                                          ? 'rgba(16, 185, 129, 0.08)'
                                          : 'rgba(239, 68, 68, 0.08)',
                                        border: `1px solid ${
                                          canJoinPastSession
                                            ? 'rgba(16, 185, 129, 0.25)'
                                            : 'rgba(239, 68, 68, 0.25)'
                                        }`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '6px',
                                        fontSize: '0.72rem',
                                        minWidth: 0,
                                        width: '100%',
                                        boxSizing: 'border-box',
                                      }}
                                    >
                                      <span style={{ color: 'var(--text-main)', fontWeight: 600, wordBreak: 'break-word', minWidth: 0, flex: '1 1 180px' }}>
                                        ⏱️ Schedule Passed Over: Ended at{' '}
                                        {eventStatus.endTime
                                          ? eventStatus.endTime.toLocaleTimeString([], {
                                              hour: 'numeric',
                                              minute: '2-digit',
                                            })
                                          : 'scheduled end'}{' '}
                                        ({eventStatus.timePassedStr})
                                      </span>
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontWeight: 700,
                                          color: canJoinPastSession ? '#059669' : '#dc2626',
                                          wordBreak: 'break-word',
                                          minWidth: 0,
                                          flexWrap: 'wrap',
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: '7px',
                                            height: '7px',
                                            borderRadius: '50%',
                                            backgroundColor: canJoinPastSession ? '#10b981' : '#dc2626',
                                            display: 'inline-block',
                                            flexShrink: 0,
                                          }}
                                        />
                                        {isOwn
                                          ? 'You are the Host (Online)'
                                          : isHostOnline
                                          ? 'Host is Online (Rejoin permitted)'
                                          : isPeerOnline
                                          ? 'Participant is Online (Rejoin permitted)'
                                          : 'Host Offline (Session ended)'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className={styles.meetCardDetails}>
                                <div className={styles.meetDetailRow}>
                                  <span className={styles.meetDetailLabel}>Host:</span>
                                  <strong className={styles.meetDetailValue}>{msg.first_name} {msg.last_name}</strong>
                                  {(msg.sender_role || msg.role_name) && (
                                    <span
                                      className={styles.senderRole}
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
                                {meetingInfo.roles && (
                                  <div className={styles.meetDetailRow}>
                                    <span className={styles.meetDetailLabel}>Target Roles:</span>
                                    <strong className={styles.meetDetailRoleTag}>{meetingInfo.roles}</strong>
                                  </div>
                                )}
                                {meetingInfo.recipientEmail && (
                                  <div className={styles.meetDetailRow}>
                                    <span className={styles.meetDetailLabel}>Invited:</span>
                                    <span className={styles.meetDetailEmail}>
                                      {meetingInfo.recipientEmail}
                                    </span>
                                  </div>
                                )}
                                {meetingInfo.screenShareEnabled && (
                                  <div className={styles.meetScreenShareTag}>
                                    🖥️ Screen Sharing Enabled: Attendees can share screen & view presentation
                                  </div>
                                )}
                                {meetingInfo.passcode && (
                                  <div className={styles.meetPasscodeTag}>
                                    🔑 Meeting Passcode: <code>{meetingInfo.passcode}</code>
                                  </div>
                                )}
                                {meetingInfo.notes && (
                                  <div className={styles.meetNotesText}>
                                    "{meetingInfo.notes}"
                                  </div>
                                )}
                              </div>
                              <div className={styles.meetUrlBox}>
                                <span>{meetingInfo.meetingUrl}</span>
                                <button
                                  type="button"
                                  className={styles.meetUrlCopyBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(
                                      confInfo.url,
                                      'Copied authenticated conference link to clipboard!'
                                    );
                                  }}
                                  title="Copy Direct Video Link"
                                >
                                  📋
                                </button>
                              </div>
                              <div className={styles.meetCardActions}>
                                {(() => {
                                  const isPast = eventStatus.status === 'ended';
                                  const isLive = eventStatus.status === 'live';
                                  const isUpcoming = eventStatus.status === 'upcoming';

                                  if (isPast) {
                                    if (canJoinPastSession) {
                                      return (
                                        <button
                                          type="button"
                                          className={`${styles.meetJoinBtn} ${styles.meetJoinBtnPastOnline}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onJoinInAppVideo(meetingInfo.meetingUrl, {
                                              ...meetingInfo,
                                              roomId: confInfo.roomId,
                                              statusObj: eventStatus,
                                              senderName:
                                                `${msg.first_name || ''} ${msg.last_name || ''}`.trim() || 'Team Member',
                                              messageId: msg.id,
                                            });
                                          }}
                                          title="Scheduled invitation time has passed, but host is currently online. Click to rejoin live conference."
                                        >
                                          {isOwn
                                            ? meetingInfo.screenShareEnabled
                                              ? '▶️ Reopen Screen Share & Video'
                                              : '▶️ Reopen Video Conference'
                                            : meetingInfo.screenShareEnabled
                                            ? '🔄 Rejoin Screen Share & Video (Host Online)'
                                            : '🔄 Rejoin In-App Video (Host Online)'}
                                        </button>
                                      );
                                    } else {
                                      return (
                                        <button
                                          type="button"
                                          className={`${styles.meetJoinBtn} ${styles.meetJoinBtnPastOffline}`}
                                          disabled
                                          onClick={(e) => e.stopPropagation()}
                                          title={`The scheduled session has ended (${eventStatus.timePassedStr}) and the host is currently offline. You can only join when the host is online.`}
                                        >
                                          {meetingInfo.screenShareEnabled
                                            ? '⏹️ Screen Share Ended (Host Offline)'
                                            : '⏹️ Video Call Ended (Host Offline)'}
                                        </button>
                                      );
                                    }
                                  }

                                  if (isUpcoming && !eventStatus.canJoinNow) {
                                    return (
                                      <button
                                        type="button"
                                        className={`${styles.meetJoinBtn} ${styles.meetJoinBtnUpcoming}`}
                                        disabled
                                        onClick={(e) => e.stopPropagation()}
                                        title={`Scheduled for the future (${eventStatus.label}). Early joining opens 15 minutes before event.`}
                                      >
                                        {meetingInfo.screenShareEnabled
                                          ? `🗓️ Screen Share (${eventStatus.label})`
                                          : `🗓️ Video Call (${eventStatus.label})`}
                                      </button>
                                    );
                                  }

                                  // Live or ready immediate session
                                  return (
                                    <button
                                      type="button"
                                      className={`${styles.meetJoinBtn} ${isLive ? styles.meetJoinBtnLive : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onJoinInAppVideo(meetingInfo.meetingUrl, {
                                          ...meetingInfo,
                                          roomId: confInfo.roomId,
                                          statusObj: eventStatus,
                                          senderName:
                                            `${msg.first_name || ''} ${msg.last_name || ''}`.trim() || 'Team Member',
                                          messageId: msg.id,
                                        });
                                      }}
                                      title="Join directly inside this web application"
                                    >
                                      {meetingInfo.screenShareEnabled
                                        ? isLive
                                          ? '🚀 Join Screen Share & Video (Live)'
                                          : '🖥️ Join Screen Share & Video'
                                        : isLive
                                        ? '🚀 Join In-App Video (Live)'
                                        : '📹 Join In-App Video'}
                                    </button>
                                  );
                                })()}

                                <button
                                  type="button"
                                  className={styles.meetPreviewBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(confInfo.url, '_blank');
                                  }}
                                  title="Open in new browser tab (Logged in session)"
                                >
                                  ↗ Open Tab
                                </button>

                                {onDeleteMessage && (
                                  <button
                                    type="button"
                                    className={styles.meetDeleteBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteMessage(msg);
                                    }}
                                    title="Delete Video Call invite"
                                  >
                                    🗑️ Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <>
                            {msg.attachment_path && msg.message_type === 'image' ? (
                              <div className={styles.imageAttachmentCard}>
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
                                <div className={styles.imageHoverOverlay}>
                                  <button
                                    type="button"
                                    className={styles.imageActionBtn}
                                    onClick={() =>
                                      window.open(buildAttachmentUrl(msg.attachment_path), '_blank')
                                    }
                                    title="View Full Size"
                                  >
                                    <EyeIcon className={styles.imageActionIcon} />
                                    <span>View</span>
                                  </button>
                                </div>
                              </div>
                            ) : msg.attachment_path ? (
                              (() => {
                                const fileMeta = getFileMeta(msg.attachment_name || '');
                                return (
                                  <a
                                    href={buildAttachmentUrl(msg.attachment_path)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.fileAttachmentCard}
                                    title={`Open or download ${msg.attachment_name || 'file'}`}
                                  >
                                    <div
                                      className={styles.fileBadgeIcon}
                                      style={{
                                        background: fileMeta.bg,
                                        borderColor: fileMeta.border,
                                        color: fileMeta.color,
                                      }}
                                    >
                                      <DocumentTextIcon className={styles.fileSvgIcon} />
                                      <span className={styles.fileExtBadge}>{fileMeta.ext}</span>
                                    </div>
                                    <div className={styles.fileInfo}>
                                      <span className={styles.fileName}>
                                        {msg.attachment_name || 'Attached File'}
                                      </span>
                                      <span className={styles.fileAction}>
                                        {fileMeta.label} • Click to open/download
                                      </span>
                                    </div>
                                    <div className={styles.fileDownloadBtn} title="Download file">
                                      <ArrowDownTrayIcon className={styles.downloadSvgIcon} />
                                    </div>
                                  </a>
                                );
                              })()
                            ) : null}

                            {msg.message && (
                              <div className={styles.messageText}>
                                {renderFormattedMessageText(msg.message, isOwn)}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Floating hover toolbar for text messages */}
                      {!meetingInfo && (
                        <div
                          className={`${styles.messageHoverToolbar} ${
                            isOwn ? styles.ownHoverToolbar : styles.otherHoverToolbar
                          }`}
                        >
                          <button
                            type="button"
                            className={styles.messageActionBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyMessage(msg.id, msg.message);
                            }}
                            title={copiedId === msg.id ? 'Copied to clipboard!' : 'Copy message text'}
                            aria-label="Copy message"
                          >
                            {copiedId === msg.id ? (
                              <CheckIcon className={styles.actionBtnIconCopied} />
                            ) : (
                              <DocumentDuplicateIcon className={styles.actionBtnIcon} />
                            )}
                          </button>

                          {onDeleteMessage && (
                            <button
                              type="button"
                              className={`${styles.messageActionBtn} ${styles.messageActionBtnDelete}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteMessage(msg);
                              }}
                              title={
                                isOwn
                                  ? 'Delete message (For Everyone / For Me)'
                                  : 'Delete message only for me'
                              }
                              aria-label="Delete message"
                            >
                              <TrashIcon className={styles.actionBtnIcon} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Message metadata (timestamp, edited flag, delivery checkmarks) */}
                      {!meetingInfo && (
                        <div className={styles.messageMeta}>
                          <span className={styles.messageTimestamp}>
                            {formatTimeOnly(msg.created_at)}
                          </span>
                          {msg.is_edited && <span className={styles.editedTag}>(edited)</span>}
                          {isOwn && (
                            <span className={styles.checkmarks} title="Delivered and read">
                              <svg
                                className={styles.doubleCheckSvg}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2.4"
                                  d="M3 13.5l4 4L17 7.5"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2.4"
                                  d="M7 13.5l4 4L21 7.5"
                                />
                              </svg>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      {/* Typing Indicators */}
      {typingUsers.size > 0 && (
        <div className={styles.typingIndicator}>
          <div className={styles.typingDots}>
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
  );
};

export default ChatMessagesArea;