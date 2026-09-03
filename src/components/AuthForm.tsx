"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [churchName, setChurchName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
          <h1 className="text-3xl font-bold text-neutral-50">Order Of Service</h1>
          <p className="text-neutral-500 mt-2">
            {mode === "login" ? "Sign in to your church's account" : "Create your church's account"}
          </p>
        </div>

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
