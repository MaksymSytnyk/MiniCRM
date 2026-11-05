import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation, Link, useNavigate } from "@/lib/router";
import {
  LayoutDashboard,
  Users,
  Contact,
  BriefcaseBusiness,
  CheckSquare,
  ChartNoAxesCombined,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Command,
  ArrowUpRight,
  X,
  Plus,
  Menu,
  Check,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { useQuery, useDebounced } from "@/lib/hooks";
import { type CRMRecord, type Page, type Kind, recordName } from "@/lib/types";
import { Avatar, Badge } from "./shared";
import { Button } from "./ui/button";
import { dateLabel } from "@/lib/utils";
const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/leads", label: "Leads", icon: Contact },
  { to: "/deals", label: "Deals", icon: BriefcaseBusiness },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
];
export function Logo() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <span />
        <span />
        <span />
      </span>
      <span>
        folio<span className="brand-period">.</span>
      </span>
    </div>
  );
}
export function Layout({ children }: { children: import("react").ReactNode }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(
    localStorage.getItem("sidebar-collapsed") === "true",
  );
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [profile, setProfile] = useState(false);
  const [search, setSearch] = useState("");
  const [focus, setFocus] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const term = useDebounced(search);
  const clients = useQuery<Page<CRMRecord>>(
    term ? `/clients?q=${encodeURIComponent(term)}&page_size=4` : null,
  );
  const leads = useQuery<Page<CRMRecord>>(
    term ? `/leads?q=${encodeURIComponent(term)}&page_size=4` : null,
  );
  const deals = useQuery<Page<CRMRecord>>(
    term ? `/deals?q=${encodeURIComponent(term)}&page_size=4` : null,
  );
  const tasks = useQuery<Page<CRMRecord>>(
    term ? `/tasks?q=${encodeURIComponent(term)}&page_size=4` : null,
  );
  const upcoming = useQuery<Page<CRMRecord>>(
    "/tasks?status=Pending&sort=due_date&order=asc&page_size=5",
  );
  useEffect(() => {
    setMobile(false);
    setSearch("");
    setNotifications(false);
    setProfile(false);
  }, [location.pathname]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape") {
        setFocus(false);
        setNotifications(false);
        setProfile(false);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  const groups: [Kind, typeof clients][] = [
    ["clients", clients],
    ["leads", leads],
    ["deals", deals],
    ["tasks", tasks],
  ];
  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Link to="/" aria-label="Folio overview">
          <Logo />
        </Link>
        <div className="workspace-label">
          <span className="workspace-icon">
            {user?.company?.[0] || user?.full_name?.[0] || "W"}
          </span>
          <span className="sidebar-text">
            {user?.company || "My workspace"}
            <small>Personal workspace</small>
          </span>
          <ChevronDown size={14} className="sidebar-text" />
        </div>
        <div className="nav-label sidebar-text">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              title={collapsed ? n.label : undefined}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <n.icon size={18} />
              <span className="sidebar-text">{n.label}</span>
              {n.to === "/tasks" && !!upcoming.data?.total && (
                <span className="nav-count sidebar-text">
                  {upcoming.data.total}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Settings size={18} />
            <span className="sidebar-text">Settings</span>
          </NavLink>
          <button
            className="nav-item collapse-control"
            onClick={() =>
              setCollapsed((v) => {
                localStorage.setItem("sidebar-collapsed", String(!v));
                return !v;
              })
            }
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
            <span className="sidebar-text">Collapse sidebar</span>
          </button>
          <div className="profile-area">
            <button
              className="profile-button"
              onClick={() => setProfile(!profile)}
              aria-expanded={profile}
            >
              <Avatar name={user?.full_name || ""} />
              <span className="sidebar-text">
                <strong>{user?.full_name}</strong>
                <small>Personal account</small>
              </span>
              <ChevronDown size={14} className="sidebar-text" />
            </button>
            {profile && (
              <div className="profile-menu">
                <Link to="/settings">
                  <Settings size={15} />
                  Account settings
                </Link>
                <button
                  onClick={() => logout().catch((e) => toast.error(e.message))}
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            Workspace<span>/</span>
            <strong>
              {nav.find((n) =>
                n.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(n.to),
              )?.label || "Settings"}
            </strong>
          </div>
          <div className="topbar-right">
            <div
              className="global-search"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false);
              }}
            >
              <Search size={16} />
              <input
                ref={input}
                placeholder="Search anything…"
                aria-label="Search workspace"
                value={search}
                onFocus={() => setFocus(true)}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>
                <Command size={10} /> K
              </kbd>
              {focus && term && (
                <div className="search-results">
                  {groups.some(([, q]) => q.loading) ? (
                    <p>Searching your workspace…</p>
                  ) : groups.some(([, q]) => q.error) ? (
                    <p>Search is unavailable. Please try again.</p>
                  ) : groups.every(([, q]) => !q.data?.items.length) ? (
                    <p>No results for “{term}”</p>
                  ) : (
                    groups.map(([kind, q]) =>
                      q.data?.items.length ? (
                        <div key={kind}>
                          <h4>{kind}</h4>
                          {q.data.items.map((r) => (
                            <button
                              key={r.id}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                navigate(
                                  kind === "clients"
                                    ? `/clients/${r.id}`
                                    : `/${kind}?q=${encodeURIComponent(recordName(r))}`,
                                );
                                setSearch("");
                                setFocus(false);
                              }}
                            >
                              {recordName(r)}
                              <ArrowUpRight size={14} />
                            </button>
                          ))}
                        </div>
                      ) : null,
                    )
                  )}
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <div className="notification-wrap">
              <button
                aria-label="Notifications"
                className="notification-button"
                onClick={() => setNotifications(!notifications)}
                aria-expanded={notifications}
              >
                <Bell size={19} />
                {!!upcoming.data?.total && <i />}
              </button>
              {notifications && (
                <div className="notification-panel">
                  <div className="section-heading">
                    <h2>Your next steps</h2>
                    <button
                      aria-label="Close notifications"
                      onClick={() => setNotifications(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {upcoming.error ? (
                    <p className="muted">{upcoming.error}</p>
                  ) : upcoming.loading ? (
                    <p className="muted">Loading reminders…</p>
                  ) : upcoming.data?.items.length ? (
                    upcoming.data.items.map((t) => (
                      <Link
                        to={`/tasks?q=${encodeURIComponent(t.title || "")}`}
                        key={t.id}
                      >
                        <CheckSquare size={16} />
                        <span>
                          {t.title}
                          <small>
                            {t.due_date
                              ? `Due ${dateLabel(t.due_date)}`
                              : "No due date"}
                          </small>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="muted">
                      You’re all caught up. No pending tasks.
                    </p>
                  )}
                </div>
              )}
            </div>
            <Link to="/settings" aria-label="Your profile">
              <Avatar size="small" name={user?.full_name || ""} />
            </Link>
          </div>
        </header>
        <main key={location.pathname}>{children}</main>
        <footer>
          <span>
            <span className="status-dot" />
            Your workspace. Your momentum.
          </span>
          <span>Made for the way you work.</span>
        </footer>
      </div>
    </div>
  );
}
