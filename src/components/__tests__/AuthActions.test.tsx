import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthActions } from "../AuthActions";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: authMocks },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search: _search,
    children,
    ...props
  }: {
    to: string;
    search?: { next: string };
    children: React.ReactNode;
    "aria-label"?: string;
    title?: string;
    className?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("AuthActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    authMocks.signOut.mockResolvedValue({ error: null });
  });

  it("shows a sign-in link for a visitor without a session", async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: null } });

    render(<AuthActions />);

    expect(await screen.findByRole("link", { name: "تسجيل الدخول" })).toHaveAttribute(
      "href",
      "/auth",
    );
    expect(screen.queryByRole("button", { name: "تسجيل الخروج" })).not.toBeInTheDocument();
  });

  it("signs out a registered account through Supabase", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { user: { is_anonymous: false } } },
    });

    render(<AuthActions />);
    fireEvent.click(await screen.findByRole("button", { name: "تسجيل الخروج" }));

    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("offers account creation and ending the session for an anonymous guest", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { user: { is_anonymous: true } } },
    });

    render(<AuthActions />);

    expect(await screen.findByRole("link", { name: "إنشاء حساب" })).toHaveAttribute(
      "href",
      "/auth",
    );
    expect(screen.getByRole("button", { name: "إنهاء الجلسة" })).toBeInTheDocument();
  });
});
