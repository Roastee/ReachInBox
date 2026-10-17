import { randomUUID } from "node:crypto";
import { Router } from "express";
import { env, slackOAuthConfigured } from "../config/env";
import { prisma } from "../db";
import { requireAuth, tenantIdFromRequest } from "../middleware/auth";
import {
  exchangeSlackCode,
  saveSlackConnection,
  slackAuthorizeUrl,
} from "../services/slack-service";

export function slackRouter(): Router {
  const router = Router();

  router.get("/connect", requireAuth, (req, res) => {
    if (!slackOAuthConfigured) {
      res.status(503).json({ error: "slack_oauth_not_configured" });
      return;
    }
    const state = randomUUID();
    req.session.slackOAuthState = state;
    res.redirect(slackAuthorizeUrl(state));
  });

  router.get("/callback", requireAuth, async (req, res, next) => {
    try {
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const code = typeof req.query.code === "string" ? req.query.code : "";
      if (!state || !code || state !== req.session.slackOAuthState) {
        res.status(400).json({ error: "invalid_slack_oauth_state" });
        return;
      }
      delete req.session.slackOAuthState;
      const access = await exchangeSlackCode(code);
      await saveSlackConnection(prisma, tenantIdFromRequest(req), access);
      res.redirect(`${env.WEB_ORIGIN}/dashboard?slack=connected`);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/disconnect", requireAuth, async (req, res, next) => {
    try {
      await prisma.slackConnection.deleteMany({ where: { tenantId: tenantIdFromRequest(req) } });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/status", requireAuth, async (req, res, next) => {
    try {
      const connection = await prisma.slackConnection.findUnique({
        where: { tenantId: tenantIdFromRequest(req) },
        select: { teamId: true, teamName: true, channelId: true, channelName: true, scope: true, createdAt: true },
      });
      res.json({ configured: slackOAuthConfigured, channelConfigured: Boolean(env.SLACK_RATE_LIMIT_CHANNEL), connection });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
