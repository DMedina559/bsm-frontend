import { navigationLabel } from "../utils/navigationLabel";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getActiveInstance,
  instancesEnabled,
  readInstances,
  selectInstance,
  subscribeInstances,
} from "../app/instanceProfiles";
import { Check, ChevronDown, Server, Settings, Globe } from "lucide-react";
import ActionMenu from "./ActionMenu";
import { draftRegistry } from "../app/draftRegistry";
import { useDialog } from "../contexts/DialogContext";

function ActiveInstanceSwitcher({ onConfigure }) {
  const [profiles, setProfiles] = useState(readInstances);
  const [active, setActive] = useState(() => getActiveInstance()?.id ?? "");
  const selected = profiles.find((profile) => profile.id === active);
  const color = selected?.color;
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
  async function switchInstance(id) {
    if (id === (active || null)) return;
    if (
      draftRegistry.dirty() &&
      !(await confirmAction("Discard unsaved changes and switch instances?"))
    )
      return;
    selectInstance(id);
    navigate("/", { replace: true });
  }
  const enabled = instancesEnabled();
  const choices = [{ id: "", name: "Default" }, ...(enabled ? profiles : [])];
  const items = choices.map((profile) => ({
    id: `instance:${profile.id}`,
    label: profile.name,
    checked: profile.id === active,
    disabled:
      !!profile.url &&
      window.location.protocol === "https:" &&
      new URL(profile.url).protocol === "http:",
    onClick: () => void switchInstance(profile.id || null),
    content: (
      <>
        <span
          className="instance-color-swatch"
          aria-hidden="true"
          style={
            profile.color ? { "--instance-color": profile.color } : undefined
          }
        />
        <span className="instance-option-name">
          {profile.name}
          {profile.paused ? " (paused)" : ""}
        </span>
        {profile.id === active && <Check size={15} aria-hidden="true" />}
      </>
    ),
  }));
  if (onConfigure)
    items.push({
      id: "configure",
      label: navigationLabel("Configure Remote Server"),
      Icon: Globe,
      separatorBefore: true,
      onClick: onConfigure,
    });
  if (enabled)
    items.push({
      id: "manage",
      label: navigationLabel("Manage instances…"),
      Icon: Settings,
      separatorBefore: !onConfigure,
      onClick: () => navigate("/instances"),
    });
  return (
    <div
      className={`instance-switcher${color ? " has-instance-color" : ""}`}
      style={color ? { "--instance-color": color } : undefined}
    >
      <ActionMenu
        label={`Active BSM instance: ${selected?.name ?? "Default"}`}
        triggerClassName="instance-switcher-trigger"
        menuClassName="instance-switcher-menu"
        items={items}
      >
        {color ? (
          <span className="instance-color-swatch" aria-hidden="true" />
        ) : (
          <Server size={14} aria-hidden="true" />
        )}
        <span
          className="instance-switcher-name"
          title={selected?.name ?? "Default"}
        >
          {selected?.name ?? "Default"}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </ActionMenu>
    </div>
  );
}

export default function InstanceSwitcher({ onConfigure } = {}) {
  return instancesEnabled() || onConfigure ? (
    <ActiveInstanceSwitcher onConfigure={onConfigure} />
  ) : null;
}
