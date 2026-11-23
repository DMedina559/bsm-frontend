export function isSettingsTabChange(current, next) {
  if (
    current.pathname !== "/bsm-settings" ||
    current.pathname !== next.pathname
  )
    return false;
  const before = new URLSearchParams(current.search);
  const after = new URLSearchParams(next.search);
  const tabs = [null, "general", "backups", "web", "storage", "advanced"];
  if (!tabs.includes(before.get("tab")) || !tabs.includes(after.get("tab")))
    return false;
  before.delete("tab");
  after.delete("tab");
  before.sort();
  after.sort();
  return before.toString() === after.toString();
}
