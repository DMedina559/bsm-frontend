import {
  selectInstance,
  getInstanceIssue,
  subscribeInstances,
  ACTIVE_INSTANCE_KEY,
} from "./app/instanceProfiles";
import RuntimeHistoryProvider from "./contexts/RuntimeHistoryProvider";
import TimeProvider from "./contexts/TimeProvider";
import { sessionSettings } from "./app/browserStorage";
import { application } from "./app/application";
import { setApiBaseUrl } from "./app/connection";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./app/queryClient";
import SecurityVerification from "./components/access/SecurityVerification";
import DraftNavigationGuard from "./components/DraftNavigationGuard";
import { DialogProvider } from "./contexts/DialogContext";
import React, { Suspense, lazy } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth, AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ServerProvider } from "./contexts/ServerContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Layout from "./layouts/Layout";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Register from "./pages/Register";
const ApplicationMonitor = lazy(() => import("./pages/ApplicationMonitor"));
const Monitor = lazy(() => import("./pages/Monitor"));
const Overview = lazy(() => import("./pages/Overview"));
const Scheduler = lazy(() => import("./pages/Scheduler"));
const Backups = lazy(() => import("./pages/Backups"));
const ServerProperties = lazy(() => import("./pages/ServerProperties"));
const BSMSettings = lazy(() => import("./pages/BSMSettings"));
const Content = lazy(() => import("./pages/Content"));
const Users = lazy(() => import("./pages/Users"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const Account = lazy(() => import("./pages/Account"));
const FrontendSettings = lazy(() => import("./pages/FrontendSettings"));
const PluginSettings = lazy(() => import("./pages/PluginSettings"));
const Plugins = lazy(() => import("./pages/Plugins"));
const ServerConfig = lazy(() => import("./pages/ServerConfig"));
const AccessControl = lazy(() => import("./pages/AccessControl"));
const ServerInstall = lazy(() => import("./pages/ServerInstall"));
const GlobalPlayers = lazy(() => import("./pages/GlobalPlayers"));
const OnlinePlayers = lazy(() => import("./pages/OnlinePlayers"));
const DynamicPage = lazy(() => import("./pages/DynamicPage"));
const ApiExplorer = lazy(() => import("./pages/ApiExplorer"));
const Instances = lazy(() => import("./pages/Instances"));
const Playground = lazy(() => import("./pages/Playground"));

const PrivateRoute = ({ children }) => {
  const { user, loading, needsSetup } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div role="status">Loading…</div>;
  }

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { needsSetup, loading } = useAuth();
  const location = useLocation();
  const instanceIssue = React.useSyncExternalStore(
    subscribeInstances,
    getInstanceIssue,
    () => null,
  );
  if (instanceIssue && location.pathname !== "/instances")
    return (
      <main className="instances-page">
        <h1>Connection unavailable</h1>
        <p role="alert">{instanceIssue}</p>
        <Link className="instance-button primary" to="/instances">
          Choose an instance
        </Link>
        <button
          className="instance-button"
          onClick={() => {
            selectInstance(null);
            window.location.reload();
          }}
        >
          Use default connection
        </button>
      </main>
    );

  if (loading && location.pathname !== "/instances") {
    return <div role="status">Loading…</div>;
  }

  return (
    <Routes>
      <Route path="/instances" element={<Instances />} />
      <Route
        path="/login"
        element={needsSetup ? <Navigate to="/setup" /> : <Login />}
      />
      <Route
        path="/setup"
        element={needsSetup ? <Setup /> : <Navigate to="/" replace />}
      />
      <Route path="/register/:token" element={<Register />} />{" "}
      {/* Public route with token */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Overview />} />
        <Route path="application-monitor" element={<ApplicationMonitor />} />
        <Route path="monitor" element={<Monitor />} />
        <Route path="backups" element={<Backups />} />
        <Route path="scheduler" element={<Scheduler />} />
        <Route path="server-properties" element={<ServerProperties />} />
        <Route path="server-config" element={<ServerConfig />} />
        <Route path="access-control" element={<AccessControl />} />
        <Route path="online-players" element={<OnlinePlayers />} />
        <Route path="bsm-settings" element={<BSMSettings />} />
        <Route path="content" element={<Content />} />
        <Route path="plugins" element={<Plugins />} />
        <Route path="plugin-settings" element={<PluginSettings />} />
        <Route path="users" element={<Users />} />
        <Route path="global-players" element={<GlobalPlayers />} />
        <Route path="audit-log" element={<AuditLog />} />
        <Route path="account" element={<Account />} />
        <Route path="frontend-settings" element={<FrontendSettings />} />
        <Route
          path="appearance"
          element={<Navigate to="/frontend-settings?tab=appearance" replace />}
        />
        <Route path="server-install" element={<ServerInstall />} />
        <Route path="plugin-native-view" element={<DynamicPage />} />
        <Route path="api-explorer" element={<ApiExplorer />} />
        <Route path="playground" element={<Playground />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App = () => {
  // Check for hidden trigger (?hidden=true/false)
  React.useEffect(() => {
    const checkHiddenFlag = () => {
      const params = new URLSearchParams(window.location.search);
      const hidden = params.get("hidden");

      if (hidden === "true") {
        sessionSettings.setItem("show_hidden_flag", "true");
        // Clean URL without reloading
        const instance = params.get("instance");
        if (instance) {
          try {
            selectInstance(instance);
          } catch {
            sessionSettings.setItem(ACTIVE_INSTANCE_KEY, instance);
          }
        }
        params.delete("hidden");
        params.delete("instance");
        const newUrl =
          window.location.pathname + (params.size ? `?${params}` : "");
        window.history.replaceState({}, "", newUrl);
        // Force a re-render to ensure components pick up the change immediately
        window.location.reload();
      } else if (hidden === "false") {
        sessionSettings.removeItem("show_hidden_flag");
        setApiBaseUrl("");
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
        window.location.reload();
      } else if (
        params.has("instance") &&
        sessionSettings.getItem("show_hidden_flag") === "true"
      ) {
        try {
          selectInstance(params.get("instance"));
        } catch {
          sessionSettings.setItem(ACTIVE_INSTANCE_KEY, params.get("instance"));
        }
        params.delete("instance");
        window.history.replaceState(
          {},
          "",
          window.location.pathname + (params.size ? `?${params}` : ""),
        );
      }
    };

    checkHiddenFlag();
    // Also check on popstate in case URL changes without full reload
    window.addEventListener("popstate", checkHiddenFlag);
    return () => {
      window.removeEventListener("popstate", checkHiddenFlag);
      application.dispose();
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RuntimeHistoryProvider>
            <TimeProvider>
              <ThemeProvider>
                <ToastProvider>
                  <DialogProvider>
                    <DraftNavigationGuard />
                    <SecurityVerification />
                    <WebSocketProvider>
                      <ServerProvider>
                        <ErrorBoundary>
                          <Suspense
                            fallback={
                              <div className="app-loading" role="status">
                                Loading workspace…
                              </div>
                            }
                          >
                            <AppRoutes />
                          </Suspense>
                        </ErrorBoundary>
                      </ServerProvider>
                    </WebSocketProvider>
                  </DialogProvider>
                </ToastProvider>
              </ThemeProvider>
            </TimeProvider>
          </RuntimeHistoryProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
