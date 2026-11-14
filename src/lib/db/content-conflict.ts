/** Thrown inside a write's transaction when the row changed since the caller
 * read it, so nothing is written. */
export class ContentConflict extends Error {
  constructor() {
    super("content_changed");
  }
}
