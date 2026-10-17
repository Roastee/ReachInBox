import type { PrismaClient } from "@prisma/client";
import passport from "passport";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";
import { env, googleOAuthConfigured } from "../config/env";
import type { SessionUser } from "../types/express";
import { slugify } from "../utils/id";

export function sessionUser(
  user: { id: string; email: string; name: string | null; avatarUrl: string | null },
  tenantId: string,
): SessionUser {
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, tenantId };
}

async function findOrCreateGoogleUser(database: PrismaClient, profile: Profile): Promise<SessionUser> {
  const email = profile.emails?.[0]?.value?.toLowerCase();
  if (!email) throw new Error("Google account did not provide an email address");

  const name = profile.displayName || profile.name?.givenName || null;
  const avatarUrl = profile.photos?.[0]?.value || null;
  const user = await database.$transaction(async (transaction) => {
    let existing = await transaction.user.findUnique({
      where: { googleSub: profile.id },
      include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
    });

    if (!existing) {
      existing = await transaction.user.findUnique({
        where: { email },
        include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
      });
      if (existing) {
        existing = await transaction.user.update({
          where: { id: existing.id },
          data: { googleSub: profile.id, name, avatarUrl },
          include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
        });
      }
    }

    if (!existing) {
      existing = await transaction.user.create({
        data: { googleSub: profile.id, email, name, avatarUrl },
        include: { memberships: true },
      });
    }

    let membership = existing.memberships[0];
    if (!membership) {
      const tenant = await transaction.tenant.create({
        data: {
          name: `${name || email}'s workspace`,
          slug: `${slugify(email.split("@")[0])}-${profile.id.slice(-8).toLowerCase()}`,
        },
      });
      membership = await transaction.membership.create({
        data: { userId: existing.id, tenantId: tenant.id, role: "owner" },
      });
    }

    return sessionUser(existing, membership.tenantId);
  });
  return user;
}

export function configureGoogleAuth(database: PrismaClient): void {
  passport.serializeUser<string>((user, done) => done(null, user.id));
  passport.deserializeUser<string>(async (id, done) => {
    try {
      const record = await database.user.findUnique({
        where: { id },
        include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
      });
      if (!record || !record.memberships[0]) return done(null, false);
      done(null, sessionUser(record, record.memberships[0].tenantId));
    } catch (error) {
      done(error as Error);
    }
  });

  if (!googleOAuthConfigured) return;
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          done(null, await findOrCreateGoogleUser(database, profile));
        } catch (error) {
          done(error as Error);
        }
      },
    ),
  );
}
