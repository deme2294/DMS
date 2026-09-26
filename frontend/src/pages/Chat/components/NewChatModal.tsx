import React from 'react';
import {
  ChatBubbleLeftRightIcon,
  ChatBubbleLeftEllipsisIcon,
  UserIcon,
  BuildingOffice2Icon,
  TicketIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  VideoCameraIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  UserGroupIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import type { ChatMember } from '../../../api/chatApi';
import type { OnlineUser, Department, Ticket } from '../types';
import { getAvatarGradient, getRoleColor } from '../types';
import styles from '../ChatPage.module.css';

interface NewChatModalProps {
  show: boolean;
  chatType: 'direct' | 'department' | 'ticket';
  modalUserTab: 'all' | 'online';
  userSearchQuery: string;
  selectedUserId: string;
  selectedDepartmentId: string;
  selectedTicketId: string;
  newChatName: string;
  creatingRoom: boolean;
  loadingUsers: boolean;
  loadingModalMembers: boolean;
  filteredUsers: OnlineUser[];
  departments: Department[];
  tickets: Ticket[];
  modalMembers: ChatMember[];
  onClose: () => void;
  onSetChatType: (type: 'direct' | 'department' | 'ticket') => void;
  onSetModalUserTab: (tab: 'all' | 'online') => void;
  onSetUserSearchQuery: (query: string) => void;
  onSelectUserId: (id: string) => void;
  onSelectDepartmentId: (id: string) => void;
  onSelectTicketId: (id: string) => void;
  onSetNewChatName: (name: string) => void;
  onCreateRoom: (e: React.FormEvent) => void;
  onStartDirectChat?: (userId: string, initialMode: 'chat' | 'video') => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  show,
  chatType,
  modalUserTab,
  userSearchQuery,
  selectedUserId,
  selectedDepartmentId,
  selectedTicketId,
  newChatName,
  creatingRoom,
  loadingUsers,
  loadingModalMembers,
  filteredUsers,
  departments,
  tickets,
  modalMembers,
  onClose,
  onSetChatType,
  onSetModalUserTab,
  onSetUserSearchQuery,
  onSelectUserId,
  onSelectDepartmentId,
  onSelectTicketId,
  onSetNewChatName,
  onCreateRoom,
  onStartDirectChat,
}) => {
  if (!show) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <div className={styles.modalIconWrap}>
              <ChatBubbleLeftRightIcon className={styles.modalHeaderIcon} />
            </div>
            <div>
              <h3 className={styles.modalTitle}>Start New Conversation</h3>
              <p className={styles.modalSubtitle}>Connect with a team member, department, or ticket channel</p>
            </div>
          </div>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose} aria-label="Close">
            <XMarkIcon className={styles.closeIconSvg} />
          </button>
        </div>

        <form onSubmit={onCreateRoom}>
          <div className={styles.modalBody}>
            {/* Chat Type Selection */}
            <div className={styles.chatTypeSelector}>
              <button
                type="button"
                className={`${styles.typeOption} ${chatType === 'direct' ? styles.typeOptionActive : ''}`}
                onClick={() => onSetChatType('direct')}
              >
                <div className={`${styles.typeIconBox} ${styles.typeIconDirect}`}>
                  <UserIcon className={styles.typeIconSvg} />
                </div>
                <div className={styles.typeInfo}>
                  <div className={styles.typeTitleRow}>
                    <span className={styles.typeTitle}>Direct Message</span>
                    {chatType === 'direct' && <CheckCircleIcon className={styles.typeCheckIcon} />}
                  </div>
                  <span className={styles.typeDesc}>1-on-1 private chat with any registered member</span>
                </div>
              </button>

              <button
                type="button"
                className={`${styles.typeOption} ${chatType === 'department' ? styles.typeOptionActive : ''}`}
                onClick={() => onSetChatType('department')}
              >
                <div className={`${styles.typeIconBox} ${styles.typeIconDept}`}>
                  <BuildingOffice2Icon className={styles.typeIconSvg} />
                </div>
                <div className={styles.typeInfo}>
                  <div className={styles.typeTitleRow}>
                    <span className={styles.typeTitle}>Department Channel</span>
                    {chatType === 'department' && <CheckCircleIcon className={styles.typeCheckIcon} />}
                  </div>
                  <span className={styles.typeDesc}>Group discussion for a specific department</span>
                </div>
              </button>

              <button
                type="button"
                className={`${styles.typeOption} ${chatType === 'ticket' ? styles.typeOptionActive : ''}`}
                onClick={() => onSetChatType('ticket')}
              >
                <div className={`${styles.typeIconBox} ${styles.typeIconTicket}`}>
                  <TicketIcon className={styles.typeIconSvg} />
                </div>
                <div className={styles.typeInfo}>
                  <div className={styles.typeTitleRow}>
                    <span className={styles.typeTitle}>Ticket Discussion</span>
                    {chatType === 'ticket' && <CheckCircleIcon className={styles.typeCheckIcon} />}
                  </div>
                  <span className={styles.typeDesc}>Dedicated chat room for a support ticket</span>
                </div>
              </button>
            </div>

            {/* Direct Message User Picker */}
            {chatType === 'direct' && (
              <div className={styles.formSection}>
                <div className={styles.fieldHeaderRow}>
                  <label className={styles.fieldLabel}>Select Recipient</label>
                  <div className={styles.modalTabGroup}>
                    <button
                      type="button"
                      className={`${styles.modalTabBtn} ${modalUserTab === 'all' ? styles.modalTabBtnActive : ''}`}
                      onClick={() => onSetModalUserTab('all')}
                    >
                      All Users
                    </button>
                    <button
                      type="button"
                      className={`${styles.modalTabBtn} ${modalUserTab === 'online' ? styles.modalTabBtnActive : ''}`}
                      onClick={() => onSetModalUserTab('online')}
                    >
                      <span className={styles.onlineDotPulse} />
                      Online Only
                    </button>
                  </div>
                </div>

                <div className={styles.userSearchInputWrapper}>
                  <MagnifyingGlassIcon className={styles.searchIconSvg} />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => onSetUserSearchQuery(e.target.value)}
                    placeholder="Search by name, role, email..."
                    className={styles.userSearchInput}
                  />
                  {userSearchQuery && (
                    <button
                      type="button"
                      className={styles.clearSearchBtn}
                      onClick={() => onSetUserSearchQuery('')}
                      aria-label="Clear search"
                    >
                      <XMarkIcon className={styles.clearIconSvg} />
                    </button>
                  )}
                </div>

                {loadingUsers ? (
                  <div className={styles.modalLoadingState}>
                    <div className={styles.spinner} />
                    <p>Loading users roster...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className={styles.modalEmptyState}>
                    <p>No matching users found.</p>
                  </div>
                ) : (
                  <div className={styles.userSelectGrid}>
                    {filteredUsers.map((user) => {
                      const isSelected = selectedUserId === user.id;
                      const roleStyle = getRoleColor(user.role);

                      return (
                        <div
                          key={user.id}
                          className={`${styles.userCard} ${isSelected ? styles.userCardSelected : ''}`}
                          onClick={() => onSelectUserId(user.id)}
                        >
                          <div className={styles.userCardTopRow}>
                            <div className={styles.userAvatarWrapper}>
                              <div
                                className={styles.userAvatar}
                                style={{
                                  background: getAvatarGradient(`${user.first_name} ${user.last_name}`),
                                }}
                              >
                                {user.first_name?.[0] || 'U'}
                              </div>
                              <span
                                className={`${styles.userOnlineIndicator} ${
                                  user.is_online ? styles.userOnline : styles.userOffline
                                }`}
                                title={user.is_online ? 'Online' : 'Offline'}
                              />
                            </div>

                            <div className={styles.userCardDetails}>
                              <div className={styles.userCardNameRow}>
                                <span className={styles.userCardName}>
                                  {user.first_name} {user.last_name}
                                </span>
                                <span className={styles.registeredBadge} title="Verified registered account">
                                  <CheckBadgeIcon className={styles.registeredBadgeIcon} />
                                  <span>Registered</span>
                                </span>
                              </div>
                              <div className={styles.userCardMeta}>
                                <span className={styles.usernameTag}>@{user.username}</span>
                                {user.email && (
                                  <>
                                    <span className={styles.metaDivider}>•</span>
                                    <span className={styles.userEmailText}>{user.email}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className={styles.userCardRoleCol}>
                              <span
                                className={
                                  user.is_online ? styles.directStatusOnline : styles.directStatusOffline
                                }
                              >
                                <span className={user.is_online ? styles.statusDotOnline : styles.statusDotOffline} />
                                {user.is_online ? 'Online' : 'Offline'}
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

                          {/* Quick 1-Click Action Buttons */}
                          <div className={styles.userCardActionsRow}>
                            <button
                              type="button"
                              className={styles.quickActionChatBtn}
                              disabled={creatingRoom}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectUserId(user.id);
                                if (onStartDirectChat) {
                                  onStartDirectChat(user.id, 'chat');
                                }
                              }}
                              title="Immediately accept & open direct text conversation"
                            >
                              <ChatBubbleLeftEllipsisIcon className={styles.actionBtnIcon} />
                              <span>Text Chat</span>
                            </button>
                            <button
                              type="button"
                              className={styles.quickActionVideoBtn}
                              disabled={creatingRoom}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectUserId(user.id);
                                if (onStartDirectChat) {
                                  onStartDirectChat(user.id, 'video');
                                }
                              }}
                              title="Immediately accept, open direct conversation & launch video conference"
                            >
                              <VideoCameraIcon className={styles.actionBtnIcon} />
                              <span>Video Call</span>
                            </button>
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
                  <BuildingOffice2Icon className={styles.selectBoxIcon} />
                  <select
                    value={selectedDepartmentId}
                    onChange={(e) => onSelectDepartmentId(e.target.value)}
                    className={styles.modalSelect}
                  >
                    <option value="">Choose department channel...</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} {dept.code ? `(${dept.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedDepartmentId && (
                  <div className={styles.modalRosterBox}>
                    <div className={styles.modalRosterHeader}>
                      <span className={styles.modalRosterTitle}>
                        <UserGroupIcon className={styles.rosterGroupIcon} />
                        <span>Department Members ({modalMembers.length})</span>
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
                                <span
                                  className={`${styles.memberOnlineIndicator} ${
                                    m.is_online ? styles.online : styles.offline
                                  }`}
                                />
                              </div>
                              <div className={styles.modalRosterInfo}>
                                <span className={styles.modalRosterName}>
                                  {m.first_name} {m.last_name}
                                </span>
                                <span className={styles.modalRosterRole} style={{ color: rStyle.text }}>
                                  {m.role}
                                </span>
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
                <label className={styles.fieldLabel}>Select Ticket</label>
                <div className={styles.selectWrapper}>
                  <TicketIcon className={styles.selectBoxIcon} />
                  <select
                    value={selectedTicketId}
                    onChange={(e) => onSelectTicketId(e.target.value)}
                    className={styles.modalSelect}
                  >
                    <option value="">Choose support ticket...</option>
                    {tickets.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.ticket_number} - {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Custom Room Name */}
            {chatType !== 'direct' && (
              <div className={styles.formSection}>
                <label className={styles.fieldLabel}>Custom Channel Name (Optional)</label>
                <input
                  type="text"
                  value={newChatName}
                  onChange={(e) => onSetNewChatName(e.target.value)}
                  placeholder="e.g. Urgent IT Support Discussion"
                  className={styles.modalTextInput}
                />
              </div>
            )}
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.modalCancelBtn}
              onClick={onClose}
              disabled={creatingRoom}
            >
              <XMarkIcon className={styles.btnIconSvg} />
              <span>Cancel</span>
            </button>
            <button
              type="submit"
              className={styles.modalSubmitBtn}
              disabled={
                creatingRoom ||
                (chatType === 'direct' && !selectedUserId) ||
                (chatType === 'department' && !selectedDepartmentId) ||
                (chatType === 'ticket' && !selectedTicketId)
              }
            >
              {creatingRoom ? (
                <>
                  <div className={styles.btnSpinner} />
                  <span>Connecting...</span>
                </>
              ) : chatType === 'direct' ? (
                <>
                  <ChatBubbleLeftRightIcon className={styles.btnIconSvg} />
                  <span>Start Direct Chat</span>
                </>
              ) : (
                <>
                  <PlusIcon className={styles.btnIconSvg} />
                  <span>Create Conversation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewChatModal;
