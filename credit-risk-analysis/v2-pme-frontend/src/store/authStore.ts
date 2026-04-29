import { create } from "zustand";

interface User {
  id: string;
  email: string;
  role: string;
  credits: number; // TASK 1: credits carried from login/register response
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (userData: User, token: string) => void;
  logout: () => void;
  hydrateAuth: () => void;
  updateCredits: (credits: number) => void; // called after unlock
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: (user, token) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("finscore_jwt", token);
      localStorage.setItem("finscore_user", JSON.stringify(user));
    }
    console.log("[AUTH STORE] login() — credits:", user.credits);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("finscore_jwt");
      localStorage.removeItem("finscore_user");
    }
    set({ user: null, token: null, isAuthenticated: false });
  },

  hydrateAuth: () => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("finscore_jwt");
      const userStr = localStorage.getItem("finscore_user");

      if (token && userStr) {
        try {
          const user: User = JSON.parse(userStr);
          // Ensure credits is a number even for old stored sessions
          if (typeof user.credits !== "number") user.credits = 5;
          console.log("[AUTH STORE] hydrateAuth() — credits:", user.credits);
          set({ user, token, isAuthenticated: true });
        } catch (e) {
          localStorage.removeItem("finscore_jwt");
          localStorage.removeItem("finscore_user");
        }
      }
    }
  },

  updateCredits: (credits: number) => {
    const { user } = get();
    if (!user) return;
    const updated = { ...user, credits };
    if (typeof window !== "undefined") {
      localStorage.setItem("finscore_user", JSON.stringify(updated));
    }
    console.log("[AUTH STORE] updateCredits() — new credits:", credits);
    set({ user: updated });
  },
}));
