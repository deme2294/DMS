import type { ChatRoom, ChatMessage, ChatParticipant, ChatMember, RegisteredContact } from '../../api/chatApi';

export interface OnlineUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_online: boolean;
}

export interface Department {
  id: string;
  name: string;
  code?: string;
}

export interface Ticket {
  id: string;
  title: string;
  ticket_number?: string;
  reference_number?: string;
  category?: string;
  department_id?: string;
  department_name?: string;
  priority?: string;
  status?: string;
}

export interface ParsedMeetingInfo {
  isMeeting: boolean;
  meetingType: 'dms_conference' | 'google_meet' | 'custom';
  title: string;
  meetingUrl: string;
  recipientEmail: string;
  roles?: string;
  screenShareEnabled?: boolean;
  passcode?: string;
  notes?: string;
  scheduledTime?: string;
  formattedScheduledTime?: string;
  durationMinutes?: number;
  createdAt?: string;
}

export const parseEventDate = (dateStr?: string, fallbackCreatedStr?: string): Date | null => {
  if (!dateStr) return null;
  let parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    // Try appending current year if the string lacks year (e.g. "Nov 3, 10:20 AM")
    const currentYear = new Date().getFullYear();
    parsed = new Date(`${dateStr} ${currentYear}`);
  }
  if (isNaN(parsed.getTime())) return null;

  // If year parsed was defaulted far in the past (e.g. 2001) while current system year is 2026:
  const now = new Date();
  if (parsed.getFullYear() < 2020 && now.getFullYear() >= 2024) {
    const fallbackYear = fallbackCreatedStr ? new Date(fallbackCreatedStr).getFullYear() : now.getFullYear();
    const withYear = new Date(parsed);
    withYear.setFullYear(fallbackYear || now.getFullYear());
    return withYear;
  }
  return parsed;
};

export const getEffectiveConferenceUrl = (
  rawUrl?: string
): { isDmsAppRoom: boolean; url: string; roomId?: string } => {
  if (!rawUrl) {
    return { isDmsAppRoom: true, url: window.location.href };
  }
  const match = rawUrl.match(/\/room\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    const roomId = match[1];
    const appUrl = `${window.location.origin}/chat?room=${encodeURIComponent(roomId)}&video=true`;
    return { isDmsAppRoom: true, url: appUrl, roomId };
  }
  return { isDmsAppRoom: false, url: rawUrl };
};

export const formatEventDateDisplay = (isoString?: string): string => {
  if (!isoString) return 'Today (Active Now)';
  const date = parseEventDate(isoString);
  if (!date || isNaN(date.getTime())) return 'Today (Active Now)';

  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = tomorrow.toDateString() === date.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = yesterday.toDateString() === date.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) {
    return `Today at ${timeStr}`;
  }
  if (isTomorrow) {
    return `Tomorrow at ${timeStr}`;
  }
  if (isYesterday) {
    return `Yesterday at ${timeStr}`;
  }
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export type MeetingTimeStatus = 'upcoming' | 'live' | 'ended' | 'immediate';

export interface MeetingEventStatusResult {
  status: MeetingTimeStatus;
  label: string;
  badgeColor: string;
  badgeBg: string;
  canJoinNow: boolean;
  isPast: boolean;
  timePassedStr?: string;
  formattedWindow?: string;
  formattedDateStr?: string;
  startTime?: Date;
  endTime?: Date;
  durationMinutes: number;
}

