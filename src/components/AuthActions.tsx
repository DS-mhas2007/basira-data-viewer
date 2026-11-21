import { Link } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, User as UserIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function AuthActions({ className }: { className?: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    let authEventObserved = false;
    let unsubscribe = () => {};

    try {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
        authEventObserved = true;
        if (!mounted) return;
        setUser(session?.user ?? null);
        setSessionReady(true);
      });
      unsubscribe = () => subscription.unsubscribe();

      void supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!mounted || authEventObserved) return;
          setUser(data.session?.user ?? null);
        })
        .catch(() => {
          if (mounted && !authEventObserved) setUser(null);
        })
        .finally(() => {
          if (mounted) setSessionReady(true);
        });
    } catch {
      setSessionReady(true);
    }

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("تم تسجيل الخروج بنجاح.");
    } catch {
      toast.error("تعذّر تسجيل الخروج. حاول مرة أخرى.");
    } finally {
      setSigningOut(false);
    }
  }

  if (!sessionReady) {
    return (
      <span
        className={cn("size-9 shrink-0 animate-pulse rounded-xl bg-muted/70", className)}
        aria-hidden="true"
      />
    );
  }

  const isGuest = user?.is_anonymous === true;
  const loginLabel = isGuest ? "إنشاء حساب" : "تسجيل الدخول";
  const logoutLabel = isGuest ? "إنهاء الجلسة" : "تسجيل الخروج";

  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      {(!user || isGuest) && (
        <Button
          asChild
          size="sm"
          variant={user ? "outline" : "default"}
          className="shrink-0 rounded-xl px-2 sm:px-3"
        >
          <Link to="/auth" search={{ next: "/" }} aria-label={loginLabel} title={loginLabel}>
            <UserIcon className="size-4" />
            <span className="hidden sm:inline">{loginLabel}</span>
          </Link>
        </Button>
      )}
      {user && (
        <Button
          type="button"
          size="sm"
          variant={isGuest ? "ghost" : "outline"}
          className="shrink-0 rounded-xl px-2 sm:px-3"
          aria-label={logoutLabel}
          title={logoutLabel}
          onClick={() => void signOut()}
          disabled={signingOut}
        >
          {signingOut ? <Loader2 className="animate-spin" /> : <ArrowLeft />}
          <span className="hidden sm:inline">{signingOut ? "جارٍ الخروج" : logoutLabel}</span>
        </Button>
      )}
    </div>
  );
}
