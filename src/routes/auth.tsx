import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BasiraLogo } from "@/components/BasiraLogo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search["next"] === "string" ? (search["next"] as string) : "/",
  }),
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | بصيرة" },
      { name: "description", content: "سجّل الدخول إلى بصيرة لحفظ محادثات «اسأل بياناتك» وتحليلاتك." },
      { property: "og:title", content: "تسجيل الدخول | بصيرة" },
      { property: "og:description", content: "سجّل الدخول إلى بصيرة لحفظ محادثاتك وتحليلاتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safeNext(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: safeNext(next), replace: true });
    });
  }, [navigate, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${safeNext(next)}` },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب، تحقق من بريدك إن طُلب التأكيد.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: safeNext(next), replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إتمام العملية");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      sessionStorage.setItem("basira:next", safeNext(next));
    } catch {
      /* تجاهل */
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("تعذّر تسجيل الدخول عبر Google");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) navigate({ to: safeNext(next), replace: true });
    setBusy(false);
  }

  return (
    <main dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/70 backdrop-blur clay-shadow p-7 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BasiraLogo className="h-12 w-auto" />
          <h1 className="text-xl font-bold">مرحباً بك في بصيرة</h1>
          <p className="text-sm text-muted-foreground">
            سجّل الدخول لحفظ محادثات «اسأل بياناتك» وتحليلاتك.
          </p>
        </div>

        <Button variant="outline" className="w-full rounded-xl" onClick={google} disabled={busy}>
          المتابعة عبر Google
        </Button>

        <div className="relative text-center text-xs text-muted-foreground">
          <span className="bg-card px-2 relative z-10">أو بالبريد الإلكتروني</span>
          <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}
          </Button>
        </form>

        <button
          type="button"
          className="w-full text-xs text-muted-foreground hover:text-primary transition"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "ليس لديك حساب؟ أنشئ حساباً جديداً" : "لديك حساب؟ سجّل الدخول"}
        </button>
      </div>
    </main>
  );
}
