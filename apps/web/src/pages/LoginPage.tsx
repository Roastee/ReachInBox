import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRightIcon,
  CheckIcon,
  GoogleIcon,
  LockIcon,
  LogoMark,
  MailIcon,
  UserIcon,
} from "../components/Icons";
import { api, isApiConfigured } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type AuthMode = "login" | "register";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, loginAsPreview } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError === "google_oauth_not_configured") {
      setNotice("Google sign-in is not configured yet. You can use email and password instead.");
    } else if (oauthError === "oauth_failed") {
      setError("Google sign-in was not completed. Please try again.");
    }
  }, [searchParams]);

  const handleGoogleLogin = () => {
    if (!isApiConfigured && !import.meta.env.VITE_GOOGLE_AUTH_URL) {
      setError("Add VITE_API_URL to apps/web/.env before connecting to ReachInbox.");
      return;
    }
    window.location.assign(api.getGoogleAuthUrl());
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (mode === "register" && !name.trim()) {
      setError("Tell us your name to create your workspace.");
      return;
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "register") await register(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "We could not complete that request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const enterPreview = () => {
    loginAsPreview();
    navigate("/dashboard", { replace: true });
  };

  return (
    <main className="auth-page">
      <header className="auth-header">
        <a href="/login" className="brand-lockup auth-brand" aria-label="ReachInbox home">
          <span className="brand-mark"><LogoMark size={25} /></span>
          <span className="brand-wordmark">reach<span>inbox</span></span>
        </a>
        <span className="auth-header-note">A calmer way to send</span>
      </header>

      <section className="auth-layout">
        <div className="auth-story">
          <span className="auth-eyebrow"><span /> EMAIL, WITH INTENTION</span>
          <h1>Keep every send<br /><em>close to human.</em></h1>
          <p>ReachInbox gives your outreach a clear place to land — from the first recipient chip to the last delivery.</p>
          <ul className="auth-points">
            <li><span><CheckIcon size={14} /></span> Schedule at a pace your team can trust</li>
            <li><span><CheckIcon size={14} /></span> See every message before and after send</li>
            <li><span><CheckIcon size={14} /></span> Keep your data connected to your workspace</li>
          </ul>
        </div>

        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-card-heading">
            <span className="auth-card-icon"><MailIcon size={18} /></span>
            <span className="auth-kicker">ReachInbox workspace</span>
            <h2 id="auth-title">{mode === "login" ? "Welcome back." : "Make room for better sends."}</h2>
            <p>{mode === "login" ? "Sign in to pick up where you left off." : "Create your account and start scheduling with care."}</p>
          </div>

          <button type="button" className="google-button" onClick={handleGoogleLogin}>
            <GoogleIcon size={18} />
            <span>Continue with Google</span>
            <ArrowRightIcon size={16} />
          </button>

          <div className="auth-divider"><span>or use your email</span></div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <label className="auth-field">
                <span>Name</span>
                <span className="auth-input-wrap"><UserIcon size={16} /><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Your name" /></span>
              </label>
            ) : null}
            <label className="auth-field">
              <span>Email</span>
              <span className="auth-input-wrap"><MailIcon size={16} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@company.com" /></span>
            </label>
            <label className="auth-field">
              <span>Password <small>{mode === "register" ? "8+ characters" : ""}</small></span>
              <span className="auth-input-wrap"><LockIcon size={16} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="••••••••" /></span>
            </label>

            {notice ? <div className="auth-message auth-message-info" role="status"><LockIcon size={14} />{notice}</div> : null}
            {error ? <div className="auth-message auth-message-error" role="alert"><span>!</span>{error}</div> : null}

            <button type="submit" className="button button-primary auth-submit" disabled={isSubmitting}>
              {isSubmitting ? <span className="button-spinner" /> : null}
              {isSubmitting ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
              {!isSubmitting ? <ArrowRightIcon size={16} /> : null}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login" ? "New to ReachInbox?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setNotice(""); }}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>

          {import.meta.env.VITE_DEMO_MODE === "true" ? (
            <>
              <div className="auth-divider auth-divider-small"><span>preview</span></div>
              <button type="button" className="preview-button" onClick={enterPreview}>Explore the demo workspace <ArrowRightIcon size={15} /></button>
            </>
          ) : null}

          <p className="auth-legal">By continuing, you agree to the ReachInbox Terms and Privacy Policy.</p>
        </section>
      </section>

      <footer className="auth-footer"><span>© 2026 ReachInbox</span><span><span className="status-light" /> Systems operational</span><span>help@reachinbox.co</span></footer>
    </main>
  );
}
