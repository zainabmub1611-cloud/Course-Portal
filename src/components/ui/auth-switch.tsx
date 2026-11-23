"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Mail, Lock, User, ArrowLeft, Loader2, Check, Sparkles, Eye, EyeOff, X } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { apiPost } from "@/hooks/use-api";
import { toast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { setSessionToken } from "@/lib/auth/client-token";
import type { PublicUser } from "@/types";
import { GraduationCap } from "lucide-react";
import "./auth-switch.css";

interface PublicPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  duration: number;
  durationUnit: string;
  isPopular: boolean;
}

interface SavedCredential {
  email: string;
  password: string;
  name?: string;
}

const SAVED_ACCOUNTS_KEY = "courselearn_saved_accounts";
const REMEMBER_ME_KEY = "courselearn_remember_credentials";

function readSavedAccounts(): SavedCredential[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedCredential =>
        typeof item?.email === "string" && typeof item?.password === "string"
    );
  } catch {
    return [];
  }
}

function writeSavedAccounts(accounts: SavedCredential[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, 6)));
  } catch {
    /* ignore storage quota errors */
  }
}

function storeBrowserPasswordCredential(email: string, password: string, name?: string) {
  if (typeof window === "undefined") return;
  try {
    const CredCtor = (window as unknown as {
      PasswordCredential?: new (data: { id: string; password: string; name?: string }) => Credential;
    }).PasswordCredential;
    if (CredCtor && navigator.credentials?.store) {
      const cred = new CredCtor({ id: email, password, name: name || email });
      void navigator.credentials.store(cred).catch(() => {});
    }
  } catch {
    /* ignore unsupported browser API */
  }
}

function formatPlanPrice(price: number, currency: string): string {
  if (price <= 0) return "Free";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: price % 1 === 0 ? 0 : 2,
    }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

function formatPlanDuration(duration: number, unit: string): string {
  const normalized = unit.toLowerCase();
  const singular = normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;
  return `${duration} ${duration === 1 ? singular : normalized}`;
}

/**
 * AuthSwitch
 * ----------
 * Animated sign-in / sign-up panel with a sliding circular transition.
 * Sign-in authenticates against /api/auth/login and saves remembered credentials.
 * Sign-up collects user details in Step 1, lets the user select an admin plan
 * or Free in Step 2, and saves credentials for seamless future sign-in.
 */
