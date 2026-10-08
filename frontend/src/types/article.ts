export type ArticleStatus =
  | 'draft'
  | 'pending_approval'
  | 'in_review'
  | 'needs_revision'
  | 'approved'
  | 'published'
  | 'unpublished'
  | 'rejected'
  | 'archived'
  | 'restored';

export type ArticleVisibility = 'tenant' | 'internal' | 'department' | 'restricted' | 'public';

export interface ArticleListParams {
  search?: string;
  status?: string;
  category?: string;
  authorId?: string;
  page?: number;
  limit?: number;
}

export interface Article {
  id: string;
  articleReference: string;
  title: string;
  slug: string;
  summary?: string | null;
  content: string;
  category: string;
  tags?: string | null;
  visibility: ArticleVisibility;
  version: string;
  status: ArticleStatus;
  authorId: string;
  departmentId?: string | null;
  submittedBy?: string | null;
  reviewedBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  unpublishedBy?: string | null;
  unpublishReason?: string | null;
  unpublishedAt?: string | null;
  archivedBy?: string | null;
  archivedAt?: string | null;
  updatedBy?: string | null;
  rejectionReason?: string | null;
  revisionNotes?: string | null;
  publishedAt?: string | null;
  deletedAt?: string | null;
  viewCount?: number;
  tenantViewCount?: number;
  staffViewCount?: number;
  helpfulCount?: number;
  notHelpfulCount?: number;
  userFeedback?: 'helpful' | 'not_helpful' | null;
  hasVoted?: boolean;
  feedbackStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  authorFirstName?: string | null;
  authorLastName?: string | null;
  authorEmail?: string | null;
  submittedFirstName?: string | null;
  submittedLastName?: string | null;
  reviewedFirstName?: string | null;
  reviewedLastName?: string | null;
  approvedFirstName?: string | null;
  approvedLastName?: string | null;
  publishedFirstName?: string | null;
  publishedLastName?: string | null;
  rejectedFirstName?: string | null;
  rejectedLastName?: string | null;
  unpublishedFirstName?: string | null;
  unpublishedLastName?: string | null;
  archivedFirstName?: string | null;
  archivedLastName?: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
  authorRole?: string | null;
  feedbackEntries?: ArticleFeedbackEntry[];
}

export interface ArticleFeedbackEntry {
  id: string;
  articleId: string;
  userId: string;
  isHelpful: boolean | number;
  reason?: string | null;
  comment?: string | null;
  createdAt?: string;
  updatedAt?: string;
  userFirstName?: string | null;
  userLastName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
}

export interface ArticleFormValues {
  title: string;
  summary?: string;
  content: string;
  category: string;
  tags?: string;
  visibility?: ArticleVisibility;
  departmentId?: string | null;
}

export interface ArticleStats {
  draft: number;
  pending_approval: number;
  needs_revision: number;
  approved: number;
  published: number;
  unpublished: number;
  rejected: number;
  archived: number;
  restored: number;
  total: number;
  totalViews?: number;
  tenantViews?: number;
  staffViews?: number;
  helpfulYes: number;
  notHelpfulNo: number;
  byDepartment: { name: string; count: number }[];
  ratedArticles?: Article[];
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  isActive: boolean;
  isVirtual?: boolean;
  parentId?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeAttachment {
  id: string;
  articleId?: string;
  article_id?: string;
  fileName?: string;
  file_name?: string;
  filePath?: string;
  file_path?: string;
  fileSize?: number | null;
  file_size?: number | null;
  mimeType?: string | null;
  mime_type?: string | null;
  fileExtension?: string | null;
  file_extension?: string | null;
  uploadedBy?: string;
  uploaded_by?: string;
  createdAt?: string;
  created_at?: string;
  uploaderFirstName?: string | null;
  uploaderLastName?: string | null;
}

export interface ArticleVersion {
  id: string;
  articleId: string;
  versionNumber: string;
  title: string;
  content: string;
  summary?: string | null;
  category?: string | null;
  categoryId?: string | null;
  tags?: string | null;
  visibility?: ArticleVisibility | string | null;
  changeSummary?: string | null;
  createdBy: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  creatorFirstName?: string | null;
  creatorLastName?: string | null;
  approverFirstName?: string | null;
  approverLastName?: string | null;
}

export interface RevisionThreadItem {
  id: string;
  step: 'admin_revision' | 'manager_revision' | 'author_resubmit' | 'manager_approve' | 'admin_approve';
  role: 'admin' | 'manager' | 'staff' | string;
  roleLabel: string;
  targetRole?: 'manager' | 'author' | string;
  targetRoleLabel?: string;
  authorName: string;
  authorId?: string | null;
  comment: string;
  version?: string;
  createdAt: string;
}


