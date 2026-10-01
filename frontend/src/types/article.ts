export type ArticleStatus =
  | 'draft'
  | 'pending_approval'
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
  helpfulCount?: number;
  notHelpfulCount?: number;
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
  helpfulYes: number;
  notHelpfulNo: number;
  byDepartment: { name: string; count: number }[];
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  isActive: boolean;
  parentId?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeAttachment {
  id: string;
  articleId: string;
  fileName: string;
  filePath: string;
  fileSize?: number | null;
  mimeType?: string | null;
  fileExtension?: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface ArticleVersion {
  id: string;
  articleId: string;
  versionNumber: string;
  title: string;
  content: string;
  categoryId?: string | null;
  changeSummary?: string | null;
  createdBy: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  creatorFirstName?: string | null;
  creatorLastName?: string | null;
}