export const getMeetingEventStatus = (
  scheduledTime?: string,
  durationMinutes = 30,
  isHostOrPeerOnline = false,
  createdAt?: string
): MeetingEventStatusResult => {
  const duration = durationMinutes || 30;

  if (!scheduledTime) {
    return {
      status: 'immediate',
      label: 'Ready to Join',
      badgeColor: '#059669',
      badgeBg: '#ecfdf5',
      canJoinNow: true,
      isPast: false,
      durationMinutes: duration,
    };
  }

  const eventDate = parseEventDate(scheduledTime, createdAt);
  if (!eventDate || isNaN(eventDate.getTime())) {
    return {
      status: 'immediate',
      label: 'Active Session',
      badgeColor: '#059669',
      badgeBg: '#ecfdf5',
      canJoinNow: true,
      isPast: false,
      durationMinutes: duration,
    };
  }

  const now = Date.now();
  const startMs = eventDate.getTime();
  const endMs = startMs + duration * 60 * 1000;
  const earlyJoinWindowMs = 15 * 60 * 1000; // allow joining up to 15 minutes before

  const startDate = new Date(startMs);
  const endDate = new Date(endMs);

  const startFormatted = startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endFormatted = endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const formattedWindow = `${startFormatted} – ${endFormatted}`;
  const formattedDateStr = startDate.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (now < startMs - earlyJoinWindowMs) {
    const diffMs = startMs - now;
    const diffMins = Math.round(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    const timeRemainingStr =
      diffHours > 0
        ? `Starts in ${diffHours}h ${remainingMins}m`
        : `Starts in ${diffMins} min${diffMins > 1 ? 's' : ''}`;
    return {
      status: 'upcoming',
      label: timeRemainingStr,
      badgeColor: '#2563eb',
      badgeBg: '#eff6ff',
      canJoinNow: false,
      isPast: false,
      formattedWindow,
      formattedDateStr,
      startTime: startDate,
      endTime: endDate,
      durationMinutes: duration,
    };
  } else if (now <= endMs) {
    return {
      status: 'live',
      label: '🟢 Live / In Progress',
      badgeColor: '#10b981',
      badgeBg: '#dcfce7',
      canJoinNow: true,
      isPast: false,
      formattedWindow,
      formattedDateStr,
      startTime: startDate,
      endTime: endDate,
      durationMinutes: duration,
    };
  } else {
    // Scheduled time has passed over
    const diffMs = now - endMs;
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let timePassedStr = '';
    if (diffDays > 0) {
      timePassedStr = `Ended ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      const remainingMins = diffMins % 60;
      timePassedStr = remainingMins > 0 ? `Ended ${diffHours}h ${remainingMins}m ago` : `Ended ${diffHours}h ago`;
    } else if (diffMins > 0) {
      timePassedStr = `Ended ${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    } else {
      timePassedStr = 'Just ended';
    }

    return {
      status: 'ended',
      label: `Time Passed Over (${timePassedStr})`,
      badgeColor: '#e11d48',
      badgeBg: '#ffe4e6',
      // Join condition: only if the host or participant is currently online
      canJoinNow: Boolean(isHostOrPeerOnline),
      isPast: true,
      timePassedStr,
      formattedWindow,
      formattedDateStr,
      startTime: startDate,
      endTime: endDate,
      durationMinutes: duration,
    };
  }
};

export interface VideoPeer {
  socketId: string;
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  stream?: MediaStream;
  isMicMuted?: boolean;
  isCameraOff?: boolean;
  isScreenSharing?: boolean;
}

export const parseMeetingMessage = (text: string): ParsedMeetingInfo | null => {
  if (!text) return null;
  const isMeet =
    text.includes('[GOOGLE_MEET_CALL]') ||
    text.includes('[VIDEO_CONFERENCE]') ||
    text.includes('meet.jit.si') ||
    text.includes('meet.google.com') ||
    text.includes('8x8.vc');
  if (!isMeet) return null;

  const urlMatch = text.match(/Link:\s*([^\s\n]+)/i) || text.match(/https?:\/\/[^\s]+/i);
  const meetingUrl = urlMatch ? (urlMatch[1] || urlMatch[0]) : 'https://meet.jit.si/dms-general';

  const titleMatch = text.match(/Title:\s*([^\n]+)/i) || text.match(/Topic:\s*([^\n]+)/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Video Conference Session';

  const recipientMatch = text.match(/Invited:\s*([^\n]+)/i) || text.match(/Recipient:\s*([^\n]+)/i);
  const recipientEmail = recipientMatch ? recipientMatch[1].trim() : '';

  const rolesMatch = text.match(/Roles:\s*([^\n]+)/i);
  const roles = rolesMatch ? rolesMatch[1].trim() : '';

  const screenShareMatch = text.toLowerCase().includes('screen share: enabled') || text.toLowerCase().includes('screen');
  const passcodeMatch = text.match(/Passcode:\s*([^\n]+)/i);
  const passcode = passcodeMatch ? passcodeMatch[1].trim() : '';

  const notesMatch = text.match(/Notes:\s*(.+)/is);
  const notes = notesMatch ? notesMatch[1].trim() : '';

  const eventTimeMatch = text.match(/Event Time:\s*([^\n]+)/i) || text.match(/Scheduled Time:\s*([^\n]+)/i);
  const scheduledTime = eventTimeMatch ? eventTimeMatch[1].trim() : undefined;

  const scheduledForMatch = text.match(/Scheduled For:\s*([^\n]+)/i);
  const formattedScheduledTime = scheduledForMatch
    ? scheduledForMatch[1].trim()
    : scheduledTime
    ? formatEventDateDisplay(scheduledTime)
    : 'Today (Active Now)';

  const durationMatch = text.match(/Duration:\s*(\d+)/i);
  const durationMinutes = durationMatch ? parseInt(durationMatch[1], 10) : 30;

  const createdMatch = text.match(/Created:\s*([^\n]+)/i);
  const createdAt = createdMatch ? createdMatch[1].trim() : undefined;

  const isDms = text.includes('[VIDEO_CONFERENCE]') || meetingUrl.includes('meet.jit.si') || meetingUrl.includes('8x8.vc');

  return {
    isMeeting: true,
    meetingType: isDms ? 'dms_conference' : 'google_meet',
    title,
    meetingUrl,
    recipientEmail,
    roles,
    screenShareEnabled: screenShareMatch,
    passcode,
    notes,
    scheduledTime,
    durationMinutes,
    createdAt,
  };
};

export const getRoleColor = (role?: string) => {
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

export const getAvatarGradient = (str: string) => {
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

export const formatMessageDateGroup = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

export const formatTimeOnly = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const copyToClipboard = async (text: string, successMsg = 'Copied to clipboard!'): Promise<boolean> => {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      alert(successMsg);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API error, falling back to textarea:', err);
  }

  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    if (ok) {
      alert(successMsg);
      return true;
    }
  } catch (err2) {
    console.error('All clipboard operations failed:', err2);
  }
  return false;
};
