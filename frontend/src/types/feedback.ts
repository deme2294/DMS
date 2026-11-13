export type FeedbackType = 'suggestion' | 'complaint' | 'improvement' | 'bug' | 'other' | 'office_inquiry' | 'general';
export type FeedbackStatus = 'pending' | 'assigned_to_dept' | 'assigned_to_staff' | 'in_progress' | 'read' | 'resolved' | 'closed';

export interface Feedback {
  id: string;
  feedbackNum?: number | null;
  tenantId: string;
  ticketId?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  serviceName?: string | null;
  departmentId?: string | null;
  resolvedDepartmentId?: string | null;
  routingType?: 'general' | 'direct';
  departmentName?: string | null;
  departmentHeadId?: string | null;
  departmentHeadName?: string | null;
  departmentHeadEmail?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  assignmentScope?: 'department_only' | 'department_general' | 'specific_staff' | 'direct_user' | null;
  assignedUserIds?: string[];
  adminDirective?: string | null;
  departmentNotes?: string | null;
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
  articleId?: string | null;
  articleTitle?: string | null;
  articleReference?: string | null;
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
  articleId?: string;
  categoryId?: string;
  serviceName?: string;
  departmentId?: string;
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

export interface AssignDepartmentPayload {
  targetType?: 'department' | 'user';
  departmentId?: string;
  departmentHeadId?: string;
  assignedToUserId?: string;
  adminDirective?: string;
  whatIsCorrect?: string;
  whatShouldChange?: string;
}

export interface AssignStaffPayload {
  assignmentScope?: 'department_general' | 'specific_staff';
  assignedToUserId?: string;
  assignedUserIds?: string[];
  departmentNotes?: string;
  whatIsCorrect?: string;
  whatShouldChange?: string;
}

export type FeedbackAiDetectionType = 'keep_it_up' | 'needs_change' | 'mixed';

export interface FeedbackAiQuickOption {
  id: string;
  label: string;
  tone: string;
  text: string;
}

export interface FeedbackAiResponseResult {
  detectedType: FeedbackAiDetectionType;
  detectedLabel: string;
  feedbackTypeUsed?: string;
  previousFeedbackCount?: number;
  historySummary?: string;
  keepUpHighlights: string[];
  changeHighlights: string[];
  recommendedResponse: string;
  quickResponses: FeedbackAiQuickOption[];
  source: string;
}
