import {
  trustedDeviceOptions,
  rememberTrustedDevice,
} from "../../app/trustedDevices";
import { getConnectionIdentity } from "../../app/connection";
import { useTimeFormat } from "../../app/useTimeFormat";
import React, { useEffect, useRef, useState } from "react";
import Modal from "../Modal";
import { callOperation } from "../../api/operations";
import {
  getBackendIdentity,
  getPreferenceIdentity,
} from "../../app/backendIdentity";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { queryClient } from "../../app/queryClient";

export default function SecurityVerification() {
  const { user, sessionGeneration } = useAuth();
  const { addToast } = useToast();
  const time = useTimeFormat();
  const [rememberDevice, setRememberDevice] = useState(false);
  const [trustedUntil, setTrustedUntil] = useState(null);
  const userId = user?.id;
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsFactor, setNeedsFactor] = useState(false);
  const controller = useRef(null);
  useEffect(() => {
    setOpen(false);
    setPassword("");
    setOtp("");
    setError("");
    setBusy(false);
    const show = (event) => {
      if (
        userId != null &&
        (!event.detail?.backend ||
          event.detail.backend === getBackendIdentity())
      ) {
        setError("");
        setPassword("");
        setOtp("");
        setOpen(true);
        setNeedsFactor(false);
        setRememberDevice(false);
        setTrustedUntil(null);
        controller.current?.abort();
        const statusRequest = new AbortController();
        controller.current = statusRequest;
        void callOperation("get_account_security", {
          signal: statusRequest.signal,
          ...trustedDeviceOptions(user?.username),
        })
          .then((status) => {
            if (!statusRequest.signal.aborted) {
              setNeedsFactor(
                status.enabled === true && status.trusted_device !== true,
              );
              setTrustedUntil(
                status.trusted_device ? status.trusted_device_expires_at : null,
              );
            }
          })
          .catch(() => {});
      }
    };
    window.addEventListener("bsm:security-verification-required", show);
    return () => {
      controller.current?.abort();
      window.removeEventListener("bsm:security-verification-required", show);
    };
  }, [userId, user?.username, sessionGeneration]);
  const close = () => {
    controller.current?.abort();
    setOpen(false);
    setPassword("");
    setOtp("");
    setBusy(false);
  };
  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const backend = getConnectionIdentity();
      const result = await callOperation("verify_account_security", {
        body: {
          password,
          otp,
          ...(rememberDevice ? { remember_device: true } : {}),
        },
        ...trustedDeviceOptions(user?.username),
        signal: abort.signal,
      });
      if (abort.signal.aborted) return;
      if (rememberDevice)
        rememberTrustedDevice(user?.username, result, backend);
      await queryClient.invalidateQueries({
        queryKey: ["account-security", getPreferenceIdentity(user)],
      });
      await queryClient.invalidateQueries({
        queryKey: ["trusted-devices", getPreferenceIdentity(user)],
      });
      close();
      addToast(
        "Identity verified. You can retry the security action.",
        "success",
      );
    } catch (failure) {
      if (!abort.signal.aborted) {
        if (failure.mfaRequired) {
          setNeedsFactor(true);
          setTrustedUntil(null);
        }
        setError(failure.message);
      }
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return open ? (
    <Modal title="Verify your identity" onClose={close} closeDisabled={busy}>
      <p>
        Security changes require a recent password check. Verification lasts
        five minutes and does not extend your login.
      </p>
      {trustedUntil && (
        <p>
          This device is remembered until{" "}
          {time.format(trustedUntil, { unit: "seconds" })}. Enter your current
          password to continue.
        </p>
      )}
      <form onSubmit={verify} className="security-form">
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={user?.username ?? ""}
          readOnly
          hidden
        />
        <label className="form-label">
          Current password
          <input
            className="form-input"
            type="password"
            name="current-password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={busy}
          />
        </label>
        {needsFactor && (
          <label className="form-label">
            Authenticator or recovery code
            <input
              className="form-input"
              autoComplete="one-time-code"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              maxLength={128}
              disabled={busy}
            />
          </label>
        )}
        {needsFactor && (
          <label className="sign-in-remember">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(event) => setRememberDevice(event.target.checked)}
              disabled={busy}
            />
            Remember this device for 30 days
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        <button className="action-button primary-button" disabled={busy}>
          {busy ? "Verifying…" : "Verify identity"}
        </button>
      </form>
    </Modal>
  ) : null;
}
