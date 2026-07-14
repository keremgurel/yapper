/** The master video a compose body posts. `submissionId` resolves to the R2
 * media key server-side; `id` is the content-item row it belongs to. */
export interface CrossPostTarget {
  id: string;
  title: string;
  submissionId: string;
}
