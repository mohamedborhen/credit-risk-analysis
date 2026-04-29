"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

/**
 * AuthGuard — wraps a page that requires authentication.
 * If the user is not logged in, redirects to /login immediately.
 *
 * Usage:
 *   export default function ProtectedPage() {
 *     return <AuthGuard><PageContent /></AuthGuard>;
 *   }
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, hydrateAuth } = useAuthStore();

  useEffect(() => {
    hydrateAuth();
    // Small timeout to let hydration settle before checking
    const t = setTimeout(() => {
      if (!isAuthenticated) {
        console.log("[AUTH GUARD] Not authenticated — redirecting to /login");
        router.replace("/login");
      }
    }, 100);
    return () => clearTimeout(t);
  }, [isAuthenticated, router, hydrateAuth]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-gray-500 text-sm animate-pulse">Checking session...</div>
      </div>
    );
  }

  return <>{children}</>;
}
