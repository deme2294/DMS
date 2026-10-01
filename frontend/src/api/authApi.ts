import api from './axios';

export interface DepartmentRef {
  id: string;
  name: string;
  code: string;
}

export interface MeResponse {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'staff' | 'tenant' | 'ceo';
  tenantId?: string | null;
  tenantName?: string | null;
  phone?: string | null;
  profileImage?: string | null;
  themePreference?: 'system' | 'light' | 'dark';
  userCode?: string | null;
  departments?: DepartmentRef[];
}

export const login = (payload: { identifier: string; password: string; rememberMe?: boolean }) =>
  api.post<{
    success: boolean;
    data: {
      user: MeResponse;
      accessToken: string;
      refreshToken?: string;
    };
  }>('/auth/login', payload);

export const logout = () => api.post('/auth/logout');

export const getMe = () =>
  api.get<{
    success: boolean;
    data: MeResponse;
  }>('/auth/me');

export const refreshToken = () =>
  api.post<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
    '/auth/refresh',
    {}
  );

export const updateMyProfile = (formData: FormData) =>
  api.patch<{ success: boolean; message: string; data: MeResponse }>('/auth/me/profile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const updateMyTheme = (themePreference: 'system' | 'light' | 'dark') =>
  api.patch<{ success: boolean; message: string; data: MeResponse }>('/auth/me/theme', {
    themePreference,
  });

