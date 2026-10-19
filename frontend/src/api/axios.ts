import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Shared refresh state — keeps one in-flight refresh promise shared across
// all concurrent 401 responses so we never send duplicate refresh requests.
let refreshPromise: Promise<string> | null = null;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const url: string = error.config?.url ?? '';

    // Never retry auth-related endpoints — avoids infinite loops
    if (url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;

      // Start a single shared refresh if one isn't already in flight
      if (!refreshPromise) {
        refreshPromise = (async (): Promise<string> => {
          try {
            const storedRefreshToken = localStorage.getItem('refreshToken');
            if (!storedRefreshToken) {
              throw new Error('No refresh token available');
            }
            const { data } = await axios.post('/api/auth/refresh', { refreshToken: storedRefreshToken }, { withCredentials: true });
            const newAccessToken: string = data.data.accessToken;
            localStorage.setItem('accessToken', newAccessToken);
            // Also persist new refresh token if the server rotates it
            if (data.data.refreshToken) {
              localStorage.setItem('refreshToken', data.data.refreshToken);
            }
            return newAccessToken;
          } catch (err) {
            // Refresh failed — clear session and redirect to login
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('role');
            window.location.href = '/login';
            throw err;
          } finally {
            // Clear only after settling so concurrent waiters can all resolve
            refreshPromise = null;
          }
        })();
      }

      try {
        const newToken = await refreshPromise;
        // Retry the original request with the new token
        if (error.config.headers?.set) {
          error.config.headers.set('Authorization', `Bearer ${newToken}`);
        } else {
          error.config.headers = {
            ...error.config.headers,
            Authorization: `Bearer ${newToken}`,
          };
        }
        return api(error.config);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;