export default function AuthSwitch({
  initialMode = "signin",
}: {
  initialMode?: "signin" | "signup";
}) {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const query = useAppStore((s) => s.query);
  const branding = useAppStore((s) => s.branding);
  const refreshUser = useAppStore((s) => s.refreshUser);
  const setUser = useAppStore((s) => s.setUser);
  const appName = branding.appName || "CourseLearn";

  const [isSignUp, setIsSignUp] = useState(initialMode === "signup");
  const [signupStep, setSignupStep] = useState<1 | 2>(1);

  // Sign-in fields (isolated from sign-up so browser autofill & mode switches never overwrite)
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedCredential[]>([]);

  // Sign-up fields
  const [username, setUsername] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(query.planId || "");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = readSavedAccounts();
    setSavedAccounts(saved);
    try {
      const pref = window.localStorage.getItem(REMEMBER_ME_KEY);
      const shouldRemember = pref !== "false";
      setRememberMe(shouldRemember);
      if (shouldRemember && saved.length > 0) {
        setSignInEmail(saved[0].email);
        setSignInPassword(saved[0].password);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let active = true;
    setPlansLoading(true);
    fetch("/api/public/plans", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { plans: [] }))
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data?.plans) ? data.plans : [];
        setPlans(list);
      })
      .catch(() => {
        if (active) setPlans([]);
      })
      .finally(() => {
        if (active) setPlansLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function persistCredential(emailVal: string, passwordVal: string, nameVal?: string) {
    const cleanEmail = emailVal.trim().toLowerCase();
    const current = readSavedAccounts().filter(
      (item) => item.email.toLowerCase() !== cleanEmail
    );
    const updated = [{ email: cleanEmail, password: passwordVal, name: nameVal }, ...current];
    writeSavedAccounts(updated);
    setSavedAccounts(updated);
    storeBrowserPasswordCredential(cleanEmail, passwordVal, nameVal);
  }

  function removeSavedAccount(emailToRemove: string) {
    const updated = savedAccounts.filter(
      (item) => item.email.toLowerCase() !== emailToRemove.toLowerCase()
    );
    writeSavedAccounts(updated);
    setSavedAccounts(updated);
    if (signInEmail.trim().toLowerCase() === emailToRemove.toLowerCase()) {
      setSignInEmail("");
      setSignInPassword("");
    }
  }

  function applySavedAccount(cred: SavedCredential) {
    setSignInEmail(cred.email);
    setSignInPassword(cred.password);
    setError(null);
    setIsSignUp(false);
  }

  function fillDemoCredentials() {
    setSignInEmail("admin@courselearn.dev");
    setSignInPassword("admin123");
    setError(null);
    setIsSignUp(false);
    setSignupStep(1);
  }

  async function onSignInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const cleanEmail = signInEmail.trim();
    if (!cleanEmail || !signInPassword) {
      setError(t("auth.pleaseCompleteFields"));
      return;
    }
    setLoading(true);
    try {
      const result = await apiPost<{ token?: string; user: PublicUser }>(
        "/api/auth/login",
        {
          email: cleanEmail,
          password: signInPassword,
        }
      );
      if (result?.token) {
        setSessionToken(result.token);
      }
      if (result?.user) {
        setUser(result.user);
      }
      try {
        window.localStorage.setItem(REMEMBER_ME_KEY, String(rememberMe));
      } catch {
        /* ignore */
      }
      if (rememberMe) {
        persistCredential(
          result?.user?.email || cleanEmail,
          signInPassword,
          result?.user?.name
        );
      }
      toast({ title: t("auth.welcomeBackToast"), description: t("auth.loggedInDesc") });
      await refreshUser();
      const role = result?.user?.role;
      if (role === "ADMIN") {
        navigate(["admin", "overview"]);
      } else if (role === "STUDENT") {
        navigate(["student", "overview"]);
      } else if (role === "UNIVERSITY") {
        navigate(["university", "overview"]);
      } else if (role === "INSTRUCTOR") {
        navigate(["university", "overview"]);
      }
    } catch (e: any) {
      setError(e?.message || t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function onSignUpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (signupStep === 1) {
      if (username.trim().length < 2 || !signUpEmail.trim() || signUpPassword.length < 6) {
        setError(t("auth.pleaseCompleteFields"));
        return;
      }
      if (!selectedPlanId && query.planId && plans.some((p) => p.id === query.planId)) {
        setSelectedPlanId(query.planId);
      } else if (selectedPlanId && selectedPlanId !== "FREE" && !plans.some((p) => p.id === selectedPlanId)) {
        setSelectedPlanId("");
      }
      setSignupStep(2);
      return;
    }

    if (!selectedPlanId) {
      setError(t("auth.pleaseSelectPlan"));
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = signUpEmail.trim();
      const result = await apiPost<{ token?: string; user?: PublicUser }>("/api/auth/register", {
        name: username.trim(),
        email: cleanEmail,
        password: signUpPassword,
        planId: selectedPlanId,
      });
      if (result?.token) {
        setSessionToken(result.token);
      }
      if (result?.user) {
        setUser(result.user);
      }
      persistCredential(cleanEmail, signUpPassword, username.trim());
      setSignInEmail(cleanEmail.toLowerCase());
      setSignInPassword(signUpPassword);
      toast({
        title: t("auth.accountCreated"),
        description:
          selectedPlanId === "FREE"
            ? `Welcome to ${appName}. You can start exploring free courses now.`
            : t("auth.accountCreatedDesc"),
      });
      await refreshUser();
      navigate(["student", "overview"]);
    } catch (e: any) {
      setError(e?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-switch" dir="ltr">
      {/* Floating top bar — overlays the gradient, never disrupts the card */}
      <div className="topbar">
        <button
          type="button"
          className="topbar-brand"
          onClick={() => navigate([""])}
          aria-label={`${appName} home`}
        >
          <span className="mark">
            {branding.logoUrl ? (
              <img
                key="auth-logo-img"
                src={branding.logoUrl}
                alt={appName}
                className="h-full w-full object-contain bg-white/95 p-0.5"
              />
            ) : (
              <GraduationCap key="auth-logo-icon" className="h-5 w-5" />
            )}
          </span>
          {appName === "CourseLearn" ? (
            <span key="auth-name-default">
              Course<span style={{ color: "rgba(255,255,255,0.7)" }}>Learn</span>
            </span>
          ) : (
            <span key="auth-name-custom">{appName}</span>
          )}
        </button>
        <div className="topbar-actions">
          <LanguageSwitcher />
          <button
            type="button"
            className="topbar-btn"
            onClick={() => navigate([""])}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("auth.backToHome")}
          </button>
        </div>
      </div>

      <div className={isSignUp ? "container sign-up-mode" : "container"}>
        <div className="forms-container">
          <div className="signin-signup">
            {/* ── Sign in ── */}
            <form id="sign-in-form" className="sign-in-form" method="post" onSubmit={onSignInSubmit}>
              <h2 className="title">{t("auth.signIn")}</h2>
              <div className="input-field">
                <i>
                  <Mail className="h-5 w-5" />
                </i>
                <input
                  id="signin-email"
                  name="email"
                  type="email"
                  required
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder={t("common.email")}
                  autoComplete="username"
                />
              </div>
              <div className="input-field">
                <i>
                  <Lock className="h-5 w-5" />
                </i>
                <input
                  id="signin-password"
                  name="password"
                  type={showSignInPassword ? "text" : "password"}
                  required
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder={t("common.password")}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowSignInPassword((v) => !v)}
                  aria-label={showSignInPassword ? t("auth.hide") : t("auth.show")}
                >
                  {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="remember-row">
                <label className="remember-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setRememberMe(next);
                      try {
                        window.localStorage.setItem(REMEMBER_ME_KEY, String(next));
                      } catch {
                        /* ignore */
                      }
                    }}
                  />
                  <span>Save email &amp; password</span>
                </label>
              </div>
              {error && !isSignUp && <p className="error-text">{error}</p>}
              <button type="submit" className="btn solid" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("auth.signingIn")}
                  </>
                ) : (
                  t("auth.signIn")
                )}
              </button>
              {savedAccounts.length > 0 && (
                <div className="saved-accounts" aria-label="Saved accounts">
                  {savedAccounts.slice(0, 3).map((cred) => (
                    <div key={cred.email} className="saved-chip">
                      <button
                        type="button"
                        className="saved-chip-email"
                        style={{ background: "none", border: "none", padding: 0, color: "inherit", font: "inherit", cursor: "pointer" }}
                        onClick={() => applySavedAccount(cred)}
                        title={`Fill saved login for ${cred.email}`}
                      >
                        {cred.email}
                      </button>
                      <button
                        type="button"
                        className="saved-chip-remove"
                        aria-label={`Remove saved login ${cred.email}`}
                        onClick={() => removeSavedAccount(cred.email)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="demo-chip"
                onClick={fillDemoCredentials}
              >
                {t("auth.demoCredsChip")}
              </button>
            </form>

            {/* ── Sign up ── */}
            <form id="sign-up-form" className="sign-up-form" method="post" onSubmit={onSignUpSubmit}>
              {signupStep === 1 ? (
                <>
                  <h2 className="title">{t("auth.signUp")}</h2>
                  <div className="input-field">
                    <i>
                      <User className="h-5 w-5" />
                    </i>
                    <input
                      id="signup-name"
                      name="name"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t("auth.username")}
                      autoComplete="name"
                    />
                  </div>
                  <div className="input-field">
                    <i>
                      <Mail className="h-5 w-5" />
                    </i>
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      required
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      placeholder={t("common.email")}
                      autoComplete="username"
                    />
                  </div>
                  <div className="input-field">
                    <i>
                      <Lock className="h-5 w-5" />
                    </i>
                    <input
                      id="signup-password"
                      name="password"
                      type={showSignUpPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      placeholder={t("common.password")}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="pw-toggle"
                      onClick={() => setShowSignUpPassword((v) => !v)}
                      aria-label={showSignUpPassword ? t("auth.hide") : t("auth.show")}
                    >
                      {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {error && isSignUp && <p className="error-text">{error}</p>}
                  <button type="submit" className="btn" style={{ width: "auto", padding: "0 28px" }}>
                    {t("auth.selectPlan")}
                  </button>
                </>
              ) : (
                <>
                  {/* Keep credentials present in DOM on submit so password managers save them */}
                  <input type="hidden" name="email" value={signUpEmail} readOnly />
                  <input
                    type="password"
                    name="password"
                    value={signUpPassword}
                    readOnly
                    tabIndex={-1}
                    aria-hidden="true"
                    autoComplete="new-password"
                    style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                  />
                  <div className="plan-step-header">
                    <button
                      type="button"
                      className="plan-back-btn"
                      onClick={() => {
                        setError(null);
                        setSignupStep(1);
                      }}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      {t("common.back")}
                    </button>
                    <span className="plan-step-badge">{t("auth.choosePlan")}</span>
                  </div>

                  <div className="plans-list" role="radiogroup" aria-label={t("auth.choosePlan")}>
                    {plansLoading ? (
                      <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#667eea" }} />
                      </div>
                    ) : (
                      <>
                        {plans.map((plan) => {
                          const isSelected = selectedPlanId === plan.id;
                          return (
                            <button
                              key={plan.id}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              className={`plan-option${isSelected ? " selected" : ""}`}
                              onClick={() => {
                                setSelectedPlanId(plan.id);
                                setError(null);
                              }}
                            >
                              <div className="plan-info">
                                <div className="plan-name-row">
                                  <span className="plan-name">{plan.name}</span>
                                  {plan.isPopular && (
                                    <span className="plan-popular">
                                      <Sparkles className="h-2.5 w-2.5" />
                                      {t("auth.popular")}
                                    </span>
                                  )}
                                </div>
                                <div className="plan-meta">
                                  {formatPlanDuration(plan.duration, plan.durationUnit)}
                                  {plan.description ? ` · ${plan.description}` : ""}
                                </div>
                              </div>
                              <div className="plan-right">
                                <span className="plan-price">
                                  {formatPlanPrice(plan.price, plan.currency)}
                                </span>
                                <span className="plan-check">
                                  {isSelected && <Check className="h-3 w-3" />}
                                </span>
                              </div>
                            </button>
                          );
                        })}

                        {/* Free option */}
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selectedPlanId === "FREE"}
                          className={`plan-option${selectedPlanId === "FREE" ? " selected" : ""}`}
                          onClick={() => {
                            setSelectedPlanId("FREE");
                            setError(null);
                          }}
                        >
                          <div className="plan-info">
                            <div className="plan-name-row">
                              <span className="plan-name">{t("common.free")}</span>
                            </div>
                            <div className="plan-meta">
                              Access free courses &amp; lessons
                            </div>
                          </div>
                          <div className="plan-right">
                            <span className="plan-price">{t("common.free")}</span>
                            <span className="plan-check">
                              {selectedPlanId === "FREE" && <Check className="h-3 w-3" />}
                            </span>
                          </div>
                        </button>
                      </>
                    )}
                  </div>

                  {error && isSignUp && <p className="error-text">{error}</p>}
                  <button
                    type="submit"
                    className="btn"
                    disabled={loading}
                    style={{ width: "auto", padding: "0 28px" }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("auth.creatingAccount")}
                      </>
                    ) : (
                      t("auth.signUp")
                    )}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>

        <div className="panels-container">
          <div className="panel left-panel">
            <div className="content">
              <h3>{t("auth.newHere")}</h3>
              <p>{t("auth.newHereDesc")}</p>
              <button
                type="button"
                className="btn transparent"
                onClick={() => {
                  setError(null);
                  setSignupStep(1);
                  setIsSignUp(true);
                }}
              >
                {t("auth.signUp")}
              </button>
            </div>
          </div>

          <div className="panel right-panel">
            <div className="content">
              <h3>{t("auth.oneOfUs")}</h3>
              <p>{t("auth.oneOfUsDesc")}</p>
              <button
                type="button"
                className="btn transparent"
                onClick={() => {
                  setError(null);
                  setSignupStep(1);
                  setIsSignUp(false);
                }}
              >
                {t("auth.signIn")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
