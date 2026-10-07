import api from './axios';
import type {
  Article,
  ArticleFormValues,
  ArticleListParams,
  ArticleStats,
  KnowledgeCategory,
  KnowledgeAttachment,
  ArticleVersion,
} from '../types/article';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const fetchArticles = (params: ArticleListParams) =>
  api.get<{ success: boolean; data: Article[]; pagination: PaginationMeta }>('/knowledge', { params });

export const fetchArticle = (id: string) =>
  api.get<{ success: boolean; data: Article }>(`/knowledge/${id}`);

export const getArticleByReference = (reference: string) =>
  api.get<{ success: boolean; data: Article }>(`/knowledge/reference/${reference}`);

export const getPublicArticles = (params?: ArticleListParams) =>
  api.get<{ success: boolean; data: Article[]; pagination: PaginationMeta }>('/knowledge/public', { params });

export const fetchMyDrafts = () =>
  api.get<{ success: boolean; data: Article[]; pagination: PaginationMeta }>('/knowledge/my-drafts');

export const fetchMyArticles = (params?: ArticleListParams) =>
  api.get<{ success: boolean; data: Article[]; pagination: PaginationMeta }>('/knowledge/my-articles', { params });

export const fetchPendingReview = (params?: { status?: string }) =>
  api.get<{ success: boolean; data: Article[]; pagination: PaginationMeta }>('/knowledge/pending', { params });

export const fetchNeedsRevision = () =>
  api.get<{ success: boolean; data: Article[]; pagination: PaginationMeta }>('/knowledge/needs-revision');

export const fetchArticleStats = () =>
  api.get<{ success: boolean; data: ArticleStats }>('/knowledge/stats');

export const createArticle = (payload: Record<string, unknown>) =>
  api.post('/knowledge', payload);

export const updateArticle = (id: string, payload: Record<string, unknown>) =>
  api.put(`/knowledge/${id}`, payload);

export const submitArticle = (id: string, payload?: Record<string, unknown>) =>
  api.post(`/knowledge/${id}/submit`, payload);

export const requestRevision = (id: string, reason: string, options?: { targetRole?: string; routeTo?: string }) =>
  api.post(`/knowledge/${id}/request-revision`, { reason, ...(options || {}) });

export const approveArticle = (id: string) =>
  api.post(`/knowledge/${id}/approve`);

export const rejectArticle = (id: string, reason: string) =>
  api.post(`/knowledge/${id}/reject`, { reason });

export const publishArticle = (id: string) =>
  api.post(`/knowledge/${id}/publish`);

export const unpublishArticle = (id: string, reason?: string) =>
  api.post(`/knowledge/${id}/unpublish`, { reason });

export const archiveArticle = (id: string) =>
  api.post(`/knowledge/${id}/archive`);

export const restoreArticle = (id: string) =>
  api.post(`/knowledge/${id}/restore`);

export const fetchArticleVersions = (articleId: string) =>
  api.get<{ success: boolean; data: ArticleVersion[] }>(`/knowledge/${articleId}/versions`);

export const createArticleVersion = (articleId: string, payload: { versionNumber?: string; title?: string; content?: string; changeSummary?: string }) =>
  api.post(`/knowledge/${articleId}/versions`, payload);

export const moveToDraft = (id: string) =>
  api.post(`/knowledge/${id}/to-draft`);

export const deleteArticle = (id: string) => api.delete(`/knowledge/${id}`);

export const rateArticle = (id: string, helpful: boolean, payload?: { reason?: string; comment?: string }) =>
  api.post(`/knowledge/${id}/feedback`, { helpful, ...payload });

export const fetchArticleCategories = (params?: { departmentId?: string }) =>
  api.get<{ success: boolean; data: string[] }>('/knowledge/categories', { params });

export const fetchAllCategories = (params?: { departmentId?: string }) =>
  api.get<{ success: boolean; data: KnowledgeCategory[] }>('/knowledge/categories/all', { params });

export const getPopularArticles = (limit = 10) =>
  api.get<{ success: boolean; data: Article[] }>('/knowledge/popular', { params: { limit } });

export const getRecentArticles = (limit = 10) =>
  api.get<{ success: boolean; data: Article[] }>('/knowledge/recent', { params: { limit } });

export const createCategory = (payload: { name: string; description?: string; icon?: string; isActive?: boolean; parentId?: string | null; departmentId?: string | null }) =>
  api.post('/knowledge/categories', payload);

export const updateCategory = (id: string, payload: { name?: string; description?: string; icon?: string; isActive?: boolean; parentId?: string | null; departmentId?: string | null }) =>
  api.put(`/knowledge/categories/${id}`, payload);

export const deleteCategory = (id: string) =>
  api.delete(`/knowledge/categories/${id}`);

export const fetchVersions = (id: string) =>
  api.get<{ success: boolean; data: ArticleVersion[] }>(`/knowledge/${id}/versions`);

export const fetchVersionById = (id: string, versionId: string) =>
  api.get<{ success: boolean; data: ArticleVersion }>(`/knowledge/${id}/versions/${versionId}`);

export const restoreArticleVersion = (
  id: string,
  versionId: string,
  payload?: { isMajor?: boolean; changeSummary?: string; reason?: string; publishImmediately?: boolean }
) =>
  api.post<{ success: boolean; message: string; data: any }>(
    `/knowledge/${id}/versions/${versionId}/restore`,
    payload
  );

export const createVersion = (id: string, payload: { versionNumber?: string; title?: string; content?: string; categoryId?: string | null; changeSummary?: string; isMajor?: boolean }) =>
  api.post(`/knowledge/${id}/versions`, payload);

export const uploadAttachment = (id: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/knowledge/${id}/attachments`, form);
};

export const fetchAttachments = (id: string) =>
  api.get<{ success: boolean; data: KnowledgeAttachment[] }>(`/knowledge/${id}/attachments`);

export const deleteAttachment = (articleId: string, attachmentId: string) =>
  api.delete(`/knowledge/attachments/${attachmentId}?articleId=${articleId}`);

export const searchArticles = (q: string, limit = 10, excludeId = '') =>
  api.get<{ success: boolean; data: Article[] }>('/knowledge/search', { params: { q, limit, excludeId } });
