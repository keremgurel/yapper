export class PublishAttempt {
  private key: string | null = null;
  private running = false;

  constructor(private readonly createKey = () => crypto.randomUUID()) {}

  begin(): string | null {
    if (this.running) return null;
    this.running = true;
    this.key ??= this.createKey();
    return this.key;
  }

  finish(): void {
    this.running = false;
  }

  reset(): void {
    this.key = null;
    this.running = false;
  }
}

export class PublishAttemptRegistry {
  private readonly keys = new Map<string, string>();

  constructor(private readonly createKey = () => crypto.randomUUID()) {}

  forTarget(target: string): string {
    const existing = this.keys.get(target);
    if (existing) return existing;
    const key = this.createKey();
    this.keys.set(target, key);
    return key;
  }
}
