/**
 * Request ordering guard: `begin()` issues a token and only the most recent token is current, so a slow
 * earlier response that resolves last can be recognised and ignored.
 */
export class LatestGuard {
  private current = 0;

  begin(): number {
    this.current += 1;
    return this.current;
  }

  isCurrent(token: number): boolean {
    return token === this.current;
  }

  /** Invalidate every outstanding token (e.g. on unmount). */
  cancel(): void {
    this.current += 1;
  }
}
