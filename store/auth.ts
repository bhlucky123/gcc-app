import { config } from "@/utils/config";
import { router } from "expo-router";
import { create } from "zustand";

interface User {
  id: string;
  username: string;
  user_type: "DEALER" | "AGENT" | "ADMIN";
  commission: number;
  single_digit_number_commission: number;
  cap_amount: number;
  superuser?: boolean
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (payload:{username: string, password: string} | {calculate_str: string, secret_pin: string}) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User | null) => void;
  application_status: boolean;
  setApplicationStatus: (status: boolean) => void;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  return {
    user: null,
    token: null,
    loading: false,
    error: null,
    application_status: true,

    login: async (payload) => {
      console.log("on login")
      set({ loading: true, error: null });
      try {
        // Determine login endpoint and user-type header based on config.userType
        let loginUrl = "";
        let userTypeHeader = config.userType;

        switch (config.userType) {
          case "ADMIN":
            loginUrl = `${config.apiBaseUrl}/administrator/login/`;
            break;
          case "AGENT":
            loginUrl = `${config.apiBaseUrl}/agent/login/`;
            break;
          case "DEALER":
          default:
            loginUrl = `${config.apiBaseUrl}/dealer/login/`;
            break;
        }

        const response = await fetch(
          loginUrl,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Type": userTypeHeader,
            },
            body: JSON.stringify(payload),
          }
        );
        console.log("resp",response)

        if (!response.ok) {
          console.log("resp not ok")
          let errorMsg = `Login failed: ${response.status}`;
          try {
            const text = await response.text();
            let parsed;
            try {
              parsed = JSON.parse(text);
            } catch {
              // Not JSON, fallback to text
            }
            if (parsed && typeof parsed === "object") {
              // Handle DRF-style error: {"non_field_errors":["Invalid username or password."]}
              if (parsed.non_field_errors && Array.isArray(parsed.non_field_errors) && parsed.non_field_errors.length > 0) {
                errorMsg = parsed.non_field_errors[0];
              } else if (parsed.detail) {
                errorMsg = parsed.detail;
              } else {
                errorMsg = text;
              }
            } else if (text) {
              errorMsg = text;
            }
            // return false
          } catch (e) {
            // fallback to default errorMsg
            return false
          }

          set({
            error: errorMsg,
            loading: false,
          });

          // Clear error after 3 seconds
          setTimeout(() => {
            set({ error: "" });
          }, 3000);

          return false;
        }

        const data = await response.json();
        console.log("data",data)
        if (config.userType !== data?.user_details?.user_type) {
          router.push("/login")
        }
        console.log("data", data);
        set({
          user: {
            id: data.user_details?.user_id,
            user_type: config.userType,
            superuser: data?.user_details?.superuser || false,
            ...data?.user_details
          },
          token: data.access,
          loading: false,
          error: null,
        });
        router.push("/(tabs)");
        return true
      } catch (err: any) {
        console.log("err", err);
        set({ error: err.message || "Login failed", loading: false });
        return false
      }
    },

   setToken: (token) => {
      set({token})
   },

    logout: () => {
      set({ user: null, token: null });
    },

    setUser: (user) => set({ user }),

    setApplicationStatus: (status: boolean) => set({ application_status: status })
  };
});
