import React, { useEffect, useId, useRef, useState } from "react";
import { isPasskeySupported } from "../../app/passkeys";

/** Secrets live only in this form; connection changes unmount it and abort requests. */
export default function SignInForm({
  onPassword,
  onPasskey,
  onToken,
  onSuccess,
  onChallengeChange,
  embedded = false,
  variant = "main",
  disabled = false,
}) {
  const passkeyAvailable = Boolean(onPasskey) && isPasskeySupported();
  const [method, setMethod] = useState("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState(false);
  const [remember, setRemember] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef(null);
  const id = useId();
  useEffect(() => () => controller.current?.abort(), []);
  function changeMethod(value) {
    controller.current?.abort();
    setMethod(value);
    setPassword("");
    setToken("");
    setOtp("");
    setChallenge(false);
    setError("");
    setRemember(false);
    setRememberDevice(false);
    setBusy(false);
    onChallengeChange?.("");
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || disabled) return;
    const request = new AbortController();
    controller.current = request;
    const signal = request.signal;
    setBusy(true);
    setError("");
    let retainPassword = false;
    try {
      const result =
        method === "token"
          ? await onToken(token, remember, signal)
          : method === "passkey"
            ? await onPasskey({ username, remember }, signal)
            : await onPassword(
                {
                  username,
                  password,
                  remember,
                  otp,
                  ...(rememberDevice ? { rememberDevice: true } : {}),
                },
                signal,
              );
      if (signal.aborted) return;
      onSuccess?.(result);
    } catch (failure) {
      if (signal.aborted || failure.name === "AbortError") return;
      if (method === "password" && failure.mfaRequired) {
        retainPassword = true;
        setChallenge(true);
        onChallengeChange?.(username);
      } else {
        retainPassword = challenge;
        setError(
          failure.status === 401 && method === "password"
            ? challenge
              ? "Invalid verification code. Try again or use a recovery code."
              : "Invalid username or password"
            : failure.message ||
                "Unable to sign in. Check your connection and try again.",
        );
      }
    } finally {
      if (!signal.aborted) {
        setBusy(false);
        setToken("");
        setOtp("");
        if (!retainPassword) setPassword("");
      }
    }
  }
  const selector = (
    <>
      <label className="form-label" htmlFor={`${id}-method`}>
        Sign in with
      </label>
      <select
        id={`${id}-method`}
        className="form-input"
        value={method}
        disabled={busy || disabled}
        onChange={(event) => changeMethod(event.target.value)}
      >
        <option value="password">Username &amp; password</option>
        {Boolean(onPasskey) && <option value="passkey">Passkey</option>}
        <option value="token">API token</option>
      </select>
    </>
  );
  const unavailable =
    busy || disabled || (method === "passkey" && !passkeyAvailable);
  return (
    <form
      onSubmit={submit}
      className={
        variant === "instance" ? "instance-login" : "form-group sign-in-form"
      }
      aria-busy={busy}
    >
      {!challenge &&
        (embedded ? (
          <details className="sign-in-methods">
            <summary>Other sign-in methods</summary>
            {selector}
          </details>
        ) : (
          selector
        ))}
      {method === "password" && !challenge && (
        <div
          className={
            variant === "instance" ? "instance-login-fields" : "sign-in-fields"
          }
        >
          <label className="form-label" htmlFor={`${id}-username`}>
            Username
            <input
              className="form-input"
              id={`${id}-username`}
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={unavailable}
            />
          </label>
          <label className="form-label" htmlFor={`${id}-password`}>
            Password
            <input
              className="form-input"
              id={`${id}-password`}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={unavailable}
            />
          </label>
        </div>
      )}
      {method === "passkey" && !challenge && (
        <div
          className={
            variant === "instance" ? "instance-login-fields" : "sign-in-fields"
          }
        >
          <label className="form-label" htmlFor={`${id}-passkey-username`}>
            Username (optional)
            <input
              className="form-input"
              id={`${id}-passkey-username`}
              name="username"
              autoComplete="username webauthn"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={unavailable}
            />
          </label>
          <p className="help-text">
            {passkeyAvailable
              ? "Optional for discoverable passkeys. Enter your username if using a security key without a resident credential."
              : "This browser or connection does not support WebAuthn passkeys."}
          </p>
        </div>
      )}
      {method === "token" && (
        <>
          <label className="form-label" htmlFor={`${id}-token`}>
            API token
            <input
              className="form-input"
              id={`${id}-token`}
              type="password"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              disabled={unavailable}
            />
          </label>
          <p className="help-text">
            Use an integration token with account:read permission. Access is
            limited to the token’s permissions and assigned servers. Signing out
            only forgets it here; it does not revoke the token.
          </p>
          <label className="form-label" htmlFor={`${id}-storage`}>
            Token storage
          </label>
          <select
            className="form-input"
            id={`${id}-storage`}
            value={remember ? "remember" : "tab"}
            onChange={(e) => setRemember(e.target.value === "remember")}
            disabled={unavailable}
          >
            <option value="tab">This tab only</option>
            <option value="remember">Remember on this browser</option>
          </select>
        </>
      )}
      {challenge && (
        <label className="form-label" htmlFor={`${id}-otp`}>
          Authenticator or recovery code
          <input
            className="form-input"
            id={`${id}-otp`}
            autoComplete="one-time-code"
            maxLength={128}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
            autoFocus
            disabled={unavailable}
          />
        </label>
      )}
      {challenge && (
        <label className="sign-in-remember">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(event) => setRememberDevice(event.target.checked)}
            disabled={unavailable}
          />
          Remember this device for 30 days
        </label>
      )}
      {(method === "password" || method === "passkey") && !challenge && (
        <label className="sign-in-remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={unavailable}
          />
          {variant === "instance" ? "Remember this instance" : "Remember me"}
        </label>
      )}
      {error && (
        <div className="message message-error" role="alert">
          {error}
        </div>
      )}
      <button
        type="submit"
        className={
          variant === "instance"
            ? "instance-button primary"
            : "button button-primary"
        }
        disabled={unavailable}
      >
        {busy
          ? "Signing in…"
          : challenge
            ? "Verify and sign in"
            : method === "passkey"
              ? "Sign in with passkey"
              : variant === "instance"
                ? "Sign in"
                : "Sign In"}
      </button>
      {challenge && (
        <button
          type="button"
          className={
            variant === "instance"
              ? "instance-button"
              : "action-button secondary"
          }
          disabled={busy}
          onClick={() => changeMethod("password")}
        >
          Back to sign in
        </button>
      )}
    </form>
  );
}
