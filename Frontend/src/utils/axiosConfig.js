import axios from "axios";

const instance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
});

let refreshPromise = null;

const refreshSession = async () => {
  if (!refreshPromise) {
    refreshPromise = instance
      .post("/api/user/refresh")
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const isUnauthorized = error.response?.status === 401;
    const isAuthRequest =
      request?.url?.includes("/api/user/login") ||
      request?.url?.includes("/api/user/signup") ||
      request?.url?.includes("/api/user/refresh") ||
      request?.url?.includes("/api/user/logout");

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
