import { useState } from "react";
import {
  UserRound,
  LockKeyhole,
  Palette,
  Trash2,
  Check,
  Loader2,
  Monitor,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { send, setAccessToken } from "@/lib/api";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { Avatar } from "@/components/shared";
export function Settings() {
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user!.full_name);
  const [company, setCompany] = useState(user!.company);
  const [theme, setTheme] = useState(user!.theme);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function profile(e: React.FormEvent) {
    e.preventDefault();
    setBusy("profile");
    try {
      const u = await send<User>("/auth/me", "PUT", {
        full_name: name,
        company,
        theme,
      });
      setUser(u);
      toast.success("Profile preferences saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("New passwords do not match");
      return;
    }
    setBusy("password");
    try {
      await send("/auth/password", "POST", {
        current_password: current,
        new_password: password,
      });
      setAccessToken(null);
      setUser(null);
      toast.success("Password changed. Sign in with your new password.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy("delete");
    setError("");
    try {
      await send("/auth/me", "DELETE", { password: deletePassword });
      setAccessToken(null);
      setUser(null);
      toast.success("Your account and workspace have been deleted");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE YOURSELF AT HOME</div>
          <h1>
            Settings<span className="heading-dot">.</span>
          </h1>
          <p>A workspace that works the way you do.</p>
        </div>
      </div>
      <div className="settings-layout">
        <div className="settings-nav">
          <a href="#profile">
            <UserRound size={16} />
            Profile & preferences
          </a>
          <a href="#security">
            <LockKeyhole size={16} />
            Password & security
          </a>
          <a href="#account">
            <Trash2 size={16} />
            Account
          </a>
        </div>
        <div className="settings-sections">
          <section id="profile" className="panel settings-panel">
            <div className="settings-section-heading">
              <span className="settings-icon">
                <UserRound size={18} />
              </span>
              <div>
                <h2>Your profile</h2>
                <p>The person behind the good work.</p>
              </div>
            </div>
            <div className="settings-avatar">
              <Avatar name={user!.full_name} size="large" />
              <div>
                <strong>{user!.full_name}</strong>
                <span>{user!.email}</span>
              </div>
            </div>
            <form onSubmit={profile}>
              <div className="form-grid">
                <label>
                  Full name
                  <Input
                    required
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Company / workspace name
                  <Input
                    maxLength={200}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </label>
                <label className="span-2">
                  Email address
                  <Input value={user!.email} disabled />
                  <small>Your account’s sign-in address.</small>
                </label>
              </div>
              <div className="theme-settings">
                <h3>
                  <Palette size={16} />
                  Appearance
                </h3>
                <p>Choose the view that feels right.</p>
                <div className="theme-options">
                  {(
                    [
                      { value: "dark", label: "Dark", icon: Moon },
                      { value: "light", label: "Light", icon: Sun },
                      { value: "system", label: "System", icon: Monitor },
                    ] as const
                  ).map((t) => (
                    <button
                      type="button"
                      key={t.value}
                      className={`theme-option ${theme === t.value ? "selected" : ""}`}
                      onClick={() => setTheme(t.value)}
                    >
                      <span className={`theme-preview ${t.value}`}>
                        <i />
                        <i />
                        <i />
                      </span>
                      <span>
                        <t.icon size={14} />
                        {t.label}
                        {theme === t.value && <Check size={13} />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-form-footer">
                <span>Changes take effect when you save.</span>
                <Button disabled={!!busy}>
                  {busy === "profile" && <Loader2 className="animate-spin" />}
                  Save changes
                </Button>
              </div>
            </form>
          </section>
          <section id="security" className="panel settings-panel">
            <div className="settings-section-heading">
              <span className="settings-icon">
                <LockKeyhole size={18} />
              </span>
              <div>
                <h2>Password & security</h2>
                <p>Keep your workspace in good hands.</p>
              </div>
            </div>
            <form onSubmit={changePassword}>
              <div className="form-grid">
                <label className="span-2">
                  Current password
                  <Input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                  />
                </label>
                <label>
                  New password
                  <Input
                    type="password"
                    required
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <small>At least 10 characters.</small>
                </label>
                <label>
                  Confirm new password
                  <Input
                    type="password"
                    required
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
              </div>
              <div className="settings-form-footer">
                <span>Updating your password signs out all sessions.</span>
                <Button variant="outline" disabled={!!busy}>
                  Update password
                </Button>
              </div>
            </form>
          </section>
          <section id="account" className="panel settings-panel">
            <div className="settings-section-heading">
              <span className="settings-icon">
                <Trash2 size={18} />
              </span>
              <div>
                <h2>Account management</h2>
                <p>You’re always in control of your workspace.</p>
              </div>
            </div>
            <div className="account-action">
              <div>
                <strong>Sign out</strong>
                <p>See you when you’re ready for your next step.</p>
              </div>
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() => logout().catch((e) => toast.error(e.message))}
              >
                <LogOut />
                Sign out
              </Button>
            </div>
            <div className="account-action danger">
              <div>
                <strong>Delete account</strong>
                <p>Permanently delete your account and all CRM data.</p>
              </div>
              <Button variant="outline" onClick={() => setDeleting(true)}>
                Delete account
              </Button>
            </div>
          </section>
        </div>
      </div>
      <Modal
        open={deleting}
        onOpenChange={(v) => {
          if (!busy) setDeleting(v);
        }}
        title="Delete your workspace?"
        description="This permanently deletes your account, clients, leads, deals, tasks, tags, and activity. This cannot be undone. Enter your password to confirm."
      >
        <form onSubmit={remove}>
          <label>
            Your password
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              disabled={!!busy}
              onClick={() => setDeleting(false)}
            >
              Keep my account
            </Button>
            <Button variant="destructive" disabled={!!busy}>
              {busy === "delete" ? "Deleting…" : "Delete everything"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
