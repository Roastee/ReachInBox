import { createHash } from "node:crypto";
import Redis from "ioredis";
import { env } from "../config/env";

// The script checks both constraints atomically. A sorted set gives us an exact
// rolling one-hour window while a separate timestamp key enforces the minimum
// inter-send delay. The return value is [delayMs, rateLimited]. A job that is
// only pacing is delayed without consuming a rate-limit token.
const ACQUIRE_SLOT_SCRIPT = `
local rateKey = KEYS[1]
local paceKey = KEYS[2]
local now = tonumber(ARGV[1])
local minimumDelay = tonumber(ARGV[2])
local hourlyLimit = tonumber(ARGV[3])
local member = ARGV[4]
local hourMs = 3600000

redis.call('ZREMRANGEBYSCORE', rateKey, 0, now - hourMs)
local count = tonumber(redis.call('ZCARD', rateKey))
local delay = 0
local rateLimited = 0

if count >= hourlyLimit then
  local oldest = redis.call('ZRANGE', rateKey, 0, 0, 'WITHSCORES')
  if oldest[2] then
    delay = math.max(delay, tonumber(oldest[2]) + hourMs - now)
    rateLimited = 1
  end
end

local last = tonumber(redis.call('GET', paceKey) or '0')
if last > 0 then
  delay = math.max(delay, minimumDelay - (now - last))
end

if delay <= 0 then
  redis.call('ZADD', rateKey, now, member)
  redis.call('PEXPIRE', rateKey, hourMs + minimumDelay + 60000)
  redis.call('SET', paceKey, now, 'PX', hourMs + minimumDelay + 60000)
  return {0, 0}
end

return {math.ceil(delay), rateLimited}
`;

function senderKey(tenantId: string, sender: string): string {
  const canonicalSender = sender.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] || sender;
  const digest = createHash("sha256").update(`${tenantId}:${canonicalSender.trim().toLowerCase()}`).digest("hex");
  return `reachinbox:sender-rate:${digest}`;
}

export interface SenderSlotResult {
  delayMs: number;
  rateLimited: boolean;
}

export async function acquireSenderSlot(
  redis: Redis,
  tenantId: string,
  sender: string,
  hourlyLimit: number,
  emailId: string,
  minimumDelayMs = env.SENDER_MIN_DELAY_MS,
  now = Date.now(),
): Promise<SenderSlotResult> {
  const key = senderKey(tenantId, sender);
  const result = await redis.eval(
    ACQUIRE_SLOT_SCRIPT,
    2,
    key,
    `${key}:pace`,
    String(now),
    String(Math.max(0, Math.floor(minimumDelayMs))),
    String(Math.max(1, Math.min(hourlyLimit, env.SENDER_HOURLY_LIMIT))),
    emailId,
  );
  const values = Array.isArray(result) ? result : [result, 0];
  return { delayMs: Number(values[0] || 0), rateLimited: Number(values[1] || 0) === 1 };
}

export function nextDelayForTimestamp(scheduledAt: Date, now = Date.now()): number {
  return Math.max(0, scheduledAt.getTime() - now);
}
