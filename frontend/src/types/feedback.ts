export type FeedbackType = 'suggestion' | 'complaint' | 'improvement' | 'bug' | 'other';
export type FeedbackStatus = 'pending' | 'read' | 'resolved' | 'in_progress';

export interface Feedback {
  id: string;
  tenantId: string;
  ticketId?: string | null;
  subject: string;
  message: string;
  rating?: number | null;
  status: FeedbackStatus;
  feedbackType: FeedbackType;
  whatShouldChange?: string | null;
  whatIsCorrect?: string | null;
  whatIsWrong?: string | null;
  howItShouldGo?: string | null;
  adminResponse?: string | null;
  responseAt?: string | null;
  responseBy?: string | null;
  tenantName?: string;
  contactPerson?: string;
  ticketReference?: string | null;
  ticketTitle?: string | null;
  replies?: FeedbackReply[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FeedbackReply {
  id: string;
  feedbackId: string;
  repliedBy: string;
  message: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  createdAt?: string;
}

export interface FeedbackFormValues {
  ticketId?: string;
  subject: string;
  message: string;
  feedbackType: FeedbackType;
  whatShouldChange?: string;
  whatIsCorrect?: string;
  whatIsWrong?: string;
  howItShouldGo?: string;
  rating?: number;
}

export interface ReplyFormValues {
  message: string;
}

export interface AdminFeedbackResponse {
  status: FeedbackStatus;
  adminResponse: string;
}


