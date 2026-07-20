/**
 * The master video a compose body posts. It resolves to an R2 media key one of
 * two ways: `submissionId` (a Yapper recording) or `mediaKey` (a raw key for a
 * video uploaded or imported from another platform). `id` is a stable key for
 * the sheet; `contentItemId` links a library take to its row and is absent for
 * uploaded/imported videos that have no library item.
 */
export interface CrossPostTarget {
  id: string;
  title: string;
  submissionId?: string;
  mediaKey?: string;
  contentItemId?: string;
}
