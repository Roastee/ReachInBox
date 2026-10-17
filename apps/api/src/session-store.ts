import session from "express-session";
import type Redis from "ioredis";

/** Small Redis-backed express-session store that keeps auth sessions alive across API restarts. */
export class RedisSessionStore extends session.Store {
  constructor(private readonly client: Redis, private readonly prefix = "reachinbox:session:") {
    super();
  }

  private key(sessionId: string): string {
    return `${this.prefix}${sessionId}`;
  }

  get(sessionId: string, callback: (error: Error | null, session?: session.SessionData | null) => void): void {
    void this.client
      .get(this.key(sessionId))
      .then((value) => callback(null, value ? (JSON.parse(value) as session.SessionData) : null))
      .catch((error: unknown) => callback(error instanceof Error ? error : new Error(String(error))));
  }

  set(sessionId: string, sessionData: session.SessionData, callback: (error?: Error | null) => void): void {
    const ttl = Math.max(1, sessionData.cookie.maxAge ?? 7 * 24 * 60 * 60 * 1000);
    void this.client
      .set(this.key(sessionId), JSON.stringify(sessionData), "PX", ttl)
      .then(() => callback(null))
      .catch((error: unknown) => callback(error instanceof Error ? error : new Error(String(error))));
  }

  destroy(sessionId: string, callback: (error?: Error | null) => void): void {
    void this.client
      .del(this.key(sessionId))
      .then(() => callback(null))
      .catch((error: unknown) => callback(error instanceof Error ? error : new Error(String(error))));
  }

  touch(sessionId: string, sessionData: session.SessionData, callback: (error?: Error | null) => void): void {
    const ttl = Math.max(1, sessionData.cookie.maxAge ?? 7 * 24 * 60 * 60 * 1000);
    void this.client
      .pexpire(this.key(sessionId), ttl)
      .then(() => callback(null))
      .catch((error: unknown) => callback(error instanceof Error ? error : new Error(String(error))));
  }
}
