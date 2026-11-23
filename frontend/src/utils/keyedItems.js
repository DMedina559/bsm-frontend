// JSON snapshots do not always expose IDs. Equal values are indistinguishable,
// so count duplicates per identity rather than tying every row to its position.
export function keyedItems(items) {
  const counts = new Map();
  return items.map((item) => {
    const identity = item?.id ?? item?.event_id ?? item?.operation_id ?? item;
    const value = JSON.stringify(identity, (_, entry) =>
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? Object.fromEntries(
            Object.keys(entry)
              .sort()
              .map((name) => [name, entry[name]]),
          )
        : entry,
    );
    const occurrence = counts.get(value) ?? 0;
    counts.set(value, occurrence + 1);
    return { item, key: `${value}:${occurrence}` };
  });
}
