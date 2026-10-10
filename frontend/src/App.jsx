import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./app/queryClient";
import DraftNavigationGuard from "./components/DraftNavigationGuard";
import { DialogProvider } from "./contexts/DialogContext";
import React, { Suspense, lazy } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth, AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ServerProvider } from "./contexts/ServerContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Layout from "./layouts/Layout";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Register from "./pages/Register";
const Monitor = lazy(() => import("./pages/Monitor"));
const Overview = lazy(() => import("./pages/Overview"));
const Backups = lazy(() => import("./pages/Backups"));
const ServerProperties = lazy(() => import("./pages/ServerProperties"));
const BSMSettings = lazy(() => import("./pages/BSMSettings"));
const Content = lazy(() => import("./pages/Content"));
const Users = lazy(() => import("./pages/Users"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const Account = lazy(() => import("./pages/Account"));
const Plugins = lazy(() => import("./pages/Plugins"));
const ServerConfig = lazy(() => import("./pages/ServerConfig"));
const AccessControl = lazy(() => import("./pages/AccessControl"));
const ServerInstall = lazy(() => import("./pages/ServerInstall"));
const GlobalPlayers = lazy(() => import("./pages/GlobalPlayers"));
const OnlinePlayers = lazy(() => import("./pages/OnlinePlayers"));
const DynamicPage = lazy(() => import("./pages/DynamicPage"));
const Playground = lazy(() => import("./pages/Playground"));

const PrivateRoute = ({ children }) => {
  const { user, loading, needsSetup } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
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
        <Route path="monitor" element={<Monitor />} />
        <Route path="backups" element={<Backups />} />
        <Route path="server-properties" element={<ServerProperties />} />
        <Route path="server-config" element={<ServerConfig />} />
        <Route path="access-control" element={<AccessControl />} />
        <Route path="online-players" element={<OnlinePlayers />} />
        <Route path="bsm-settings" element={<BSMSettings />} />
        <Route path="content" element={<Content />} />
        <Route path="plugins" element={<Plugins />} />
        <Route path="users" element={<Users />} />
        <Route path="global-players" element={<GlobalPlayers />} />
        <Route path="audit-log" element={<AuditLog />} />
        <Route path="account" element={<Account />} />
        <Route path="appearance" element={<Account appearanceOnly />} />
        <Route path="server-install" element={<ServerInstall />} />
        <Route path="plugin-native-view" element={<DynamicPage />} />
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
        sessionStorage.setItem("show_hidden_flag", "true");
        // Clean URL without reloading
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
        // Force a re-render to ensure components pick up the change immediately
        window.location.reload();
      } else if (hidden === "false") {
        sessionStorage.removeItem("show_hidden_flag");
        localStorage.removeItem("api_base_url");
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
        window.location.reload();
      }
    };

    checkHiddenFlag();
    // Also check on popstate in case URL changes without full reload
    window.addEventListener("popstate", checkHiddenFlag);
    return () => window.removeEventListener("popstate", checkHiddenFlag);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <DialogProvider>
              <DraftNavigationGuard />
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
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
