import api from './axios';

export interface TicketCategory {
    id: string;
    name: string;
    description?: string | null;
    departmentId?: string | null;
    departmentName?: string | null;
    isActive: boolean;
    status?: 'pending' | 'approved' | 'rejected';
    routingType?: 'general' | 'direct';
    slaPolicyId?: string | null;
    requestedBy?: string | null;
    requestedByName?: string | null;
    reviewedBy?: string | null;
    reviewedByName?: string | null;
    reviewNotes?: string | null;
    reviewedAt?: string | null;
    createdByName?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface CategoryRequest {
    id: string;
    categoryId: string;
    requestedBy?: string | null;
    requestedByName?: string | null;
    departmentId?: string | null;
    departmentName?: string | null;
    name: string;
    description?: string | null;
    status: 'pending' | 'approved' | 'rejected';
    reviewedByName?: string | null;
    reviewNotes?: string | null;
    createdAt?: string;
}

export const fetchCategories = (params?: { includeInactive?: boolean }) =>
    api.get<{ success: boolean; data: TicketCategory[] }>('/ticket-categories', { params });

export const fetchCategory = (id: string) =>
    api.get<{ success: boolean; data: TicketCategory }>(`/ticket-categories/${id}`);

export const createCategory = (payload: {
    name: string;
    description?: string;
    departmentId?: string;
    slaPolicyId?: string;
    routingType?: 'general' | 'direct';
}) => api.post<{ success: boolean; data: TicketCategory }>('/ticket-categories', payload);

export const updateCategory = (
    id: string,
    payload: { name?: string; description?: string; departmentId?: string; slaPolicyId?: string; isActive?: boolean; routingType?: 'general' | 'direct' }
) => api.put<{ success: boolean; data: TicketCategory }>(`/ticket-categories/${id}`, payload);

export const approveCategory = (id: string, reviewNotes?: string) =>
    api.post<{ success: boolean; data: TicketCategory }>(`/ticket-categories/${id}/approve`, { reviewNotes });

export const rejectCategory = (id: string, reviewNotes?: string) =>
    api.post<{ success: boolean; data: TicketCategory }>(`/ticket-categories/${id}/reject`, { reviewNotes });

export const fetchCategoryRequests = (status?: string) =>
    api.get<{ success: boolean; data: CategoryRequest[] }>('/ticket-categories/requests', { params: status ? { status } : {} });

export const deleteCategory = (id: string) =>
    api.delete(`/ticket-categories/${id}`);
