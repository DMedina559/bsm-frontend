import SettingsField from "./SettingsField";
import { settingGroups, settingGroupHelp } from "../utils/settingsFields";
export default function SettingsGroups({
  settings,
  onChange,
  identity = "global",
}) {
  function render(data, prefix = "") {
    return Object.entries(data).map(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (key === "config_schema_version") return null;
      if (value !== null && typeof value === "object" && !Array.isArray(value))
        return (
          <section key={path} className="settings-group">
            <h3 className="settings-group-title">
              {settingGroups[path] || key.replace(/_/g, " ")}
            </h3>
            {settingGroupHelp[path] && (
              <p className="settings-group-description">
                {settingGroupHelp[path]}
              </p>
            )}
            <div className="settings-grid">{render(value, path)}</div>
          </section>
        );
      return (
        <SettingsField
          key={`${identity}:${path}`}
          path={path}
          value={value}
          onChange={onChange}
        />
      );
    });
  }
  return <div className="settings-container">{render(settings)}</div>;
}
