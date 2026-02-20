"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import {
  Copy,
  Megaphone,
  Search,
  Sparkles,
  GitFork,
  Pencil,
  Trash2,
  LogOut,
  Plus,
  X,
  Moon,
  Sun,
  Monitor
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import type { PromptWithStats } from "@/lib/types";
import { extractVariables, sortPrompts, type SortKey } from "@/lib/prompt-utils";
import type { User } from "@supabase/supabase-js";

const MAX_PROMPT_LENGTH = 4000;

type ThemeMode = "light" | "dark" | "system";

type ComposerState = {
  id?: string;
  title: string;
  category: string;
  content: string;
  forked_from?: string | null;
};

const EMPTY_COMPOSER: ComposerState = {
  title: "",
  category: "",
  content: "",
  forked_from: null
};

function renderVariablePreview(text: string) {
  const parts: ReactNode[] = [];
  const regex = /({{\s*[a-zA-Z0-9_.-]+\s*}})/g;
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    parts.push(
      <mark key={`${start}-${match[0]}`} className="rounded bg-orange-100 px-1 text-orange-900">
        {match[0]}
      </mark>
    );
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function PromptHub() {
  const supabase = useMemo(() => createClient(), []);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [user, setUser] = useState<User | null>(null);
  const [prompts, setPrompts] = useState<PromptWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composer, setComposer] = useState<ComposerState>(EMPTY_COMPOSER);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const loadPrompts = useCallback(async () => {
    const { data, error: loadError } = await supabase.from("prompts_with_stats").select("*").limit(300);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setPrompts((data as PromptWithStats[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    const loadSession = async () => {
      const {
        data: { user: currentUser }
      } = await supabase.auth.getUser();
      setUser(currentUser);
      await loadPrompts();
      setLoading(false);
    };

    loadSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [loadPrompts, supabase]);

  useEffect(() => {
    const stored = window.localStorage.getItem("theme-mode");
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeMode(stored);
      return;
    }
    setThemeMode("system");
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = (mode: ThemeMode) => {
      const resolvedDark = mode === "dark" || (mode === "system" && media.matches);
      root.classList.toggle("dark", resolvedDark);
      root.style.colorScheme = resolvedDark ? "dark" : "light";
    };

    applyTheme(themeMode);
    window.localStorage.setItem("theme-mode", themeMode);

    const onMediaChange = () => {
      if (themeMode === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", onMediaChange);
    return () => media.removeEventListener("change", onMediaChange);
  }, [themeMode]);

  const currentYear = new Date().getFullYear();

  const fuse = useMemo(
    () =>
      new Fuse(prompts, {
        keys: ["title", "content", "category", "tags"],
        threshold: 0.32,
        ignoreLocation: true
      }),
    [prompts]
  );

  const visiblePrompts = useMemo(() => {
    const searched = query.trim() ? fuse.search(query.trim()).map((r) => r.item) : prompts;
    return sortPrompts(searched, sortBy);
  }, [fuse, prompts, query, sortBy]);

  const variables = useMemo(() => extractVariables(composer.content), [composer.content]);

  const signInWithGoogle = async () => {
    setError(null);
    setAuthLoading(true);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: env.companyDomain ? { hd: env.companyDomain } : {}
      }
    });

    if (signInError) {
      setError(signInError.message);
      setAuthLoading(false);
    }
  };

  const signInWithEmailPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    setError(null);
    setAuthLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    setAuthLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const submitPrompt = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      setError("Please sign in first.");
      return;
    }

    if (!composer.title.trim() || !composer.category.trim() || !composer.content.trim()) {
      setError("Title, category, and prompt text are required.");
      return;
    }

    if (composer.content.length > MAX_PROMPT_LENGTH) {
      setError(`Prompt text cannot exceed ${MAX_PROMPT_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      title: composer.title.trim(),
      category: composer.category.trim(),
      content: composer.content.trim(),
      tags: [composer.category.trim().toLowerCase()],
      forked_from: composer.forked_from ?? null
    };

    const response = composer.id
      ? await supabase.from("prompts").update(payload).eq("id", composer.id)
      : await supabase.from("prompts").insert({ ...payload, author_id: user.id });

    setSaving(false);

    if (response.error) {
      setError(response.error.message);
      return;
    }

    setComposer(EMPTY_COMPOSER);
    setIsComposerOpen(false);
    await loadPrompts();
  };

  const copyPrompt = async (prompt: PromptWithStats) => {
    if (!user) {
      setError("Please sign in to copy prompts.");
      return;
    }

    await navigator.clipboard.writeText(prompt.content);
    await supabase.from("prompt_copies").insert({ prompt_id: prompt.id, user_id: user.id });
    await loadPrompts();
  };

  const upvotePrompt = async (prompt: PromptWithStats) => {
    if (!user) {
      setError("Please sign in to upvote.");
      return;
    }

    const { error: voteError } = await supabase
      .from("prompt_votes")
      .insert({ prompt_id: prompt.id, user_id: user.id });

    if (voteError && voteError.code !== "23505") {
      setError(voteError.message);
      return;
    }

    await loadPrompts();
  };

  const openForkComposer = (prompt: PromptWithStats) => {
    setComposer({
      title: `${prompt.title} (Echo)`,
      category: prompt.category,
      content: prompt.content,
      forked_from: prompt.id
    });
    setIsComposerOpen(true);
  };

  const openEditComposer = (prompt: PromptWithStats) => {
    setComposer({
      id: prompt.id,
      title: prompt.title,
      category: prompt.category,
      content: prompt.content,
      forked_from: prompt.forked_from
    });
    setIsComposerOpen(true);
  };

  const deletePrompt = async (promptId: string) => {
    const { error: deleteError } = await supabase.from("prompts").delete().eq("id", promptId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await loadPrompts();
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-2xl dark:border-slate-600 dark:bg-slate-800">
              <span role="img" aria-label="office logo placeholder trumpet">
                🎺
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight dark:text-slate-50">Prompit</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Fanfare for internal AI prompts</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 p-1 dark:border-slate-600 dark:bg-slate-800">
              <button
                onClick={() => setThemeMode("light")}
                className={`rounded-md px-2 py-1 text-xs font-medium ${themeMode === "light" ? "bg-white text-slate-900 dark:bg-slate-700 dark:text-slate-100" : "text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-700"}`}
                aria-label="Switch to light mode"
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setThemeMode("dark")}
                className={`rounded-md px-2 py-1 text-xs font-medium ${themeMode === "dark" ? "bg-white text-slate-900 dark:bg-slate-700 dark:text-slate-100" : "text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-700"}`}
                aria-label="Switch to dark mode"
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setThemeMode("system")}
                className={`rounded-md px-2 py-1 text-xs font-medium ${themeMode === "system" ? "bg-white text-slate-900 dark:bg-slate-700 dark:text-slate-100" : "text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-700"}`}
                aria-label="Use system theme"
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
            </div>
            {user ? (
              <button
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {!user ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {env.authMode === "email" ? (
            <>
              <div className="mx-auto mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                Dev Auth Mode: Email
              </div>
              <h2 className="text-xl font-semibold dark:text-slate-50">Sign in with email (local dev)</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Use a whitelisted account. Access is restricted to @{env.companyDomain} users.
              </p>
              <form onSubmit={signInWithEmailPassword} className="mx-auto mt-5 max-w-sm space-y-3 text-left">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-coral/50 focus:ring dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    placeholder={`you@${env.companyDomain}`}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-coral/50 focus:ring dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {authLoading ? "Signing in..." : "Sign in with email"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold dark:text-slate-50">Sign in with your company Google account</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Access is restricted to @{env.companyDomain} users.</p>
              <button
                onClick={signInWithGoogle}
                disabled={authLoading}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {authLoading ? "Redirecting..." : "Continue with Google"}
              </button>
            </>
          )}
        </section>
      ) : (
        <>
          <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <label className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles, content, or tags..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none ring-coral/50 focus:ring dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="noise">Noise Level</option>
              <option value="newest">Newest</option>
              <option value="echoed">Most Echoed</option>
            </select>

            <button
              onClick={() => {
                setComposer(EMPTY_COMPOSER);
                setIsComposerOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Sound the Horn
            </button>
          </section>

          {loading ? <p className="text-sm text-slate-500 dark:text-slate-400">Loading prompts...</p> : null}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visiblePrompts.map((prompt) => {
              const isOwner = user.id === prompt.author_id;

              return (
                <article
                  key={prompt.id}
                  className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-moss/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-moss">
                        {prompt.category}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">by {prompt.author_name ?? "Unknown"}</span>
                    </div>
                    <h3 className="text-lg font-semibold dark:text-slate-50">{prompt.title}</h3>
                    <p className="mt-2 text-sm text-slate-700 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4] overflow-hidden dark:text-slate-300">
                      {prompt.content}
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Noise: {prompt.upvote_count}</span>
                      <span>Echoes: {prompt.copy_count}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => copyPrompt(prompt)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                      <button
                        onClick={() => upvotePrompt(prompt)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                      >
                        <Megaphone className="h-3.5 w-3.5" />
                        Noise
                      </button>
                      <button
                        onClick={() => openForkComposer(prompt)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                      >
                        <GitFork className="h-3.5 w-3.5" />
                        Echo
                      </button>

                      {isOwner ? (
                        <>
                          <button
                            onClick={() => openEditComposer(prompt)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => deletePrompt(prompt.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-200">{error}</p> : null}

      {isComposerOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4">
          <div className="mx-auto flex min-h-full items-center justify-center">
            <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold dark:text-slate-50">{composer.id ? "Edit Prompt" : "Compose Prompt"}</h2>
              <button
                onClick={() => setIsComposerOpen(false)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitPrompt} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <input
                  value={composer.title}
                  onChange={(e) => setComposer((prev) => ({ ...prev, title: e.target.value }))}
                  maxLength={120}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Category</label>
                <input
                  value={composer.category}
                  onChange={(e) => setComposer((prev) => ({ ...prev, category: e.target.value }))}
                  maxLength={40}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Prompt Text</label>
                <textarea
                  value={composer.content}
                  onChange={(e) => setComposer((prev) => ({ ...prev, content: e.target.value }))}
                  required
                  rows={8}
                  maxLength={MAX_PROMPT_LENGTH}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {composer.content.length}/{MAX_PROMPT_LENGTH} characters
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Detected Variables</p>
                {variables.length ? (
                  <div className="flex flex-wrap gap-2">
                    {variables.map((variable) => (
                      <span key={variable} className="rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-900">
                        {variable}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    No variables found. Use syntax like {"{{client_name}}"}.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Preview</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{renderVariablePreview(composer.content)}</p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : composer.id ? "Save Changes" : "Publish Prompt"}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}

      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Support: <a className="underline hover:text-slate-700 dark:hover:text-slate-200" href="mailto:yu_cheng@mit.edu">yu_cheng@mit.edu</a> • © {currentYear}
      </footer>
    </div>
  );
}
