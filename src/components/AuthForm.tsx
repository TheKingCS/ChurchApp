"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Google Sign-In isn't set up for this app yet.",
  google_state_mismatch: "That Google sign-in attempt expired. Please try again.",
  google_email_unverified: "That Google account's email address isn't verified.",
  google_failed: "Google sign-in failed. Please try again, or use email and password.",
};

export default function AuthForm({
  mode,
  googleEnabled,
}: {
  mode: "login" | "signup";
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [churchName, setChurchName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Read once after mount (not during SSR) so the error banner never
    // causes a hydration mismatch between server and client markup.
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(GOOGLE_ERROR_MESSAGES[code] ?? "Something went wrong. Please try again.");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, churchName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-neutral-50">COS</h1>
          <p className="text-neutral-500 text-sm mt-1">Church Order of Service</p>
          <p className="text-neutral-500 mt-3">
            {mode === "login" ? "Sign in to your church's account" : "Create your church's account"}
          </p>
        </div>

        {googleEnabled && (
          <>
            <a
              href="/api/auth/google"
              className="flex items-center justify-center gap-3 px-5 py-2.5 rounded-lg bg-white hover:bg-neutral-100 text-neutral-900 font-medium cursor-pointer"
            >
              <GoogleIcon />
              Continue with Google
            </a>
            <div className="flex items-center gap-3 text-xs text-neutral-600">
              <span className="flex-1 h-px bg-neutral-800" />
              or use email
              <span className="flex-1 h-px bg-neutral-800" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Church name (optional)</label>
              <input
                value={churchName}
                onChange={(e) => setChurchName(e.target.value)}
                placeholder="Grace Community Church"
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pastor@church.org"
              className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
              className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500">
          {mode === "login" ? (
            <>
              New here?{" "}
              <a href="/signup" className="text-blue-400 hover:text-blue-300">
                Create an account
              </a>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <a href="/login" className="text-blue-400 hover:text-blue-300">
                Sign in
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
