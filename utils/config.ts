type UserType = "ADMIN" | "DEALER" | "AGENT";

interface Config {
  apiBaseUrl: string;
  userType: UserType;
}

export const config: Config = {
  // apiBaseUrl: "https://3dlnbe-production.up.railway.app",
  // apiBaseUrl: "https://alfarah.in",
  apiBaseUrl: "https://clctr.alfarah.in",
  // userType: "ADMIN",
  userType: "DEALER",
  // userType: "AGENT",
};