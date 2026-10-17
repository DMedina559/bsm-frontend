import { browserRecords } from "./browserRecords";
const DAY = 24 * 60 * 60 * 1000;
const validServer = (server) =>
  typeof server?.name === "string" &&
  server.name.length > 0 &&
  ["status", "version"].every(
    (key) => server[key] == null || typeof server[key] === "string",
  ) &&
  (server.player_count == null ||
    (Number.isSafeInteger(server.player_count) && server.player_count >= 0));
/** Explicit allowlist: never persist player identities, properties or credentials. */
export function cacheFleet(identity, data) {
  const servers = data.servers.map(
    ({ name, status, version, player_count }) => ({
      name,
      status,
      version,
      player_count,
      players_available: false,
    }),
  );
  if (servers.every(validServer))
    return browserRecords.write(
      identity,
      "offline",
      "fleet",
      { status: "success", servers },
      DAY,
    );
}
export async function readOfflineFleet(identity) {
  const record = await browserRecords.read(identity, "offline", "fleet");
  if (
    !Array.isArray(record?.value?.servers) ||
    !record.value.servers.every(validServer)
  )
    return undefined;
  return { ...record.value, offline: { savedAt: record.savedAt } };
}
