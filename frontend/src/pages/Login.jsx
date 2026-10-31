import { sessionSettings } from "../app/browserStorage";
import { getAppConfig } from "../app/config";
import AuthBrand from "../components/AuthBrand";
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import RemoteConfigModal from "../components/RemoteConfigModal";
import { getApiBaseUrl } from "../api/transport";
import { Globe } from "lucide-react";
const Login = () => {
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const showConfigButton =
    getAppConfig().mode === "standalone" ||
    sessionSettings.getItem("show_hidden_flag") === "true" ||
    !!getApiBaseUrl();
  const location = useLocation();
  const backend = getApiBaseUrl();
  useEffect(() => {
    setPassword("");
    setOtp("");
    setMfaRequired(false);
    setError(null);
  }, [backend]);

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
      await login(username, password, rememberMe, otp);
      setPassword("");
      setOtp("");
      navigate(from, {
        replace: true,
      });
    } catch (error) {
      if (error.name === "AbortError") return;
      if (error.mfaRequired) {
        setMfaRequired(true);
        setOtp("");
        return;
      }
      if (mfaRequired) setOtp("");
      setError(
        error.status === 401
          ? mfaRequired
            ? "Invalid verification code. Try again or use a recovery code."
            : "Invalid username or password"
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
        marginTop: "calc(100px * var(--bsm-spacing-scale))",
      }}
    >
      <AuthBrand />
      <div
        className="header"
        style={{
          flexDirection: "column",
          gap: "calc(10px * var(--bsm-spacing-scale))",
        }}
      >
        <h1 className="auth-title">
          {mfaRequired ? "Verify your sign-in" : "Welcome back"}
        </h1>
        <p className="help-text">
          {mfaRequired
            ? `Enter an authenticator or recovery code for ${username}.`
            : "Sign in to Bedrock Server Manager."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="form-group"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "calc(15px * var(--bsm-spacing-scale))",
        }}
      >
        {!mfaRequired && (
          <>
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
          </>
        )}
        {mfaRequired && (
          <div>
            <label htmlFor="otp" className="form-label">
              Authenticator or recovery code
            </label>
            <input
              id="otp"
              className="form-input"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              autoComplete="one-time-code"
              maxLength={128}
              required
              autoFocus
              disabled={submitting}
            />
          </div>
        )}
        {!mfaRequired && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "calc(8px * var(--bsm-spacing-scale))",
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
        )}

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
          {submitting
            ? "Signing in…"
            : mfaRequired
              ? "Verify and sign in"
              : "Sign In"}
        </button>
        {mfaRequired && (
          <button
            type="button"
            className="action-button secondary"
            disabled={submitting}
            onClick={() => {
              setMfaRequired(false);
              setPassword("");
              setOtp("");
              setError(null);
            }}
          >
            Back to sign in
          </button>
        )}
      </form>

      {showConfigButton && (
        <div
          style={{
            marginTop: "calc(20px * var(--bsm-spacing-scale))",
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
              gap: "calc(5px * var(--bsm-spacing-scale))",
              fontSize: "var(--bsm-small-size)",
              textDecoration: "underline",
            }}
          >
            <Globe size={16} /> Configure Remote Server
          </button>
        </div>
      )}

      {sessionSettings.getItem("show_hidden_flag") === "true" && (
        <Link to="/instances" className="instances-login-link">
          Manage BSM instances
        </Link>
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
