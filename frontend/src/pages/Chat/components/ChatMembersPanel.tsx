import React from 'react';
import type { ChatParticipant } from '../../../api/chatApi';
import { getAvatarGradient, getRoleColor } from '../types';
import styles from '../ChatPage.module.css';

interface ChatMembersPanelProps {
  participants: ChatParticipant[];
  onlineParticipants: ChatParticipant[];
  onClose: () => void;
}

export const ChatMembersPanel: React.FC<ChatMembersPanelProps> = ({
  participants,
  onlineParticipants,
  onClose,
}) => {
  return (
    <div className={styles.membersPanel}>
      <div className={styles.membersPanelHeader}>
        <div className={styles.membersPanelTitleGroup}>
          <span style={{ fontSize: '1.1rem' }}>👥</span>
          <h4>Room Members ({participants.length})</h4>
        </div>
        <button
          type="button"
          className={styles.closeMembersBtn}
          onClick={onClose}
          title="Close Members Panel"
        >
          ✕
        </button>
      </div>

      <div className={styles.membersOnlineBadge}>
        <span className={styles.onlineDotIndicator} />
        <span>{onlineParticipants.length} active online now</span>
      </div>

      <div className={styles.membersList}>
        {participants.map((member) => {
          const roleName = member.role_name || (member as any).role || 'User';
          const roleStyle = getRoleColor(roleName);
          const fullName = `${member.first_name} ${member.last_name}`;

          return (
            <div
              key={member.id}
              className={`${styles.memberItem} ${
                member.is_online ? styles.memberItemOnline : styles.memberItemOffline
              }`}
            >
              <div className={styles.memberAvatarWrapper}>
                <div
                  className={styles.memberAvatar}
                  style={{ background: getAvatarGradient(fullName) }}
                >
                  {member.first_name?.[0] || 'U'}
                </div>
                <span
                  className={`${styles.memberOnlineIndicator} ${
                    member.is_online ? styles.online : styles.offline
                  }`}
                  title={member.is_online ? 'Online' : 'Offline'}
                />
              </div>

              <div className={styles.memberDetails}>
                <div className={styles.memberName}>{fullName}</div>
                <div className={styles.memberEmail}>{member.email}</div>
              </div>

              <span
                className={styles.memberRoleBadge}
                style={{
                  background: roleStyle.bg,
                  color: roleStyle.text,
                  borderColor: roleStyle.border,
                }}
              >
                {roleName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChatMembersPanel;
