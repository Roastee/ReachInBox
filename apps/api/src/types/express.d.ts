import "express-session";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  tenantId: string;
}

declare global {
  namespace Express {
    interface User extends SessionUser {}
  }
}

declare module "express-session" {
  interface SessionData {
    slackOAuthState?: string;
  }
}

export {};
