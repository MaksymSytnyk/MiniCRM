import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, useLocation } from "@/lib/router";
import { Toaster } from "@/components/ui/toast";
import { AuthProvider, useAuth } from "./lib/auth";
import { Layout } from "./components/layout";
import { Loading } from "./components/shared";
import { Dashboard } from "./pages/dashboard";
import { RecordsPage } from "./pages/records";
import { ClientProfile } from "./pages/client-profile";
import { Settings } from "./pages/settings";
import { AuthPage } from "./pages/auth";
import "./index.css";
function App() {
  const useLocationSafe = useLocation();
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="boot-screen">
        <span className="brand-symbol">
          <span />
          <span />
          <span />
        </span>
        <Loading />
      </div>
    );
  if (!user) return <AuthPage />;
  const path = useLocationSafe.pathname;
  let page: React.ReactNode;
  if (path === "/") page = <Dashboard key="overview" />;
  else if (path === "/analytics")
    page = <Dashboard key="analytics" analytics />;
  else if (path === "/settings") page = <Settings />;
  else if (/^\/clients\/[^/]+$/.test(path)) page = <ClientProfile />;
  else if (["clients", "leads", "deals", "tasks"].includes(path.slice(1)))
    page = (
      <RecordsPage
        key={path + useLocationSafe.search}
        kind={path.slice(1) as import("./lib/types").Kind}
      />
    );
  else
    page = (
      <div className="empty-state">
        <h1>A little off track.</h1>
        <p>This page doesn’t exist.</p>
        <Link to="/">Back to overview →</Link>
      </div>
    );
  return <Layout>{page}</Layout>;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="empty-state">
        <h1>Let’s take a fresh look.</h1>
        <p>The workspace encountered an unexpected error.</p>
        <button onClick={() => window.location.reload()}>
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>,
);
