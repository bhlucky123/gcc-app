import { useAuthStore } from "@/store/auth";
import axios from "axios";
import { router } from "expo-router";
import { config } from "./config";

const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor (logs time start)
api.interceptors.request.use(
  async (config) => {
    // Grab token from Zustand store
    const token = useAuthStore.getState().token;

    // Mark request start time
    (config as any).metadata = { startTime: Date.now() };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor (logs time taken)
api.interceptors.response.use(
  (response) => {
    // Calculate and log elapsed time
    const metadata = (response.config as any).metadata;
    if (metadata && metadata.startTime) {
      const duration = Date.now() - metadata.startTime;
      console.log(
        `[Axios] ${response.config.method?.toUpperCase()} ${response.config.url} took ${duration}ms`
      );
    }

    if (response.status === 204) {
      return { ...response, data: null };
    }
    return response;
  },
  (error) => {
    // Log time for failed requests too
    if (error.config && (error.config as any).metadata && (error.config as any).metadata.startTime) {
      const duration = Date.now() - (error.config as any).metadata.startTime;
      console.log(
        `[Axios] ${error.config.method?.toUpperCase()} ${error.config.url} errored after ${duration}ms`
      );
    }

    console.log("error", error);
    console.log("Raw error:", error);

    if (
      error.request &&
      typeof error.request._response === "string" &&
      error.request._response.includes("HTTP 204 had non-zero Content-Length")
    ) {
      console.warn("⚠️ Fixing malformed 204 No Content response...");
      return Promise.resolve({
        status: 204,
        statusText: "No Content",
        data: null,
        headers: {},
        config: error.config,
      });
    }

    if (error.request) {
      console.log("🚨 Raw response text:", error.request.responseText);
      console.log("🚨 Raw status:", error.request.status);
    }
    if (error.response) {
      const { status, data } = error.response;
      console.log("❌ Axios Error:", status, data);

      if (status === 503) {
        console.log("naivigating due to inative", status);
        router.push("..")
        return
      }

      if (status === 401) {
        router.push("/login")
        return
      }
      return Promise.reject({ status: status || 500, message: data || "something went wrong" });

    } else {
      console.error("❌ Network or config error", error);
      return Promise.reject(error);
    }
  }
);

export default api;
