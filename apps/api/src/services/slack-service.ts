import type { PrismaClient } from "@prisma/client";
import { env, slackOAuthConfigured } from "../config/env";
import { encryptSecret, decryptSecret } from "../utils/crypto";

const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_ACCESS_URL = "https://slack.com/api/oauth.v2.access";
const SLACK_MESSAGE_URL = "https://slack.com/api/chat.postMessage";

export interface SlackAccessResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: { id?: string; name?: string };
  authed_user?: { id?: string };
  scope?: string;
  incoming_webhook?: {
    url?: string;
    channel_id?: string;
    channel?: string;
  };
}

export function slackAuthorizeUrl(state: string): string {
  if (!slackOAuthConfigured) throw new Error("Slack OAuth is not configured");
  const url = new URL(SLACK_AUTHORIZE_URL);
  url.searchParams.set("client_id", env.SLACK_CLIENT_ID);
  url.searchParams.set("scope", "chat:write,incoming-webhook");
  url.searchParams.set("redirect_uri", env.SLACK_CALLBACK_URL);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeSlackCode(code: string): Promise<SlackAccessResponse> {
  if (!slackOAuthConfigured) throw new Error("Slack OAuth is not configured");
  const body = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: env.SLACK_CALLBACK_URL,
  });
  const response = await fetch(SLACK_ACCESS_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Slack OAuth token request failed with HTTP ${response.status}`);
  return (await response.json()) as SlackAccessResponse;
}

export async function saveSlackConnection(
  database: PrismaClient,
  tenantId: string,
  access: SlackAccessResponse,
): Promise<void> {
  if (!access.ok || !access.access_token || !access.team?.id) {
    throw new Error(access.error || "Slack OAuth did not return a workspace token");
  }

  await database.slackConnection.upsert({
    where: { tenantId },
      create: {
      tenantId,
      teamId: access.team.id,
      teamName: access.team.name,
      slackUserId: access.authed_user?.id,
        accessToken: encryptSecret(access.access_token),
        webhookUrl: access.incoming_webhook?.url ? encryptSecret(access.incoming_webhook.url) : null,
        channelId: access.incoming_webhook?.channel_id || env.SLACK_RATE_LIMIT_CHANNEL || null,
        channelName: access.incoming_webhook?.channel || null,
        scope: access.scope,
    },
    update: {
      teamId: access.team.id,
      teamName: access.team.name,
      slackUserId: access.authed_user?.id,
        accessToken: encryptSecret(access.access_token),
        webhookUrl: access.incoming_webhook?.url ? encryptSecret(access.incoming_webhook.url) : null,
        channelId: access.incoming_webhook?.channel_id || env.SLACK_RATE_LIMIT_CHANNEL || null,
        channelName: access.incoming_webhook?.channel || null,
        scope: access.scope,
    },
  });
}

export async function sendRateLimitNotification(
  database: PrismaClient,
  tenantId: string,
  message: string,
): Promise<boolean> {
  const connection = await database.slackConnection.findUnique({ where: { tenantId } });
  if (!connection) return false;

  if (connection.webhookUrl) {
    const webhookResponse = await fetch(decryptSecret(connection.webhookUrl), {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ text: message }),
    });
    if (!webhookResponse.ok) throw new Error(`Slack webhook failed with HTTP ${webhookResponse.status}`);
    return true;
  }

  if (!connection.channelId && !env.SLACK_RATE_LIMIT_CHANNEL) return false;

  const response = await fetch(SLACK_MESSAGE_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${decryptSecret(connection.accessToken)}`,
      "content-type": "application/json; charset=utf-8",
    },
      body: JSON.stringify({ channel: connection.channelId || env.SLACK_RATE_LIMIT_CHANNEL, text: message }),
  });
  if (!response.ok) throw new Error(`Slack notification failed with HTTP ${response.status}`);
  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (!result.ok) throw new Error(result.error || "Slack rejected notification");
  return true;
}
