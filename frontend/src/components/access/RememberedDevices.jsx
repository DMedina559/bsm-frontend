import React, { useState, useRef, useEffect } from "react";
import { Monitor } from "lucide-react";
import { getConnectionIdentity } from "../../app/connection";
import { useQuery } from "@tanstack/react-query";
import { callOperation } from "../../api/operations";
import { queryClient } from "../../app/queryClient";
import { getPreferenceIdentity } from "../../app/backendIdentity";
import {
  forgetTrustedDevice,
  trustedDeviceOptions,
} from "../../app/trustedDevices";
import { useTimeFormat } from "../../app/useTimeFormat";
import { useAuth } from "../../contexts/AuthContext";
import { useDialog } from "../../contexts/DialogContext";

export default function RememberedDevices() {
  const { user, sessionGeneration } = useAuth();
  const { confirmAction } = useDialog();
  const time = useTimeFormat();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const identity = getPreferenceIdentity(user);
  const controller = useRef(null);
  useEffect(() => {
    setBusy(false);
    setError("");
    return () => controller.current?.abort();
  }, [identity, sessionGeneration]);
  const devices = useQuery(
    {
      queryKey: ["trusted-devices", identity, sessionGeneration],
      refetchInterval: 60000,
      enabled: Boolean(user?.id) && !user?.mfa_enrollment_required,
      queryFn: async ({ signal }) => {
        const rows = await callOperation("list_trusted_devices", {
          signal,
          ...trustedDeviceOptions(user.username),
        });
        if (!Array.isArray(rows))
          throw new Error("Invalid remembered-device response");
        return rows;
      },
    },
    queryClient,
  );
  async function revoke(device, mode) {
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    const username = user.username;
    const backend = getConnectionIdentity();
    if (
      !(await confirmAction(
        device
          ? `Forget ${device.name}? It will need an authenticator or recovery code next time.`
          : "Forget remembered devices? Existing login sessions can be ended separately under Sessions.",
      ))
    )
      return;
    if (abort.signal.aborted) return;
    setBusy(true);
    setError("");
    try {
      const options = {
        ...trustedDeviceOptions(username),
        signal: abort.signal,
      };
      if (device)
        await callOperation("revoke_trusted_device", {
          path: { device_id: device.id },
          ...options,
        });
      else
        await callOperation("revoke_trusted_devices", {
          body: { mode },
          ...options,
        });
      if (abort.signal.aborted) return;
      if (device?.current || mode === "all")
        forgetTrustedDevice(username, backend);
      await queryClient.invalidateQueries({
        queryKey: ["trusted-devices", identity],
      });
      await queryClient.invalidateQueries({
        queryKey: ["account-security", identity],
      });
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure.message);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  const rows = devices.data ?? [];
  return (
    <section aria-label="Remembered devices">
      <h3>Remembered devices</h3>
      <p>
        Remembered devices can skip OTP at sign-in and during password
        reauthentication for 30 days. Your password is still required. Removing
        this trust leaves existing login sessions signed in.
      </p>
      {(error || devices.error) && (
        <p role="alert">{error || devices.error.message}</p>
      )}
      {devices.isFetching && <p role="status">Loading remembered devices…</p>}
      <div className="form-actions">
        <button
          type="button"
          className="action-button secondary"
          disabled={
            busy ||
            !rows.some((item) => item.status === "active" && !item.current)
          }
          onClick={() => revoke(null, "others")}
        >
          Forget other devices
        </button>
        <button
          type="button"
          className="action-button danger"
          disabled={busy || !rows.some((item) => item.status === "active")}
          onClick={() => revoke(null, "all")}
        >
          Forget all devices
        </button>
      </div>
      <div className="security-session-list">
        {rows.map((device) => (
          <article className="security-session" key={device.id}>
            <div className="security-session-icon">
              <Monitor size={22} aria-hidden="true" />
            </div>
            <div className="security-session-detail">
              <h4>
                {device.name}{" "}
                {device.current && <span className="badge">This device</span>}
              </h4>
              <p>
                {device.status} · Last used{" "}
                {time.format(device.last_used_at, { unit: "seconds" })}
              </p>
              <p>
                Expires {time.format(device.expires_at, { unit: "seconds" })}
                {device.ip_address
                  ? ` · First seen from ${device.ip_address}`
                  : ""}
              </p>
            </div>
            <div className="security-session-actions">
              <button
                type="button"
                className="action-button secondary"
                disabled={busy || device.status !== "active"}
                onClick={() => revoke(device)}
              >
                Forget {device.current ? "this device" : device.name}
              </button>
            </div>
          </article>
        ))}
        {!devices.isPending && !rows.length && (
          <p>
            No remembered devices. Choose “Remember this device” after entering
            an authenticator or recovery code.
          </p>
        )}
      </div>
    </section>
  );
}
