import type { ScheduleUploadRow } from "@reachinbox/shared";

export class CsvInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvInputError";
  }
}

type RawRow = string[];

function parseRecords(input: string): RawRow[] {
  const records: RawRow[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (character === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value.trim() !== "")) records.push(row);
      row = [];
      continue;
    }

    field += character;
  }

  if (inQuotes) throw new CsvInputError("CSV contains an unterminated quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) records.push(row);
  }

  return records;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[\s_-]+/g, "");
}

function findColumn(headers: string[], candidates: string[]): number {
  const wanted = candidates.map(normalizeHeader);
  return headers.findIndex((header) => wanted.includes(normalizeHeader(header)));
}

function valueAt(row: RawRow, index: number): string {
  return index < 0 ? "" : (row[index] ?? "").trim();
}

export interface ScheduleCsvDefaults {
  subject?: string;
  body?: string;
  bodyHtml?: string;
  from?: string;
  scheduledAt?: string;
}

/** Convert rich text to a stable plain-text fallback for search and SMTP text parts. */
export function htmlToText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parse a scheduler upload. The preferred CSV format has a header containing
 * an email/to column and may optionally contain from, subject, body, and
 * scheduledAt columns. A plain text file with one email per line is also
 * accepted when the form provides default subject/body/from values.
 */
export function parseScheduleCsv(input: string, defaults: ScheduleCsvDefaults = {}): ScheduleUploadRow[] {
  const records = parseRecords(input.replace(/^\uFEFF/, ""));
  if (records.length < 1) {
    throw new CsvInputError("Upload must contain at least one email row");
  }

  const headers = records[0];
  const toIndex = findColumn(headers, ["to", "email", "recipient", "recipientEmail"]);
  const subjectIndex = findColumn(headers, ["subject"]);
  const bodyIndex = findColumn(headers, ["body", "bodyText", "message", "content"]);
  const bodyHtmlIndex = findColumn(headers, ["bodyHtml", "html", "richText", "richHtml"]);
  const fromIndex = findColumn(headers, ["from", "sender", "fromAddress"]);
  const scheduledAtIndex = findColumn(headers, ["scheduledAt", "sendAt", "scheduleAt", "date"]);

  const hasHeader = toIndex >= 0;
  const dataRecords = hasHeader ? records.slice(1) : records;

  if (!hasHeader && !defaults.subject?.trim()) {
    throw new CsvInputError("A plain text upload requires a default subject");
  }
  if (!hasHeader && !defaults.body?.trim() && !defaults.bodyHtml?.trim()) {
    throw new CsvInputError("A plain text upload requires a default body");
  }
  if (hasHeader && toIndex < 0) {
    throw new CsvInputError("CSV headers must include an email or to column");
  }
  if (
    hasHeader &&
    ((subjectIndex < 0 && !defaults.subject?.trim()) ||
      (bodyIndex < 0 && bodyHtmlIndex < 0 && !defaults.body?.trim() && !defaults.bodyHtml?.trim()))
  ) {
    throw new CsvInputError("CSV headers must include to, subject, and body columns or a bodyHtml column");
  }

  return dataRecords.map((record, offset) => {
    const rowNumber = offset + 2;
    const to = hasHeader ? valueAt(record, toIndex) : valueAt(record, 0);
    const subject = (hasHeader ? valueAt(record, subjectIndex) : "") || defaults.subject?.trim() || "";
    const bodyHtml = (hasHeader ? valueAt(record, bodyHtmlIndex) : "") || defaults.bodyHtml?.trim() || "";
    const body = (hasHeader ? valueAt(record, bodyIndex) : "") || defaults.body?.trim() || (bodyHtml ? htmlToText(bodyHtml) : "");
    const from = (hasHeader ? valueAt(record, fromIndex) : "") || defaults.from?.trim() || "";
    const scheduledAt = (hasHeader ? valueAt(record, scheduledAtIndex) : "") || defaults.scheduledAt?.trim() || "";

    if (!to) throw new CsvInputError(`Row ${rowNumber}: recipient is required`);
    if (!subject) throw new CsvInputError(`Row ${rowNumber}: subject is required`);
    if (!body) throw new CsvInputError(`Row ${rowNumber}: body is required`);

    return {
      to,
      subject,
      body,
      ...(bodyHtml ? { bodyHtml } : {}),
      ...(from ? { from } : {}),
      ...(scheduledAt ? { scheduledAt } : {}),
    };
  });
}

export function isEmailAddress(value: string): boolean {
  const address = value.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] || value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
}
