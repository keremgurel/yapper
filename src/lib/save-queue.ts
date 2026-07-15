type AnySave = (...args: never[]) => unknown;

/**
 * Whether a failed save's batch has been re-pointed at a different save since it
 * started, meaning the caller switched records (e.g. navigated to another item)
 * while the save was in flight.
 *
 * When true, the failed fields must NOT be merged back into the current pending
 * batch: that batch now belongs to a different record, so re-merging would write
 * the failed record's data into the wrong one. False means it is safe to re-merge
 * and retry (the batch is still the same target, or there is no batch yet).
 */
export function failedSaveRetargets(
  failedSave: AnySave,
  currentBatchSave: AnySave | null,
): boolean {
  return currentBatchSave != null && currentBatchSave !== failedSave;
}
