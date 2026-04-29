import axios from "axios";

// Create an Axios instance configured for the backend
const apiClient = axios.create({
  baseURL: "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to attach JWT token to every request
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("finscore_jwt");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 Unauthorized globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("finscore_jwt");
        localStorage.removeItem("finscore_user");
        // Auto-redirect to login page on 401
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
