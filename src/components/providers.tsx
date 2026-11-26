"use client";
import { createContext, Suspense, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { data, dataMode } from "@/lib/data";
import { onMockChange } from "@/lib/data/mock";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Session } from "@/lib/types";
import { DemoSwitcher } from "./demo-switcher";
import { InstallBanner } from "./install-prompt";

interface SessionState {
  session: Session | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionState>({ session: null, loading: true, refresh: async () => {} });

export function useSession() {
  return useContext(SessionContext);
}

export function Providers({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSession(await data.getSession());
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load is a subscription to an external store (Supabase / localStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    if (dataMode === "mock") return onMockChange(() => void refresh());
    const { data: sub } = getBrowserSupabase().auth.onAuthStateChange(() => void refresh());
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
  }, []);

  return (
    <SessionContext.Provider value={{ session, loading, refresh }}>
      {children}
      <Suspense fallback={null}>
        <InstallBanner />
      </Suspense>
      {dataMode === "mock" && <DemoSwitcher />}
    </SessionContext.Provider>
  );
}
