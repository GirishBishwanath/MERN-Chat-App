import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
});

let refreshPromise: Promise<unknown> | null = null;

const refreshSession = async (): Promise<unknown> => {
  if (!refreshPromise) {
    refreshPromise = instance.post("/api/user/refresh").finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

instance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetryableRequestConfig | undefined;
    const isUnauthorized = error.response?.status === 401;
    const url = request?.url ?? "";
    const isAuthRequest =
      url.includes("/api/user/login") ||
      url.includes("/api/user/signup") ||
      url.includes("/api/user/refresh") ||
      url.includes("/api/user/logout");

    if (!isUnauthorized || !request || request._retry || isAuthRequest) {
      return Promise.reject(error);
    }

    request._retry = true;

    try {
      await refreshSession();
      return instance(request);
    } catch (refreshError) {
      window.dispatchEvent(new Event("auth:expired"));
      return Promise.reject(refreshError);
    }
  }
);

export default instance;
export { axios };
