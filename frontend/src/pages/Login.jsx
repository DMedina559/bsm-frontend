import AuthBrand from "../components/AuthBrand";
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import RemoteConfigModal from "../components/RemoteConfigModal";
import { getApiBaseUrl } from "../api/transport";
import { Globe } from "lucide-react";
const Login = () => {
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const showConfigButton =
    sessionStorage.getItem("show_hidden_flag") === "true" || !!getApiBaseUrl();
  const location = useLocation();

  // Where to redirect after login
  const from = location.state?.from?.pathname || "/";
  useEffect(() => {
    // If user is already logged in, redirect them
    if (user) {
      navigate("/", {
        replace: true,
      });
    }
  }, [user, navigate]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password, rememberMe);
      navigate(from, {
        replace: true,
      });
    } catch (error) {
      setError(
        error.status === 401
          ? "Invalid username or password"
          : error.message ||
              "Unable to sign in. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div
      className="container auth-page"
      style={{
        maxWidth: "400px",
        marginTop: "100px",
      }}
    >
      <AuthBrand />
      <div
        className="header"
        style={{
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <h1>Login</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="form-group"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
        }}
      >
        <div>
          <label htmlFor="username" className="form-label">
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            className="form-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            disabled={submitting}
          />
        </div>
        <div>
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={submitting}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <input
            type="checkbox"
            id="rememberMe"
            name="rememberMe"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <label
            htmlFor="rememberMe"
            style={{
              cursor: "pointer",
            }}
          >
            Remember me
          </label>
        </div>

        {error && (
          <div className="message message-error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="button button-primary"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Sign In"}
        </button>
      </form>

      {showConfigButton && (
        <div
          style={{
            marginTop: "20px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={() => setShowRemoteModal(true)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-color-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "0.9em",
              textDecoration: "underline",
            }}
          >
            <Globe size={16} /> Configure Remote Server
          </button>
        </div>
      )}

      {showRemoteModal && (
        <RemoteConfigModal
          isOpen={showRemoteModal}
          onClose={() => setShowRemoteModal(false)}
        />
      )}
    </div>
  );
};
export default Login;
