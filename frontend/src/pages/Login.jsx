import SignInForm from "../components/auth/SignInForm";
import { getBackendIdentity } from "../app/backendIdentity";
import { getAuthenticationMode } from "../app/connection";
import { sessionSettings } from "../app/browserStorage";
import { getAppConfig } from "../app/config";
import AuthBrand from "../components/AuthBrand";
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import RemoteConfigModal from "../components/RemoteConfigModal";
import { getApiBaseUrl } from "../api/transport";
import InstanceSwitcher from "../components/InstanceSwitcher";
const Login = () => {
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [challenge, setChallenge] = useState("");
  const { login, loginWithToken, user } = useAuth();
  const navigate = useNavigate();
  const showConfigButton =
    getAppConfig().mode === "standalone" ||
    sessionSettings.getItem("show_hidden_flag") === "true" ||
    !!getApiBaseUrl();
  const location = useLocation();
  const backend = getApiBaseUrl();
  useEffect(() => {
    setChallenge("");
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
          {challenge ? "Verify your sign-in" : "Welcome back"}
        </h1>
        <p className="help-text">
          {challenge
            ? `Enter an authenticator or recovery code for ${challenge}.`
            : "Sign in to Bedrock Server Manager."}
        </p>
      </div>

      <SignInForm
        key={getBackendIdentity()}
        embedded={getAuthenticationMode() !== "bearer"}
        onPassword={(
          { username, password, remember, otp, rememberDevice = false },
          signal,
        ) => login(username, password, remember, otp, signal, rememberDevice)}
        onToken={(token, remember, signal) =>
          loginWithToken(token, remember, signal)
        }
        onSuccess={() => navigate(from, { replace: true })}
        onChallengeChange={setChallenge}
      />

      <div className="login-connection">
        <InstanceSwitcher
          onConfigure={
            showConfigButton ? () => setShowRemoteModal(true) : undefined
          }
        />
      </div>

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
