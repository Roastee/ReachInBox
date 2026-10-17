import type { PrismaClient } from "@prisma/client";
import { Router, type Request } from "express";
import passport from "passport";
import { z } from "zod";
import { env, googleOAuthConfigured } from "../config/env";
import { prisma as defaultPrisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { sessionUser } from "../auth/google";
import { hashPassword, verifyPassword } from "../auth/password";
import { slugify } from "../utils/id";

const registrationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(128),
});

function validationResponse(res: Parameters<Parameters<Router["post"]>[1]>[1], issues: z.ZodIssue[]): void {
  res.status(400).json({
    error: "validation_error",
    message: issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`).join("; "),
    issues,
  });
}

function establishSession(req: Request, user: Express.User): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        reject(regenerateError);
        return;
      }
      req.logIn(user, (loginError) => {
        if (loginError) reject(loginError);
        else resolve();
      });
    });
  });
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}

export function authRouter(database: PrismaClient = defaultPrisma): Router {
  const router = Router();

  router.post("/register", async (req, res, next) => {
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) {
      validationResponse(res, parsed.error.issues);
      return;
    }

    try {
      const existing = await database.user.findUnique({ where: { email: parsed.data.email } });
      if (existing) {
        res.status(409).json({ error: "email_already_registered", message: "An account with this email already exists." });
        return;
      }

      const passwordHash = await hashPassword(parsed.data.password);
      const user = await database.$transaction(async (transaction) => {
        const createdUser = await transaction.user.create({
          data: {
            email: parsed.data.email,
            passwordHash,
            name: parsed.data.name || parsed.data.email.split("@")[0],
          },
        });
        const tenant = await transaction.tenant.create({
          data: {
            name: `${createdUser.name || parsed.data.email}'s workspace`,
            slug: `${slugify(parsed.data.email.split("@")[0])}-${createdUser.id.slice(-8).toLowerCase()}`,
          },
        });
        const membership = await transaction.membership.create({
          data: { userId: createdUser.id, tenantId: tenant.id, role: "owner" },
        });
        return sessionUser(createdUser, membership.tenantId);
      });

      await establishSession(req, user);
      res.status(201).json({ user });
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "email_already_registered", message: "An account with this email already exists." });
        return;
      }
      next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      validationResponse(res, parsed.error.issues);
      return;
    }

    try {
      const user = await database.user.findUnique({
        where: { email: parsed.data.email },
        include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
      });
      const valid = Boolean(user?.passwordHash && (await verifyPassword(parsed.data.password, user.passwordHash)));
      if (!user || !valid || !user.memberships[0]) {
        res.status(401).json({ error: "invalid_credentials", message: "Email or password is incorrect." });
        return;
      }

      const signedInUser = sessionUser(user, user.memberships[0].tenantId);
      await establishSession(req, signedInUser);
      res.json({ user: signedInUser });
    } catch (error) {
      next(error);
    }
  });

  router.get("/google", (req, res, next) => {
    if (!googleOAuthConfigured) {
      res.redirect(`${env.WEB_ORIGIN}/login?error=google_oauth_not_configured`);
      return;
    }
    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: true,
    })(req, res, next);
  });

  router.get("/google/callback", (req, res, next) => {
    if (!googleOAuthConfigured) {
      res.redirect(`${env.WEB_ORIGIN}/login?error=google_oauth_not_configured`);
      return;
    }
    passport.authenticate("google", {
      failureRedirect: `${env.WEB_ORIGIN}/login?error=oauth_failed`,
      session: true,
    })(req, res, next);
  }, (req, res) => {
    res.redirect(`${env.WEB_ORIGIN}/dashboard`);
  });

  router.get("/me", requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  router.post("/logout", (req, res, next) => {
    req.logout((error) => {
      if (error) {
        next(error);
        return;
      }
      req.session.destroy((sessionError) => {
        if (sessionError) {
          next(sessionError);
          return;
        }
        res.clearCookie("connect.sid", {
          httpOnly: true,
          sameSite: "lax",
          secure: env.NODE_ENV === "production",
        });
        res.status(204).send();
      });
    });
  });

  return router;
}
