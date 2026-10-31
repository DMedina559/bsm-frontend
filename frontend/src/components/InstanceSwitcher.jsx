import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getActiveInstance,
  instancesEnabled,
  readInstances,
  selectInstance,
  subscribeInstances,
} from "../app/instanceProfiles";
import { draftRegistry } from "../app/draftRegistry";
import { useDialog } from "../contexts/DialogContext";

function ActiveInstanceSwitcher() {
  const [profiles, setProfiles] = useState(readInstances);
  const [active, setActive] = useState(() => getActiveInstance()?.id ?? "");
  const color = profiles.find((profile) => profile.id === active)?.color;
  const { confirmAction } = useDialog();
  const navigate = useNavigate();
  useEffect(
    () =>
      subscribeInstances(() => {
        setProfiles(readInstances());
        setActive(getActiveInstance()?.id ?? "");
      }),
    [],
  );
  return (
    <div
      className={`instance-switcher${color ? " has-instance-color" : ""}`}
      style={color ? { "--instance-color": color } : undefined}
    >
      {color && <span className="instance-color-swatch" aria-hidden="true" />}
      <select
        aria-label="Active BSM instance"
        value={active}
        onChange={async (event) => {
          if (event.target.value === "__manage_instances__") {
            navigate("/instances");
            return;
          }
          const id = event.target.value || null;
          if (
            draftRegistry.dirty() &&
            !(await confirmAction(
              "Discard unsaved changes and switch instances?",
            ))
          )
            return;
          selectInstance(id);
          navigate("/", { replace: true });
        }}
      >
        <option value="">Default connection</option>
        {profiles.map((profile) => (
          <option
            key={profile.id}
            value={profile.id}
            disabled={
              window.location.protocol === "https:" &&
              new URL(profile.url).protocol === "http:"
            }
          >
            {profile.name}
            {profile.paused ? " (paused)" : ""}
          </option>
        ))}
        <optgroup label="Management">
          <option value="__manage_instances__">Manage instances…</option>
        </optgroup>
      </select>
    </div>
  );
}

export default function InstanceSwitcher() {
  return instancesEnabled() ? <ActiveInstanceSwitcher /> : null;
}
