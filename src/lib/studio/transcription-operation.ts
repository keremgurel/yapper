/** Runtime-authoritative mutual exclusion for Studio transcription consumers. */
export class StudioTranscriptionGate {
  current: AbortController | null = null;

  begin(): AbortController | null {
    if (this.current) return null;
    const controller = new AbortController();
    this.current = controller;
    return controller;
  }

  owns(controller: AbortController): boolean {
    return this.current === controller;
  }

  release(controller: AbortController): void {
    if (this.current === controller) this.current = null;
  }

  cancel(reason: unknown = "canceled"): void {
    this.current?.abort(reason);
  }
}
