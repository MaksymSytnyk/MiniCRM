import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Loader2,
  ShieldCheck,
  BriefcaseBusiness,
  Users,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
export function AuthPage() {
  const { authenticate } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authenticate(mode, {
        email,
        password,
        ...(mode === "register" ? { full_name: name } : {}),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Logo />
        <div className="auth-story-content">
          <div className="auth-pill">
            <span className="status-dot" />A little clarity goes a long way
          </div>
          <h1>
            Less busywork.
            <br />
            More good
            <br />
            <span>business.</span>
          </h1>
          <p>
            Your relationships, opportunities, and next steps.
            <br />
            One thoughtfully simple workspace.
          </p>
          <div className="auth-illustration">
            <div className="illustration-line" />
            <div className="illustration-card one">
              <span className="activity-icon violet">
                <Users size={19} />
              </span>
              <div>
                <strong>People come first</strong>
                <small>Build relationships that last.</small>
              </div>
              <Check size={16} />
            </div>
            <div className="illustration-card two">
              <span className="activity-icon green">
                <BriefcaseBusiness size={19} />
              </span>
              <div>
                <strong>Keep moving forward</strong>
                <small>Every opportunity, in focus.</small>
              </div>
              <ArrowRight size={16} />
            </div>
          </div>
        </div>
        <span className="auth-story-footer">A calmer way to grow.</span>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <span className="auth-form-eyebrow">YOUR NEXT CHAPTER</span>
          <h2>
            {mode === "login" ? "Welcome back." : "Make room for growth."}
          </h2>
          <p>
            {mode === "login"
              ? "Good to see you. Let’s pick up where you left off."
              : "A fresh workspace. A clearer way forward."}
          </p>
          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                Full name
                <Input
                  autoComplete="name"
                  required
                  maxLength={120}
                  placeholder="Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            <label>
              Email address
              <Input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <div className="password-input">
                <Input
                  type={show ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={mode === "register" ? 10 : 1}
                  maxLength={128}
                  placeholder={
                    mode === "register"
                      ? "At least 10 characters"
                      : "Enter your password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <Button disabled={busy} className="w-full mt-2">
              {busy ? <Loader2 className="animate-spin" /> : null}
              {busy
                ? "One moment…"
                : mode === "login"
                  ? "Sign in to your workspace"
                  : "Create your workspace"}
              {!busy && <ArrowRight />}
            </Button>
          </form>
          <div className="auth-switch">
            {mode === "login" ? "New to Folio?" : "Already have a workspace?"}
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
                setPassword("");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </div>
          <div className="auth-secure">
            <ShieldCheck size={15} />
            <span>Your business stays your business.</span>
          </div>
        </div>
        <span className="auth-copyright">
          © {new Date().getFullYear()} Folio CRM. Thoughtfully simple.
        </span>
      </div>
    </div>
  );
}
