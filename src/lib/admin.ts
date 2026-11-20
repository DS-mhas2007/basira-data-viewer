import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** الدوال الجديدة غير موجودة في types.ts المولَّد، فنستدعيها عبر واجهة بلا أنواع صارمة. */
type RpcResult<T> = { data: T | null; error: { message: string } | null };
type LooseRpc = {
  rpc: <T>(fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>;
};

export async function adminRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as unknown as LooseRpc).rpc<T>(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** هل المستخدم الحالي هو المالك؟ القرار الحقيقي في قاعدة البيانات (is_admin)، والواجهة تعكسه فقط. */
export function useIsAdmin() {
  const qc = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      // setTimeout: لا نستدعي Supabase من داخل callback المصادقة مباشرةً.
      window.setTimeout(() => void qc.invalidateQueries({ queryKey: ["is-admin"] }), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  return useQuery({
    queryKey: ["is-admin"],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw new Error(error.message);
      if (!data.session || data.session.user.is_anonymous) return false;
      return (await adminRpc<boolean>("is_admin")) === true;
    },
  });
}

export interface AdminOverview {
  days: number;
  kpis: {
    live_now: number;
    visits_today: number;
    visits: number;
    visitors: number;
    accounts: number;
    guests: number;
    gmail: number;
    new_accounts: number;
    ai_requests: number;
    paid: number;
  };
  daily: { day: string; visits: number; visitors: number; signups: number }[];
  countries: { country: string | null; visits: number; visitors: number }[];
  cities: { country: string | null; city: string | null; visits: number }[];
  pages: { path: string; visits: number }[];
  devices: { device: string; visits: number }[];
  referrers: { referrer: string; visits: number }[];
  plans: { plan: string; n: number }[];
}

export interface VisitRow {
  id: string;
  created_at: string;
  path: string;
  referrer: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  email: string | null;
  is_guest: boolean;
}

export interface UserRow {
  id: string;
  email: string | null;
  is_guest: boolean;
  provider: string;
  created_at: string;
  last_sign_in_at: string | null;
  plan: string;
  expires_at: string | null;
  ai_month: number;
  visits: number;
  country: string | null;
  city: string | null;
  last_seen: string | null;
}

export interface UsersPage {
  total: number;
  rows: UserRow[];
}

export interface Subscriptions {
  active: {
    user_id: string;
    email: string | null;
    plan: string;
    expires_at: string | null;
    updated_at: string;
    note: string | null;
    granted_by_email: string | null;
  }[];
  audit: {
    created_at: string;
    action: string;
    details: {
      plan?: string;
      days?: number | null;
      expires_at?: string | null;
      note?: string | null;
    };
    admin_email: string | null;
    target_email: string | null;
  }[];
}
