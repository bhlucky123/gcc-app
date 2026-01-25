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

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Grab token from Zustand store
    const token = useAuthStore.getState().token;


    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor (optional)
api.interceptors.response.use(
  // (response) => response,
  (response) => {
    // console.log("response", response);
    if (response.status === 204) {
      // Return a custom empty object or message if needed
      return { ...response, data: null };
    }
    return response;
  },
  (error) => {
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
        if(config.userType === "ADMIN"){
          router.push("/login")
        }else{
        router.push("..")
        }
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
