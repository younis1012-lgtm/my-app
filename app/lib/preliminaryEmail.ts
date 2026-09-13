export async function preparePreliminaryEmailRecords<T>(
  records: T[],
  hydrate: (record: T) => Promise<T>,
  useCurrentDraft = false,
): Promise<T[]> {
  const snapshots = structuredClone(records);
  return useCurrentDraft ? snapshots : Promise.all(snapshots.map(hydrate));
}
