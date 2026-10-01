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
  CalendarDaysIcon,
  ClockIcon,
  ComputerDesktopIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import type { ChatMember } from '../../../api/chatApi';
import type { OnlineUser, Department, Ticket } from '../types';
import { getAvatarGradient, getRoleColor } from '../types';
import styles from '../ChatPage.module.css';

export interface NewChatModalProps {
  show: boolean;
  chatType: 'direct' | 'department' | 'ticket' | 'video_conference';
  modalUserTab: 'all' | 'online' | 'admin';
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
  // Video conference specific props
  videoConferenceTarget?: 'user' | 'department' | 'ticket';
  conferenceTitle?: string;
  conferenceScheduleMode?: 'now' | 'scheduled';
  conferenceScheduledTime?: string;
  conferenceDurationMinutes?: number;
  conferenceScreenShare?: boolean;
  conferenceStartAudioMuted?: boolean;
  conferenceStartVideoMuted?: boolean;
  onSetVideoConferenceTarget?: (target: 'user' | 'department' | 'ticket') => void;
  onSetConferenceTitle?: (title: string) => void;
  onSetConferenceScheduleMode?: (mode: 'now' | 'scheduled') => void;
  onSetConferenceScheduledTime?: (time: string) => void;
  onSetConferenceDurationMinutes?: (mins: number) => void;
  onSetConferenceScreenShare?: (val: boolean) => void;
  onSetConferenceStartAudioMuted?: (val: boolean) => void;
  onSetConferenceStartVideoMuted?: (val: boolean) => void;
  onCreateVideoConference?: (e: React.FormEvent) => void;
  onClose: () => void;
  onSetChatType: (type: 'direct' | 'department' | 'ticket' | 'video_conference') => void;
  onSetModalUserTab: (tab: 'all' | 'online' | 'admin') => void;
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
  videoConferenceTarget = 'user',
  conferenceTitle = '',
  conferenceScheduleMode = 'now',
  conferenceScheduledTime = '',
  conferenceDurationMinutes = 30,
  conferenceScreenShare = true,
  conferenceStartAudioMuted = false,
  conferenceStartVideoMuted = false,
  onSetVideoConferenceTarget,
  onSetConferenceTitle,
  onSetConferenceScheduleMode,
  onSetConferenceScheduledTime,
  onSetConferenceDurationMinutes,
  onSetConferenceScreenShare,
  onSetConferenceStartAudioMuted,
  onSetConferenceStartVideoMuted,
  onCreateVideoConference,
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

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const nowIsoLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const getEndTimeLocal = (startIso?: string, durationMins = 30): string => {
    if (!startIso) return '';
    const d = new Date(startIso);
    if (isNaN(d.getTime())) return '';
    const end = new Date(d.getTime() + (durationMins || 30) * 60000);
    return new Date(end.getTime() - end.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  const formatTimeLabel = (isoStr?: string): string => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDateLabel = (isoStr?: string): string => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDurationHuman = (mins = 30): string => {
    if (!mins || mins <= 0) return '0 min';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h} hr${h > 1 ? 's' : ''}`;
    return `${m} mins`;
  };

  const handleEndTimeChange = (newEndIso: string) => {
    if (!conferenceScheduledTime || !newEndIso) return;
    const start = new Date(conferenceScheduledTime).getTime();
    const end = new Date(newEndIso).getTime();
    if (end > start) {
      const diffMins = Math.round((end - start) / 60000);
      if (diffMins > 0) {
        onSetConferenceDurationMinutes?.(diffMins);
      }
    }
  };

  const applyQuickTimeOffset = (minsToAdd: number) => {
    const baseTime = conferenceScheduledTime ? new Date(conferenceScheduledTime).getTime() : Date.now();
    const target = new Date(baseTime + minsToAdd * 60 * 1000);
    const isoLocal = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    onSetConferenceScheduledTime?.(isoLocal);
  };

  const applyTomorrow = () => {
    const d = conferenceScheduledTime ? new Date(conferenceScheduledTime) : new Date();
    d.setDate(d.getDate() + 1);
    const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    onSetConferenceScheduledTime?.(isoLocal);
  };

  const applyNow = () => {
    const d = new Date();
    const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    onSetConferenceScheduledTime?.(isoLocal);
  };

  const endTimeLocal = getEndTimeLocal(conferenceScheduledTime, conferenceDurationMinutes);

  const selectedUserObj = filteredUsers.find((u) => u.id === selectedUserId);
  const selectedTicketObj = tickets.find((t) => t.id === selectedTicketId);

  const ticketRoutedDeptName = React.useMemo(() => {
    if (!selectedTicketObj) return 'IT Support';
    if (selectedTicketObj.department_name) return selectedTicketObj.department_name;
    if (selectedTicketObj.department_id) {
      const match = departments.find((d) => d.id === selectedTicketObj.department_id);
      if (match) return match.name;
    }
    const cat = (selectedTicketObj.category || '').toLowerCase();
    if (
      cat.includes('hr') ||
      cat.includes('human') ||
      cat.includes('payroll') ||
      cat.includes('leave') ||
      cat.includes('benefit') ||
      cat.includes('employee')
    ) {
      const hr = departments.find((d) => d.code === 'HR' || d.name.toLowerCase().includes('human'));
      return hr ? hr.name : 'Human Resources';
    }
    const it = departments.find((d) => d.code === 'IT' || d.name.toLowerCase().includes('it'));
    return it ? it.name : 'IT Support';
  }, [selectedTicketObj, departments]);

  const adminUser = filteredUsers.find((u) => u.role?.toLowerCase() === 'admin');

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <div className={styles.modalIconWrap}>
              {chatType === 'video_conference' ? (
                <VideoCameraIcon className={styles.modalHeaderIcon} style={{ color: '#db2777' }} />
              ) : (
                <ChatBubbleLeftRightIcon className={styles.modalHeaderIcon} />
              )}
            </div>
            <div>
              <h3 className={styles.modalTitle}>
                {chatType === 'video_conference' ? 'Start or Schedule Video Conference' : 'Start New Conversation'}
              </h3>
              <p className={styles.modalSubtitle}>
                {chatType === 'video_conference'
                  ? 'Initiate HD video & screen share call today or on a scheduled date'
                  : 'Connect with a team member, department, or ticket channel'}
              </p>
            </div>
          </div>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose} aria-label="Close">
            <XMarkIcon className={styles.closeIconSvg} />
          </button>
        </div>

        <form onSubmit={chatType === 'video_conference' ? (onCreateVideoConference || onCreateRoom) : onCreateRoom}>
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

              <button
                type="button"
                className={`${styles.typeOption} ${chatType === 'video_conference' ? styles.typeOptionActive : ''}`}
                onClick={() => onSetChatType('video_conference')}
              >
                <div className={`${styles.typeIconBox} ${styles.typeIconVideo}`}>
                  <VideoCameraIcon className={styles.typeIconSvg} />
                </div>
                <div className={styles.typeInfo}>
                  <div className={styles.typeTitleRow}>
                    <span className={styles.typeTitle}>Video Conference</span>
                    {chatType === 'video_conference' && <CheckCircleIcon className={styles.typeCheckIcon} />}
                  </div>
                  <span className={styles.typeDesc}>HD video call today (default) or on scheduled date</span>
                </div>
              </button>
            </div>

            {/* ===================== VIDEO CONFERENCE CREATION TAB ===================== */}
            {chatType === 'video_conference' && (
              <div className={styles.formSection}>
                {/* Conference Title / Topic */}
                <div style={{ marginBottom: '14px' }}>
                  <label className={styles.fieldLabel}>Video Conference Topic / Title</label>
                  <input
                    type="text"
                    value={conferenceTitle}
                    onChange={(e) => onSetConferenceTitle?.(e.target.value)}
                    placeholder="e.g. Help Desk Support & Live Screen Walkthrough"
                    className={styles.modalTextInput}
                  />
                </div>

                {/* Date & Timing Options: Default Today vs Custom Date */}
                <div className={styles.videoFormBanner}>
                  <div className={styles.videoScheduleToggleGroup}>
                    <button
                      type="button"
                      className={`${styles.videoScheduleToggleBtn} ${
                        conferenceScheduleMode === 'now' ? styles.videoScheduleToggleBtnActive : ''
                      }`}
                      onClick={() => onSetConferenceScheduleMode?.('now')}
                    >
                      <ClockIcon style={{ width: '16px', height: '16px' }} />
                      <span>⚡ Start Today (Now - Default)</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.videoScheduleToggleBtn} ${
                        conferenceScheduleMode === 'scheduled' ? styles.videoScheduleToggleBtnActive : ''
                      }`}
                      onClick={() => {
                        onSetConferenceScheduleMode?.('scheduled');
                        if (!conferenceScheduledTime) {
                          const d = new Date(Date.now() + 15 * 60 * 1000);
                          const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                            .toISOString()
                            .slice(0, 16);
                          onSetConferenceScheduledTime?.(isoLocal);
                        }
                      }}
                    >
                      <CalendarDaysIcon style={{ width: '16px', height: '16px' }} />
                      <span>📅 Schedule Custom Date</span>
                    </button>
                  </div>

                  {conferenceScheduleMode === 'now' ? (
                    <div className={styles.videoFormBannerToday}>
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <div className={styles.videoFormBannerTitle}>
                            <span>🗓️</span> Default Session Date: Today ({todayFormatted})
                          </div>
                          <span className={styles.videoTodayBadge}>
                            <span>🟢</span> Live Today
                          </span>
                        </div>
                        <div className={styles.videoFormBannerDesc}>
                          The video conference will launch immediately today with full HD audio, webcam, and screen sharing capabilities.
                        </div>

                        {/* Dynamic Time Needed for Today's session */}
                        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #fbcfe8' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#9d174d' }}>
                              ⏳ Estimated Time Needed for Session:
                            </label>
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#be185d', background: '#fdf2f8', padding: '2px 8px', borderRadius: '10px' }}>
                              {formatDurationHuman(conferenceDurationMinutes)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min={5}
                                max={720}
                                step={5}
                                value={conferenceDurationMinutes}
                                onChange={(e) => {
                                  const val = Math.max(5, Math.min(720, Number(e.target.value) || 5));
                                  onSetConferenceDurationMinutes?.(val);
                                }}
                                className={styles.modalTextInput}
                                style={{ width: '75px', padding: '5px 8px', textAlign: 'center', fontWeight: 700, fontSize: '0.82rem' }}
                              />
                              <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>Minutes</span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginLeft: 'auto' }}>
                              {[15, 30, 45, 60, 90, 120].map((mins) => {
                                const isSelected = conferenceDurationMinutes === mins;
                                return (
                                  <button
                                    key={mins}
                                    type="button"
                                    className={`${styles.videoPresetBtn} ${isSelected ? styles.videoPresetBtnActive : ''}`}
                                    onClick={() => onSetConferenceDurationMinutes?.(mins)}
                                  >
                                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Dynamic Start & End Time Pickers */}
                      <div className={styles.videoScheduleGrid}>
                        <div>
                          <label className={styles.fieldLabel} style={{ marginBottom: '4px', fontSize: '0.76rem' }}>
                            📅 Pick Conference Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            value={conferenceScheduledTime}
                            min={nowIsoLocal}
                            onChange={(e) => onSetConferenceScheduledTime?.(e.target.value)}
                            className={styles.modalTextInput}
                            required={conferenceScheduleMode === 'scheduled'}
                          />
                        </div>

                        <div>
                          <label className={styles.fieldLabel} style={{ marginBottom: '4px', fontSize: '0.76rem' }}>
                            🏁 Estimated End Date & Time (Dynamic)
                          </label>
                          <input
                            type="datetime-local"
                            value={endTimeLocal}
                            min={conferenceScheduledTime || nowIsoLocal}
                            onChange={(e) => handleEndTimeChange(e.target.value)}
                            className={styles.modalTextInput}
                          />
                        </div>
                      </div>

                      {/* Quick Dynamic Date & Time Adjustments */}
                      <div className={styles.videoPresetRow}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Quick Time Adjust:</span>
                        <button
                          type="button"
                          className={styles.videoPresetBtn}
                          onClick={applyNow}
                        >
                          ⚡ Now
                        </button>
                        {[
                          { label: '+15m', mins: 15 },
                          { label: '+30m', mins: 30 },
                          { label: '+1h', mins: 60 },
                          { label: '+2h', mins: 120 },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            className={styles.videoPresetBtn}
                            onClick={() => applyQuickTimeOffset(preset.mins)}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          className={styles.videoPresetBtn}
                          onClick={applyTomorrow}
                        >
                          Tomorrow (+24h)
                        </button>
                      </div>

                      {/* Time Needed (Duration) Box */}
                      <div className={styles.videoTimeNeededBox}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label className={styles.fieldLabel} style={{ margin: 0, fontSize: '0.78rem', color: '#9d174d' }}>
                            ⏳ Time Needed for Event (Duration)
                          </label>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#be185d', background: '#fdf2f8', padding: '2px 8px', borderRadius: '12px', border: '1px solid #fbcfe8' }}>
                            {formatDurationHuman(conferenceDurationMinutes)}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="number"
                              min={5}
                              max={720}
                              step={5}
                              value={conferenceDurationMinutes}
                              onChange={(e) => {
                                const val = Math.max(5, Math.min(720, Number(e.target.value) || 5));
                                onSetConferenceDurationMinutes?.(val);
                              }}
                              className={styles.modalTextInput}
                              style={{ width: '85px', padding: '6px 10px', textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}
                              placeholder="Mins"
                            />
                            <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>Minutes Needed</span>
                          </div>

                          {/* Quick Duration Preset Chips */}
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginLeft: 'auto' }}>
                            {[15, 30, 45, 60, 90, 120, 180].map((mins) => {
                              const isSelected = conferenceDurationMinutes === mins;
                              return (
                                <button
                                  key={mins}
                                  type="button"
                                  className={`${styles.videoPresetBtn} ${isSelected ? styles.videoPresetBtnActive : ''}`}
                                  onClick={() => onSetConferenceDurationMinutes?.(mins)}
                                >
                                  {mins >= 60 ? (mins % 60 === 0 ? `${mins / 60}h` : `${mins / 60}h`) : `${mins}m`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Live Dynamic Event Schedule Summary Card */}
                      {conferenceScheduledTime && (
                        <div className={styles.videoScheduleSummaryCard}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#831843' }}>
                            <span style={{ fontSize: '1.2rem' }}>🗓️</span>
                            <div>
                              <strong style={{ display: 'block', fontSize: '0.8rem' }}>
                                {formatDateLabel(conferenceScheduledTime)}
                              </strong>
                              <span style={{ fontSize: '0.74rem', color: '#701a75' }}>
                                ⏰ {formatTimeLabel(conferenceScheduledTime)} → {formatTimeLabel(endTimeLocal)}
                              </span>
                            </div>
                          </div>
                          <span
                            style={{
                              background: '#ec4899',
                              color: '#ffffff',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                            }}
                          >
                            ⏱️ {formatDurationHuman(conferenceDurationMinutes)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Target Audience Tabs */}
                <div style={{ marginBottom: '10px' }}>
                  <label className={styles.fieldLabel}>Select Audience / Participants</label>
                  <div className={styles.videoTargetTabs}>
                    <button
                      type="button"
                      className={`${styles.videoTargetTabBtn} ${
                        videoConferenceTarget === 'user' ? styles.videoTargetTabBtnActive : ''
                      }`}
                      onClick={() => onSetVideoConferenceTarget?.('user')}
                    >
                      <UserIcon style={{ width: '15px', height: '15px' }} />
                      <span>Registered User</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.videoTargetTabBtn} ${
                        videoConferenceTarget === 'department' ? styles.videoTargetTabBtnActive : ''
                      }`}
                      onClick={() => onSetVideoConferenceTarget?.('department')}
                    >
                      <BuildingOffice2Icon style={{ width: '15px', height: '15px' }} />
                      <span>Department Channel</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.videoTargetTabBtn} ${
                        videoConferenceTarget === 'ticket' ? styles.videoTargetTabBtnActive : ''
                      }`}
                      onClick={() => onSetVideoConferenceTarget?.('ticket')}
                    >
                      <TicketIcon style={{ width: '15px', height: '15px' }} />
                      <span>Support Ticket</span>
                    </button>
                  </div>
                </div>

                {/* Target 1: Registered User Picker */}
                {videoConferenceTarget === 'user' && (
                  <div>
                    {selectedUserObj && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          borderRadius: '8px',
                          marginBottom: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1rem' }}>✅</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#065f46' }}>
                            Selected: {selectedUserObj.first_name} {selectedUserObj.last_name} ({selectedUserObj.role})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectUserId('')}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#047857',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Change
                        </button>
                      </div>
                    )}

                    <div className={styles.userSearchInputWrapper}>
                      <MagnifyingGlassIcon className={styles.searchIconSvg} />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => onSetUserSearchQuery(e.target.value)}
                        placeholder="Search recipient by name, role, email..."
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

                    <div className={styles.userSelectGrid} style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {filteredUsers.map((user) => {
                        const isSelected = selectedUserId === user.id;
                        const roleStyle = getRoleColor(user.role);

                        return (
                          <div
                            key={user.id}
                            className={`${styles.userCard} ${isSelected ? styles.userCardSelected : ''}`}
                            onClick={() => onSelectUserId(user.id)}
                            style={{ cursor: 'pointer' }}
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
                                />
                              </div>

                              <div className={styles.userCardDetails}>
                                <div className={styles.userCardNameRow}>
                                  <span className={styles.userCardName}>
                                    {user.first_name} {user.last_name}
                                  </span>
                                  {isSelected && <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.72rem' }}>✓ Selected</span>}
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
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Target 2: Department Channel */}
                {videoConferenceTarget === 'department' && (
                  <div>
                    <div className={styles.selectWrapper}>
                      <BuildingOffice2Icon className={styles.selectBoxIcon} />
                      <select
                        value={selectedDepartmentId}
                        onChange={(e) => onSelectDepartmentId(e.target.value)}
                        className={styles.modalSelect}
                      >
                        <option value="">Choose department for video conference...</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} {dept.code ? `(${dept.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Target 3: Support Ticket */}
                {videoConferenceTarget === 'ticket' && (
                  <div>
                    <div className={styles.selectWrapper}>
                      <TicketIcon className={styles.selectBoxIcon} />
                      <select
                        value={selectedTicketId}
                        onChange={(e) => onSelectTicketId(e.target.value)}
                        className={styles.modalSelect}
                      >
                        <option value="">Choose support ticket for video conference...</option>
                        {tickets.map((t) => (
                          <option key={t.id} value={t.id}>
                            #{t.ticket_number} - {t.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Conference Audio / Video Option Toggles */}
                <div style={{ marginTop: '14px' }}>
                  <label className={styles.fieldLabel}>Call Options & Defaults</label>
                  <div className={styles.videoOptionsGrid}>
                    <label className={styles.videoOptionToggle}>
                      <input
                        type="checkbox"
                        checked={conferenceScreenShare}
                        onChange={(e) => onSetConferenceScreenShare?.(e.target.checked)}
                      />
                      <span>🖥️ Screen Share</span>
                    </label>

                    <label className={styles.videoOptionToggle}>
                      <input
                        type="checkbox"
                        checked={conferenceStartAudioMuted}
                        onChange={(e) => onSetConferenceStartAudioMuted?.(e.target.checked)}
                      />
                      <span>🔇 Mute on Entry</span>
                    </label>

                    <label className={styles.videoOptionToggle}>
                      <input
                        type="checkbox"
                        checked={conferenceStartVideoMuted}
                        onChange={(e) => onSetConferenceStartVideoMuted?.(e.target.checked)}
                      />
                      <span>🚫 Camera Off</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Direct Message User Picker */}
            {chatType === 'direct' && (
              <div className={styles.formSection}>
                {/* 1-Click Fast Connect with System Admin Card */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 260px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                        flexShrink: 0,
                      }}
                    >
                      <ShieldCheckIcon style={{ width: '24px', height: '24px', color: '#ffffff' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
                          Direct Chat with System Admin
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: '#ecfdf5',
                            color: '#065f46',
                            border: '1px solid #a7f3d0',
                            fontWeight: 700,
                          }}
                        >
                          ⚡ Auto-Accepted
                        </span>
                      </div>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
                        Start a direct conversation with registered system administrators instantly without waiting for pending approval.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      className={styles.quickActionChatBtn}
                      disabled={creatingRoom}
                      onClick={() => {
                        const targetId = adminUser ? adminUser.id : 'admin';
                        onSelectUserId(targetId);
                        if (onStartDirectChat) {
                          onStartDirectChat(targetId, 'chat');
                        }
                      }}
                      style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                      title="Direct text chat with Admin (Auto-Accepted)"
                    >
                      <ChatBubbleLeftEllipsisIcon className={styles.actionBtnIcon} />
                      <span>Text Chat</span>
                    </button>
                    <button
                      type="button"
                      className={styles.quickActionVideoBtn}
                      disabled={creatingRoom}
                      onClick={() => {
                        const targetId = adminUser ? adminUser.id : 'admin';
                        onSelectUserId(targetId);
                        if (onStartDirectChat) {
                          onStartDirectChat(targetId, 'video');
                        }
                      }}
                      style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                      title="Direct video conference with Admin (Auto-Accepted)"
                    >
                      <VideoCameraIcon className={styles.actionBtnIcon} />
                      <span>Video Call</span>
                    </button>
                  </div>
                </div>

                <div className={styles.fieldHeaderRow}>
                  <label className={styles.fieldLabel}>Select Recipient from Registered Users</label>
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
                      className={`${styles.modalTabBtn} ${modalUserTab === 'admin' ? styles.modalTabBtnActive : ''}`}
                      onClick={() => onSetModalUserTab('admin')}
                    >
                      🛡️ Admin
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
                                {user.role?.toLowerCase() === 'admin' ? (
                                  <span
                                    className={styles.registeredBadge}
                                    style={{ background: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe' }}
                                    title="System Admin - Direct Access Auto-Accepted"
                                  >
                                    <ShieldCheckIcon style={{ width: '13px', height: '13px', color: '#4f46e5' }} />
                                    <span>System Admin</span>
                                  </span>
                                ) : (
                                  <span className={styles.registeredBadge} title="Verified registered account">
                                    <CheckBadgeIcon className={styles.registeredBadgeIcon} />
                                    <span>Registered</span>
                                  </span>
                                )}
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
                        #{t.ticket_number || t.reference_number || t.id.substring(0, 8)} - {t.title}
                        {t.category ? ` (Category: ${t.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Live Department Routing Information Card */}
                {selectedTicketObj && (
                  <div
                    style={{
                      marginTop: '14px',
                      background: 'var(--bg-subtle, #f8fafc)',
                      border: '1px solid var(--border-light, #e2e8f0)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🏷️</span> Automatic Department Routing
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: '#ecfdf5',
                          color: '#065f46',
                          border: '1px solid #a7f3d0',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
                        Auto-Routing Active
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                      <div style={{ background: 'var(--bg-card, #ffffff)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle, #cbd5e1)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>Ticket Category</div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#2563eb', marginTop: '2px' }}>
                          {selectedTicketObj.category || 'General Support'}
                        </div>
                      </div>

                      <div style={{ background: 'var(--bg-card, #ffffff)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle, #cbd5e1)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>Routed Department</div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                          🏢 {ticketRoutedDeptName}
                        </div>
                      </div>

                      <div style={{ background: 'var(--bg-card, #ffffff)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle, #cbd5e1)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>Timing Selected</div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#d97706', marginTop: '2px' }}>
                          ⚡ Start Now (Default)
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #475569)', lineHeight: 1.45, background: 'rgba(255, 255, 255, 0.7)', padding: '8px 10px', borderRadius: '6px' }}>
                      ✅ As this ticket chat is started now, it will be automatically routed to the <strong>{ticketRoutedDeptName}</strong> department based on the category (<strong>{selectedTicketObj.category || 'General'}</strong>). All active department staff and managers are automatically connected to provide immediate assistance.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Custom Room Name */}
            {chatType !== 'direct' && chatType !== 'video_conference' && (
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
              style={
                chatType === 'video_conference'
                  ? {
                      background: 'linear-gradient(135deg, #db2777 0%, #7c3aed 100%)',
                      borderColor: '#db2777',
                    }
                  : {}
              }
              disabled={
                creatingRoom ||
                (chatType === 'direct' && !selectedUserId) ||
                (chatType === 'department' && !selectedDepartmentId) ||
                (chatType === 'ticket' && !selectedTicketId) ||
                (chatType === 'video_conference' &&
                  ((videoConferenceTarget === 'user' && !selectedUserId) ||
                    (videoConferenceTarget === 'department' && !selectedDepartmentId) ||
                    (videoConferenceTarget === 'ticket' && !selectedTicketId)))
              }
            >
              {creatingRoom ? (
                <>
                  <div className={styles.btnSpinner} />
                  <span>Connecting...</span>
                </>
              ) : chatType === 'video_conference' ? (
                <>
                  <VideoCameraIcon className={styles.btnIconSvg} />
                  <span>
                    {conferenceScheduleMode === 'now'
                      ? '🚀 Start Video Conference (Today)'
                      : '🗓️ Schedule Video Conference'}
                  </span>
                </>
              ) : chatType === 'ticket' ? (
                <>
                  <TicketIcon className={styles.btnIconSvg} />
                  <span>Route & Start Ticket Chat Now</span>
                </>
              ) : chatType === 'department' ? (
                <>
                  <BuildingOffice2Icon className={styles.btnIconSvg} />
                  <span>Open Department Channel</span>
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
