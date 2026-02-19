import axios, { AxiosInstance, AxiosError } from 'axios';

let apiClient: AxiosInstance | null = null;

/**
 * Get API client for making requests to the main EHR backend
 */
export function getApiClient(token?: string): AxiosInstance {
  const baseURL = process.env.EHR_API_BASE_URL || 'http://localhost:3000/api/v1';

  if (!apiClient) {
    apiClient = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Set auth token if provided
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  return apiClient;
}

/**
 * Create a fresh API client with a specific token
 */
export function createApiClient(token: string): AxiosInstance {
  const baseURL = process.env.EHR_API_BASE_URL || 'http://localhost:3000/api/v1';

  return axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
}

/**
 * Extract error message from axios error
 */
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error occurred';
}
