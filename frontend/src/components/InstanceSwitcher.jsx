import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
    <div className="instance-switcher">
      <select
        aria-label="Active BSM instance"
        value={active}
        onChange={async (event) => {
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
      </select>
      <Link to="/instances">Instances</Link>
    </div>
  );
}

export default function InstanceSwitcher() {
  return instancesEnabled() ? <ActiveInstanceSwitcher /> : null;
}
