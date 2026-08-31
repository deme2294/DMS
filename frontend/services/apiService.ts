// src/services/apiService.ts

// Define a base URL for your API. Replace with your actual backend URL.
// It's good practice to use environment variables for this.
const getApiBaseUrl = (): string => {
    // Check if process and process.env are defined (typical for Node-like environments or bundler-injected env vars)
    if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL;
    }
    // Fallback if the environment variable is not set or process is not defined
    return '/api';
  };
  
  const API_BASE_URL = getApiBaseUrl();
  
  export interface NewsItem {
    id: number | string; // Allow string if backend uses UUIDs
    title: string;
    date: string; // Expected format: YYYY-MM-DD
    category: string;
    image: string; // URL of the image (this will be a string path from the backend)
    description: string; // Can contain HTML if your backend supports it and frontend renders it safely
    featured: boolean;
    readTime: string; // e.g., "5 min read"
    tags?: string[];
    comments?: number; // Optional: number of comments
    // Consider adding createdAt, updatedAt if your backend provides them
  }
  
  export interface EventItem {
    id: number | string; // Allow string if backend uses UUIDs
    title: string;
    date: string; // Expected format: YYYY-MM-DD
    time: string; // e.g., "09:00 AM" or "14:30"
    venue: string;
    image: string; // URL of the image (string path from the backend)
    description: string; // Can contain HTML
    featured: boolean;
    registrationLink: string;
    capacity: string; // e.g., "200 seats" or "Unlimited"
    tags?: string[];
    comments?: number; // Optional: number of comments
  }
  
  // Helper function for making API requests
  async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        // Try to parse error message from backend if available
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // If response is not JSON or other error, use the default message
      }
      throw new Error(errorMessage);
    }
  
    // Handle cases where POST/PUT might return 204 No Content or empty body
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return undefined as T; // Or an appropriate empty success response
    }
  
    return response.json();
  }
  
  // --- News API Functions ---
  
  /**
   * Fetches all news items from the backend.
   */
  export const getNews = (): Promise<NewsItem[]> => {
    return request<NewsItem[]>('/news'); // Assuming endpoint is /api/news
  };
  
  /**
   * Adds a new news item to the backend.
   * @param newsData - The news item data, excluding 'id', 'comments', and 'image' (which is handled by imageFile).
   *                   Includes 'imageFile' for upload.
   */
  export const addNews = async (
    newsData: Omit<NewsItem, 'id' | 'comments' | 'image'> & { imageFile?: File }
  ): Promise<NewsItem> => {
    const formData = new FormData();
  
    // Append all simple key-value pairs from newsData
    (Object.keys(newsData) as Array<keyof typeof newsData>).forEach(key => {
      if (key === 'imageFile' || key === 'tags') return; // Handle file and tags separately
  
      const value = newsData[key];
      if (value !== undefined && value !== null) {
        // Convert boolean to string for FormData
        formData.append(key, typeof value === 'boolean' ? String(value) : String(value));
      }
    });
  
    // Append tags: Backend might expect tags as an array or multiple form fields with the same name
    if (newsData.tags && newsData.tags.length > 0) {
      newsData.tags.forEach(tag => formData.append('tags', tag));
      // Alternatively, if backend expects a JSON string:
      // formData.append('tags', JSON.stringify(newsData.tags));
    } else {
      // If backend requires an empty array for tags when none are provided
      // formData.append('tags', JSON.stringify([]));
    }
  
    // Append the image file if it exists
    if (newsData.imageFile) {
      formData.append('imageFile', newsData.imageFile, newsData.imageFile.name);
    }
  
    // The backend is expected to:
    // 1. Receive 'imageFile'.
    // 2. Store the file (e.g., to cloud storage or server disk).
    // 3. Generate a URL for the stored image.
    // 4. Save the news item details along with this image URL in the 'image' field.
    // 5. Return the complete NewsItem object, including the 'id' and 'image' URL.
    return request<NewsItem>('/news', {
      method: 'POST',
      body: formData, // Content-Type will be automatically set to 'multipart/form-data' by the browser
    });
  };
  
  // --- Event API Functions ---
  
  /**
   * Fetches all event items from the backend.
   */
  export const getEvents = (): Promise<EventItem[]> => {
    return request<EventItem[]>('/events'); // Assuming endpoint is /api/events
  };
  
  /**
   * Adds a new event item to the backend.
   * @param eventData - The event item data, excluding 'id', 'comments', and 'image'.
   *                    Includes 'imageFile' for upload.
   */
  export const addEvent = async (
    eventData: Omit<EventItem, 'id' | 'comments' | 'image'> & { imageFile?: File }
  ): Promise<EventItem> => {
    const formData = new FormData();
  
    (Object.keys(eventData) as Array<keyof typeof eventData>).forEach(key => {
      if (key === 'imageFile' || key === 'tags') return;
  
      const value = eventData[key];
      if (value !== undefined && value !== null) {
        formData.append(key, typeof value === 'boolean' ? String(value) : String(value));
      }
    });
  
    if (eventData.tags && eventData.tags.length > 0) {
      eventData.tags.forEach(tag => formData.append('tags', tag));
      // formData.append('tags', JSON.stringify(eventData.tags)); // Alternative
    } else {
      // formData.append('tags', JSON.stringify([])); // Alternative
    }
  
    if (eventData.imageFile) {
      formData.append('imageFile', eventData.imageFile, eventData.imageFile.name);
    }
  
    return request<EventItem>('/events', {
      method: 'POST',
      body: formData,
    });
  };
  