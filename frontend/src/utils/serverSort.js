const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
export const SERVER_SORTS = {
  name: "Name",
  status: "Status",
  version: "Version",
  players: "Players",
};
export function sortServers(servers, key = "name", direction = "asc") {
  const field = Object.hasOwn(SERVER_SORTS, key) ? key : "name";
  const sign = direction === "desc" ? -1 : 1;
  return [...servers].sort((a, b) => {
    const av = field === "players" ? a.player_count : a[field];
    const bv = field === "players" ? b.player_count : b[field];
    const known = (value) =>
      field === "players"
        ? Number.isFinite(value) && value >= 0
        : typeof value === "string" && value.trim() !== "" && value !== "N/A";
    if (known(av) !== known(bv)) return known(av) ? -1 : 1;
    const result = !known(av)
      ? 0
      : field === "players"
        ? av - bv
        : collator.compare(av, bv);
    return sign * result || collator.compare(a.name || "", b.name || "");
  });
}
export function readServerSort() {
  try {
    const value = JSON.parse(localStorage.getItem("bsm.fleet-sort.v4"));
    return {
      key: Object.hasOwn(SERVER_SORTS, value?.key) ? value.key : "name",
      direction: value?.direction === "desc" ? "desc" : "asc",
    };
  } catch {
    return { key: "name", direction: "asc" };
  }
}
