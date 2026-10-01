import React from 'react';
import type { RegisteredContact } from '../../../api/chatApi';
import { getAvatarGradient, getRoleColor } from '../types';
import styles from '../ChatPage.module.css';

interface MeetingInviteModalProps {
  show: boolean;
  meetTitle: string;
  meetNotes: string;
  meetUrl: string;
  meetingPlatform: 'dms_conference' | 'google_meet' | 'custom';
  meetingScreenShare: boolean;
  meetingStartAudioMuted: boolean;
  meetingStartVideoMuted: boolean;
  meetingRequireRegisteredOnly: boolean;
  meetingPasscode: string;
  meetingScheduleMode: 'now' | 'scheduled';
  meetingScheduledTime: string;
  meetingDurationMinutes: number;
  sendingMeetInvite: boolean;
  meetSuccessMsg: string;
  loadingContacts: boolean;
  contactSearchQuery: string;
  selectedRoleFilter: string;
  selectedRecipientEmails: string[];
  registeredContacts: RegisteredContact[];
  availableRoles: string[];
  filteredRegisteredContacts: RegisteredContact[];
  onClose: () => void;
  onSetMeetTitle: (title: string) => void;
  onSetMeetNotes: (notes: string) => void;
  onSetMeetUrl: (url: string) => void;
  onSetMeetingPlatform: (platform: 'dms_conference' | 'google_meet' | 'custom') => void;
  onSetMeetingScreenShare: (val: boolean) => void;
  onSetMeetingStartAudioMuted: (val: boolean) => void;
  onSetMeetingStartVideoMuted: (val: boolean) => void;
  onSetMeetingRequireRegisteredOnly: (val: boolean) => void;
  onSetMeetingPasscode: (code: string) => void;
  onSetMeetingScheduleMode: (mode: 'now' | 'scheduled') => void;
  onSetMeetingScheduledTime: (time: string) => void;
  onSetMeetingDurationMinutes: (minutes: number) => void;
  onSetContactSearchQuery: (q: string) => void;
  onSetSelectedRoleFilter: (role: string) => void;
  onToggleRecipientSelection: (email: string) => void;
  onSelectAllInRole: (role: string) => void;
  onClearSelection: () => void;
  onSendMeetInvite: (e: React.FormEvent) => void;
  onStartInAppVideo: () => void;
}

