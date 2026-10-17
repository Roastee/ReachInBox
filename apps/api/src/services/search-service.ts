import { Client } from "@elastic/elasticsearch";
import { env } from "../config/env";

export interface SearchEmailDocument {
  id: string;
  tenantId: string;
  scheduleId: string;
  toAddress: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  scheduledAt: string;
  nextAttemptAt?: string | null;
  sentAt?: string | null;
  previewUrl?: string | null;
  isStarred?: boolean;
  archivedAt?: string | null;
  deletedAt?: string | null;
  status: string;
}

const client = new Client({
  node: env.ELASTICSEARCH_URL,
  ...(env.ELASTICSEARCH_USERNAME && env.ELASTICSEARCH_PASSWORD
    ? { auth: { username: env.ELASTICSEARCH_USERNAME, password: env.ELASTICSEARCH_PASSWORD } }
    : {}),
});

let indexReady: Promise<void> | undefined;

async function ensureIndex(): Promise<void> {
  indexReady ??= (async () => {
    const exists = await client.indices.exists({ index: env.ELASTICSEARCH_INDEX });
    if (!exists) {
      await client.indices.create({
        index: env.ELASTICSEARCH_INDEX,
        mappings: {
          properties: {
            tenantId: { type: "keyword" },
            scheduleId: { type: "keyword" },
            toAddress: { type: "keyword" },
            fromAddress: { type: "keyword" },
            subject: { type: "text" },
            bodyText: { type: "text" },
            bodyHtml: { type: "text" },
            scheduledAt: { type: "date" },
            nextAttemptAt: { type: "date" },
            sentAt: { type: "date" },
            previewUrl: { type: "keyword", index: false },
            isStarred: { type: "boolean" },
            archivedAt: { type: "date" },
            deletedAt: { type: "date" },
            status: { type: "keyword" },
          },
        },
      });
    }
  })().catch((error) => {
    indexReady = undefined;
    throw error;
  });
  await indexReady;
}

export async function indexEmail(document: SearchEmailDocument): Promise<void> {
  await ensureIndex();
  await client.index({
    index: env.ELASTICSEARCH_INDEX,
    id: document.id,
    document,
    refresh: "wait_for",
  });
}

export interface EmailSearchResult {
  total: number;
  items: Array<SearchEmailDocument & { score: number | null }>;
}

export type EmailVisibility = "active" | "archived" | "deleted" | "all";

export interface EmailSearchFilters {
  archived?: EmailVisibility;
  deleted?: EmailVisibility;
}

function visibilityFilter(field: "archivedAt" | "deletedAt", visibility: EmailVisibility): Record<string, unknown>[] {
  if (visibility === "all") return [];
  if (visibility === "archived" || visibility === "deleted") return [{ exists: { field } }];
  return [{ bool: { must_not: [{ exists: { field } }] } }];
}

export async function searchEmails(
  tenantId: string,
  query: string,
  page = 1,
  pageSize = 25,
  status?: "scheduled" | "sent",
  filters: EmailSearchFilters = {},
): Promise<EmailSearchResult> {
  await ensureIndex();
  const result = await client.search<SearchEmailDocument>({
    index: env.ELASTICSEARCH_INDEX,
    from: (page - 1) * pageSize,
    size: pageSize,
    query: {
      bool: {
        must: query.trim()
          ? [{ multi_match: { query: query.trim(), fields: ["toAddress", "fromAddress", "subject", "bodyText", "bodyHtml"] } }]
          : [{ match_all: {} }],
        filter: [
          { term: { tenantId } },
          ...(status
            ? [{ terms: { status: status === "scheduled" ? ["PENDING", "SENDING"] : ["SENT", "FAILED", "NEEDS_REVIEW"] } }]
            : []),
          ...visibilityFilter("archivedAt", filters.archived || "active"),
          ...visibilityFilter("deletedAt", filters.deleted || "active"),
        ],
      },
    },
  });

  const totalValue = result.hits.total;
  const total = typeof totalValue === "number" ? totalValue : (totalValue?.value ?? 0);
  return {
    total,
    items: result.hits.hits.map((hit) => ({
      ...(hit._source as SearchEmailDocument),
      score: hit._score ?? null,
    })),
  };
}

export async function checkSearchConnection(): Promise<void> {
  await client.ping();
}
