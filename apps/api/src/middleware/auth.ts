import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const developmentHeaderAuth =
    env.ALLOW_DEV_AUTH && Boolean(req.header("x-dev-tenant-id") && req.header("x-dev-user-id"));
  if ((req.isAuthenticated?.() || developmentHeaderAuth) && req.user?.tenantId) {
    next();
    return;
  }

  res.status(401).json({ error: "authentication_required" });
}

export function tenantIdFromRequest(req: Request): string {
  if (!req.user?.tenantId) throw new Error("authenticated tenant is missing");
  return req.user.tenantId;
}

export function allowDevAuthHeaders(req: Request, _res: Response, next: NextFunction): void {
  // This opt-in hook makes local API smoke tests possible without weakening
  // production auth. The referenced tenant/user must still exist in Postgres.
  if (env.ALLOW_DEV_AUTH && !req.user && req.header("x-dev-tenant-id") && req.header("x-dev-user-id")) {
    req.user = {
      id: req.header("x-dev-user-id") as string,
      email: req.header("x-dev-user-email") || "dev@example.test",
      name: "Development User",
      tenantId: req.header("x-dev-tenant-id") as string,
    };
  }
  next();
}