export const MeetingInviteModal: React.FC<MeetingInviteModalProps> = ({
  show,
  meetTitle,
  meetNotes,
  meetUrl,
  meetingPlatform,
  meetingScreenShare,
  meetingStartAudioMuted,
  meetingStartVideoMuted,
  meetingRequireRegisteredOnly,
  meetingPasscode,
  meetingScheduleMode,
  meetingScheduledTime,
  meetingDurationMinutes,
  sendingMeetInvite,
  meetSuccessMsg,
  loadingContacts,
  contactSearchQuery,
  selectedRoleFilter,
  selectedRecipientEmails,
  registeredContacts,
  availableRoles,
  filteredRegisteredContacts,
  onClose,
  onSetMeetTitle,
  onSetMeetNotes,
  onSetMeetUrl,
  onSetMeetingPlatform,
  onSetMeetingScreenShare,
  onSetMeetingStartAudioMuted,
  onSetMeetingStartVideoMuted,
  onSetMeetingRequireRegisteredOnly,
  onSetMeetingPasscode,
  onSetMeetingScheduleMode,
  onSetMeetingScheduledTime,
  onSetMeetingDurationMinutes,
  onSetContactSearchQuery,
  onSetSelectedRoleFilter,
  onToggleRecipientSelection,
  onSelectAllInRole,
  onClearSelection,
  onSendMeetInvite,
  onStartInAppVideo,
}) => {
  if (!show) return null;

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
    if (!meetingScheduledTime || !newEndIso) return;
    const start = new Date(meetingScheduledTime).getTime();
    const end = new Date(newEndIso).getTime();
    if (end > start) {
      const diffMins = Math.round((end - start) / 60000);
      if (diffMins > 0) {
        onSetMeetingDurationMinutes(diffMins);
      }
    }
  };

  const applyQuickTimeOffset = (minsToAdd: number) => {
    const baseTime = meetingScheduledTime ? new Date(meetingScheduledTime).getTime() : Date.now();
    const target = new Date(baseTime + minsToAdd * 60 * 1000);
    const isoLocal = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    onSetMeetingScheduledTime(isoLocal);
  };

  const applyTomorrow = () => {
    const d = meetingScheduledTime ? new Date(meetingScheduledTime) : new Date();
    d.setDate(d.getDate() + 1);
    const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    onSetMeetingScheduledTime(isoLocal);
  };

  const applyNow = () => {
    const d = new Date();
    const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    onSetMeetingScheduledTime(isoLocal);
  };

  const endTimeLocal = getEndTimeLocal(meetingScheduledTime, meetingDurationMinutes);

  return (
    <div className={styles.inviteDrawerBackdrop} onClick={onClose}>
      <div
        className={styles.inviteDrawerContent}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <span className={styles.modalIcon}>📹</span>
            <div>
              <h3 style={{ margin: 0 }}>Invite to Video & Screen Share</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Select registered users or user roles to dispatch video conference invitations
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            disabled={sendingMeetInvite}
          >
            ✕
          </button>
        </div>

        {meetSuccessMsg && (
          <div
            style={{
              padding: '12px 20px',
              background: '#ecfdf5',
              borderBottom: '1px solid #a7f3d0',
              color: '#047857',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {meetSuccessMsg}
          </div>
        )}

        <form onSubmit={onSendMeetInvite} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className={styles.modalBody} style={{ flex: 1, overflowY: 'auto' }}>
            {/* Conference Title */}
            <div className={styles.formSection} style={{ marginBottom: '12px' }}>
              <label className={styles.fieldLabel}>Meeting Topic / Title</label>
              <input
                type="text"
                value={meetTitle}
                onChange={(e) => onSetMeetTitle(e.target.value)}
                placeholder="e.g. Help Desk Ticket Review & Screen Walkthrough"
                className={styles.modalTextInput}
                required
              />
            </div>

            {/* Platform Selection */}
            <div className={styles.formSection} style={{ marginBottom: '14px' }}>
              <label className={styles.fieldLabel}>Conference Engine</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => onSetMeetingPlatform('dms_conference')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border:
                      meetingPlatform === 'dms_conference'
                        ? '2px solid #00897b'
                        : '1px solid #cbd5e1',
                    background: meetingPlatform === 'dms_conference' ? '#e6f4ea' : '#ffffff',
                    color: meetingPlatform === 'dms_conference' ? '#00796b' : '#334155',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  🛡️ In-App WebRTC
                  <div style={{ fontSize: '0.7rem', fontWeight: 400, color: '#64748b' }}>
                    Zero external tabs
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onSetMeetingPlatform('google_meet')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border:
                      meetingPlatform === 'google_meet' ? '2px solid #1a73e8' : '1px solid #cbd5e1',
                    background: meetingPlatform === 'google_meet' ? '#e8f0fe' : '#ffffff',
                    color: meetingPlatform === 'google_meet' ? '#1a73e8' : '#334155',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  🎥 Google Meet
                  <div style={{ fontSize: '0.7rem', fontWeight: 400, color: '#64748b' }}>
                    Workspace Link
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onSetMeetingPlatform('custom')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border: meetingPlatform === 'custom' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                    background: meetingPlatform === 'custom' ? '#f5f3ff' : '#ffffff',
                    color: meetingPlatform === 'custom' ? '#7c3aed' : '#334155',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  🌐 Custom Link
                  <div style={{ fontSize: '0.7rem', fontWeight: 400, color: '#64748b' }}>
                    External Room
                  </div>
                </button>
              </div>
            </div>

            {/* Event Scheduling & Timing Options */}
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🗓️</span> Event Scheduling & Timing
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => onSetMeetingScheduleMode('now')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border:
                        meetingScheduleMode === 'now' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                      background: meetingScheduleMode === 'now' ? '#dcfce7' : '#ffffff',
                      color: meetingScheduleMode === 'now' ? '#15803d' : '#64748b',
                    }}
                  >
                    ⚡ Start Today (Now - Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSetMeetingScheduleMode('scheduled');
                      if (!meetingScheduledTime) {
                        const d = new Date(Date.now() + 15 * 60 * 1000);
                        const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                          .toISOString()
                          .slice(0, 16);
                        onSetMeetingScheduledTime(isoLocal);
                      }
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border:
                        meetingScheduleMode === 'scheduled'
                          ? '2px solid #2563eb'
                          : '1px solid #cbd5e1',
                      background: meetingScheduleMode === 'scheduled' ? '#eff6ff' : '#ffffff',
                      color: meetingScheduleMode === 'scheduled' ? '#1d4ed8' : '#64748b',
                    }}
                  >
                    📅 Schedule Event Time
                  </button>
                </div>
              </div>

              {meetingScheduleMode === 'now' && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: '#dcfce7',
                    border: '1px solid #86efac',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem',
                    color: '#15803d',
                    fontWeight: 600,
                  }}
                >
                  <span>
                    🗓️ Session Date: <strong>Today ({new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })})</strong> (Immediate Launch)
                  </span>
                  <span
                    style={{
                      background: '#16a34a',
                      color: '#ffffff',
                      borderRadius: '12px',
                      padding: '2px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    Default Today
                  </span>
                </div>
              )}

              {meetingScheduleMode === 'scheduled' ? (
                <div>
                  <div className={styles.videoScheduleGrid}>
                    <div>
                      <label
                        style={{
                          fontSize: '0.75rem',
                          color: '#334155',
                          fontWeight: 600,
                          display: 'block',
                          marginBottom: '4px',
                        }}
                      >
                        📅 Event Start Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={meetingScheduledTime}
                        min={nowIsoLocal}
                        onChange={(e) => onSetMeetingScheduledTime(e.target.value)}
                        className={styles.modalTextInput}
                        style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                        required={meetingScheduleMode === 'scheduled'}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: '0.75rem',
                          color: '#334155',
                          fontWeight: 600,
                          display: 'block',
                          marginBottom: '4px',
                        }}
                      >
                        🏁 Estimated End Date & Time (Dynamic)
                      </label>
                      <input
                        type="datetime-local"
                        value={endTimeLocal}
                        min={meetingScheduledTime || nowIsoLocal}
                        onChange={(e) => handleEndTimeChange(e.target.value)}
                        className={styles.modalTextInput}
                        style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                      />
                    </div>
                  </div>

                  {/* Quick Dynamic Time Adjust Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                      marginBottom: '8px',
                    }}
                  >
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
                  <div className={styles.videoTimeNeededBox} style={{ margin: '8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#166534' }}>
                        ⏳ Time Needed for Event (Duration):
                      </label>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '10px' }}>
                        {formatDurationHuman(meetingDurationMinutes)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          min={5}
                          max={720}
                          step={5}
                          value={meetingDurationMinutes}
                          onChange={(e) => {
                            const val = Math.max(5, Math.min(720, Number(e.target.value) || 5));
                            onSetMeetingDurationMinutes(val);
                          }}
                          className={styles.modalTextInput}
                          style={{ width: '80px', padding: '5px 8px', textAlign: 'center', fontWeight: 700, fontSize: '0.82rem' }}
                        />
                        <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>Minutes Needed</span>
                      </div>

                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginLeft: 'auto' }}>
                        {[15, 30, 45, 60, 90, 120, 180].map((mins) => {
                          const isSelected = meetingDurationMinutes === mins;
                          return (
                            <button
                              key={mins}
                              type="button"
                              className={`${styles.videoPresetBtn} ${isSelected ? styles.videoPresetBtnActive : ''}`}
                              onClick={() => onSetMeetingDurationMinutes(mins)}
                              style={
                                isSelected
                                  ? { background: '#dcfce7', borderColor: '#16a34a', color: '#15803d', fontWeight: 700 }
                                  : {}
                              }
                            >
                              {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Event Schedule Preview Card */}
                  {meetingScheduledTime && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: '#f0fdf4',
                        border: '1px solid #86efac',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534' }}>
                        <span style={{ fontSize: '1.1rem' }}>🗓️</span>
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.8rem' }}>
                            {formatDateLabel(meetingScheduledTime)}
                          </strong>
                          <span style={{ fontSize: '0.74rem', color: '#15803d' }}>
                            ⏰ {formatTimeLabel(meetingScheduledTime)} → {formatTimeLabel(endTimeLocal)}
                          </span>
                        </div>
                      </div>
                      <span
                        style={{
                          background: '#16a34a',
                          color: '#ffffff',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                        }}
                      >
                        ⏱️ {formatDurationHuman(meetingDurationMinutes)}
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: '0.74rem',
                      color: '#047857',
                      background: '#dcfce7',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      marginTop: '6px',
                    }}
                  >
                    🔔 <strong>Notification & Email Delivery:</strong> Registered users will receive the event schedule at their registered email and in their web application notifications. Users can join directly from the chat page based on the created time.
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                  ⚡ Immediate call mode. An instant invite with join button will be dispatched right away to recipients' registered email and web app notification center.
                </div>
              )}
            </div>

            {/* Customization Options */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '14px',
              }}
            >
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>⚙️</span> Conference Controls & Permissions
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '10px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    color: '#1e293b',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={meetingScreenShare}
                    onChange={(e) => onSetMeetingScreenShare(e.target.checked)}
                  />
                  <span>🖥️ Allow Screen Sharing</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    color: '#1e293b',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={meetingStartAudioMuted}
                    onChange={(e) => onSetMeetingStartAudioMuted(e.target.checked)}
                  />
                  <span>🎙️ Start Audio Muted</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    color: '#1e293b',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={meetingStartVideoMuted}
                    onChange={(e) => onSetMeetingStartVideoMuted(e.target.checked)}
                  />
                  <span>📹 Start Camera Off</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    color: '#1e293b',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={meetingRequireRegisteredOnly}
                    onChange={(e) => onSetMeetingRequireRegisteredOnly(e.target.checked)}
                  />
                  <span>🔒 Registered Users Only</span>
                </label>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Optional Passcode:</span>
                <input
                  type="text"
                  value={meetingPasscode}
                  onChange={(e) => onSetMeetingPasscode(e.target.value)}
                  placeholder="e.g. 4829"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    width: '120px',
                  }}
                />
              </div>
            </div>

            {/* Role-Based Registered User Selection */}
            <div className={styles.formSection} style={{ marginBottom: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <label className={styles.fieldLabel} style={{ margin: 0 }}>
                  Invite Registered Users ({selectedRecipientEmails.length} Selected)
                </label>
                <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600 }}>
                  🔒 Verified System Accounts
                </span>
              </div>

              {/* Role Tabs */}
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  overflowX: 'auto',
                  paddingBottom: '6px',
                  marginBottom: '8px',
                }}
              >
                <button
                  type="button"
                  onClick={() => onSetSelectedRoleFilter('all')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border:
                      selectedRoleFilter === 'all' ? '1px solid #1a73e8' : '1px solid #e2e8f0',
                    background: selectedRoleFilter === 'all' ? '#e8f0fe' : '#ffffff',
                    color: selectedRoleFilter === 'all' ? '#1a73e8' : '#64748b',
                    whiteSpace: 'nowrap',
                  }}
                >
                  All Roles ({registeredContacts.length})
                </button>
                {availableRoles.map((role) => {
                  const count = registeredContacts.filter(
                    (c) => c.role?.toLowerCase() === role.toLowerCase()
                  ).length;
                  const isActive = selectedRoleFilter.toLowerCase() === role.toLowerCase();
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => onSetSelectedRoleFilter(role)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: isActive ? '1px solid #1a73e8' : '1px solid #e2e8f0',
                        background: isActive ? '#e8f0fe' : '#ffffff',
                        color: isActive ? '#1a73e8' : '#64748b',
                        textTransform: 'capitalize',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {role} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Action Bar: Quick Select Role & Search */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => onSelectAllInRole(selectedRoleFilter)}
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#f1f5f9',
                      color: '#334155',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {selectedRoleFilter === 'all'
                      ? 'Toggle All Visible Users'
                      : `Toggle All in ${selectedRoleFilter.toUpperCase()}`}
                  </button>
                  {selectedRecipientEmails.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearSelection}
                      style={{
                        fontSize: '0.75rem',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#dc2626',
                        cursor: 'pointer',
                      }}
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={contactSearchQuery}
                  onChange={(e) => onSetContactSearchQuery(e.target.value)}
                  placeholder="Filter by name, email, or role..."
                  style={{
                    fontSize: '0.78rem',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    width: '210px',
                  }}
                />
              </div>

              {/* Registered Users Roster */}
              <div
                style={{
                  maxHeight: '170px',
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  padding: '4px',
                }}
              >
                {loadingContacts ? (
                  <div
                    style={{
                      padding: '16px',
                      textAlign: 'center',
                      fontSize: '0.82rem',
                      color: '#64748b',
                    }}
                  >
                    Loading registered system users...
                  </div>
                ) : filteredRegisteredContacts.length === 0 ? (
                  <div
                    style={{
                      padding: '16px',
                      textAlign: 'center',
                      fontSize: '0.82rem',
                      color: '#64748b',
                    }}
                  >
                    No registered users found matching filter.
                  </div>
                ) : (
                  filteredRegisteredContacts.map((contact) => {
                    const isChecked = selectedRecipientEmails.includes(contact.email.toLowerCase());
                    const rStyle = getRoleColor(contact.role);
                    return (
                      <div
                        key={contact.id}
                        onClick={() => onToggleRecipientSelection(contact.email)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: isChecked ? '#e0f2fe' : '#ffffff',
                          border: isChecked ? '1px solid #38bdf8' : '1px solid #f1f5f9',
                          marginBottom: '3px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                          <div
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: getAvatarGradient(
                                `${contact.first_name} ${contact.last_name}`
                              ),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              color: '#ffffff',
                              fontWeight: 700,
                            }}
                          >
                            {contact.first_name?.[0] || 'U'}
                          </div>
                          <div>
                            <div
                              style={{ fontSize: '0.84rem', fontWeight: 600, color: '#1e293b' }}
                            >
                              {contact.first_name} {contact.last_name}
                              {contact.is_online ? (
                                <span
                                  style={{
                                    marginLeft: '6px',
                                    fontSize: '0.68rem',
                                    color: '#10b981',
                                    fontWeight: 700,
                                  }}
                                >
                                  ● Online
                                </span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                              {contact.email}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            background: rStyle.bg,
                            color: rStyle.text,
                            border: `1px solid ${rStyle.border}`,
                            textTransform: 'capitalize',
                          }}
                        >
                          {contact.role}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Additional Notes */}
            <div className={styles.formSection}>
              <label className={styles.fieldLabel}>Agenda Notes & Instructions (Optional)</label>
              <textarea
                value={meetNotes}
                onChange={(e) => onSetMeetNotes(e.target.value)}
                placeholder="e.g. Please join this in-app call to review the ticket and share screen."
                className={styles.modalTextInput}
                rows={2}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.modalCancelBtn}
              onClick={onClose}
              disabled={sendingMeetInvite}
            >
              Cancel
            </button>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={onStartInAppVideo}
                style={{
                  background: 'linear-gradient(135deg, #00897b 0%, #1a73e8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
                title="Launch in-app video room immediately"
              >
                📹 Start In-App Video
              </button>

              <button
                type="submit"
                className={styles.modalSubmitBtn}
                disabled={sendingMeetInvite || selectedRecipientEmails.length === 0}
                style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}
              >
                {sendingMeetInvite
                  ? 'Dispatching Invites...'
                  : meetingScheduleMode === 'scheduled'
                  ? `🚀 Schedule Event & Dispatch Invites (${selectedRecipientEmails.length} User${
                      selectedRecipientEmails.length > 1 ? 's' : ''
                    })`
                  : `🚀 Dispatch Invites (${selectedRecipientEmails.length} User${
                      selectedRecipientEmails.length > 1 ? 's' : ''
                    })`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MeetingInviteModal;
