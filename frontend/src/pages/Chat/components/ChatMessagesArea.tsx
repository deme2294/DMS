import React from 'react';
import type { ChatMessage, ChatRoom } from '../../../api/chatApi';
import { buildAttachmentUrl } from '../../../utils/attachmentUtils';
import {
  parseMeetingMessage,
  getRoleColor,
  getAvatarGradient,
  formatTimeOnly,
  copyToClipboard,
  getMeetingEventStatus,
} from '../types';
import styles from '../ChatPage.module.css';

interface ChatMessagesAreaProps {
  selectedRoom: ChatRoom;
  currentUser: any;
  messageGroups: { date: string; items: ChatMessage[] }[];
  typingUsers: Set<string>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onJoinInAppVideo: (meetingUrl?: string) => void;
  onDeleteMessage?: (msg: ChatMessage) => void;
}

export const ChatMessagesArea: React.FC<ChatMessagesAreaProps> = ({
  selectedRoom,
  currentUser,
  messageGroups,
  typingUsers,
  messagesEndRef,
  onJoinInAppVideo,
  onDeleteMessage,
}) => {
  return (
    <div className={styles.messagesArea}>
      {messageGroups.length === 0 ? (
        <div className={styles.emptyMessagesArea}>
          <div className={styles.emptyMessageGraphic}>👋</div>
          <h3>Start the Conversation</h3>
          <p>
            This is the beginning of the discussion in <strong>{selectedRoom.name}</strong>.
            Send a message, invite members, or start an in-app video conference below.
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
                      className={`${styles.messageBubble} ${
                        isOwn ? styles.ownBubble : styles.otherBubble
                      }`}
                    >
                      {(() => {
                        const meetingInfo = parseMeetingMessage(msg.message);
                        if (meetingInfo) {
                          const isDms = meetingInfo.meetingType === 'dms_conference';
                          const eventStatus = getMeetingEventStatus(
                            meetingInfo.scheduledTime,
                            meetingInfo.durationMinutes || 30
                          );

                          return (
                            <div className={styles.meetMessageCard}>
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
                                  {isOwn && onDeleteMessage && (
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
                                    background: eventStatus.status === 'live' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-hover)',
                                    border: `1px solid ${eventStatus.status === 'live' ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-light)'}`,
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
                                      }}
                                    >
                                      <span>🗓️</span> Event Time:
                                      <span style={{ color: 'var(--text-main)' }}>
                                        {new Date(meetingInfo.scheduledTime).toLocaleString([], {
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
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        background:
                                          eventStatus.status === 'live'
                                            ? '#dcfce7'
                                            : eventStatus.status === 'upcoming'
                                            ? '#dbeafe'
                                            : '#f1f5f9',
                                        color: eventStatus.badgeColor,
                                        border: `1px solid ${eventStatus.badgeColor}40`,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {eventStatus.label}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '0.7rem',
                                      color: 'var(--text-muted)',
                                      marginTop: '3px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                    }}
                                  >
                                    <span>Duration: {meetingInfo.durationMinutes || 30} mins</span>
                                    {meetingInfo.createdAt && (
                                      <span>
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
                                    copyToClipboard(meetingInfo.meetingUrl, 'Copied Conference URL to clipboard!');
                                  }}
                                  title="Copy Link"
                                >
                                  📋
                                </button>
                              </div>
                              <div className={styles.meetCardActions}>
                                <button
                                  type="button"
                                  className={styles.meetJoinBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onJoinInAppVideo(meetingInfo.meetingUrl);
                                  }}
                                  style={
                                    eventStatus.status === 'live'
                                      ? {
                                          background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
                                          boxShadow: '0 0 12px rgba(22, 163, 74, 0.4)',
                                        }
                                      : undefined
                                  }
                                  title="Join directly inside this web application based on the event time"
                                >
                                  {meetingInfo.screenShareEnabled
                                    ? eventStatus.status === 'live'
                                      ? '🚀 Join Screen Share & Video (Live)'
                                      : '🖥️ Join Screen Share & Video'
                                    : eventStatus.status === 'live'
                                    ? '🚀 Join In-App Video (Live)'
                                    : '📹 Join In-App Video'}
                                </button>
                                <button
                                  type="button"
                                  className={styles.meetPreviewBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(meetingInfo.meetingUrl, '_blank');
                                  }}
                                  title="Open in new browser tab"
                                >
                                  ↗ Open Tab
                                </button>
                                {isOwn && onDeleteMessage && (
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
                                  <span className={styles.fileName}>
                                    {msg.attachment_name || 'Download File'}
                                  </span>
                                  <span className={styles.fileAction}>Click to open / download</span>
                                </div>
                                <span className={styles.downloadIcon}>⬇</span>
                              </a>
                            ) : null}

                            <div className={styles.messageText}>{msg.message}</div>
                          </>
                        );
                      })()}

                      <div className={styles.messageMeta}>
                        <span className={styles.messageTimestamp}>
                          {formatTimeOnly(msg.created_at)}
                        </span>
                        {msg.is_edited && <span className={styles.editedTag}>(edited)</span>}
                        {isOwn && <span className={styles.checkmarks}>✓✓</span>}
                        {onDeleteMessage && (
                          <button
                            type="button"
                            className={styles.messageDeleteIconBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteMessage(msg);
                            }}
                            title={isOwn ? 'Delete message (For Everyone / For Me)' : 'Delete message only for me'}
                            aria-label="Delete message"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
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
