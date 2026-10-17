import type { CsvPreviewRow } from "../types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export interface ParsedRecipients {
  fileName: string;
  emails: string[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  preview: CsvPreviewRow[];
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const options = [",", ";", "\t"];
  return options.reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best,
  );
}

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell.trim() || row.length) {
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
  }

  return rows;
}

function looksLikeHeader(row: string[]): boolean {
  return row.some((cell) => {
    const normalized = cell.trim().toLowerCase().replace(/[\s-]+/g, "_");
    return /^(email|e_mail|email_address|address|recipient|recipient_email|contact_email)s?$/.test(normalized);
  });
}

function findEmail(row: string[]): string {
  const candidate = row.find((cell) => emailPattern.test(cell.trim()));
  return candidate?.trim().toLowerCase() ?? "";
}

export function parseRecipientText(text: string, fileName: string): ParsedRecipients {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return {
      fileName,
      emails: [],
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      preview: [],
    };
  }

  const looksLikeCsv = /[,;\t]/.test(trimmedText.split(/\r?\n/, 1)[0] ?? "");
  const rows = looksLikeCsv
    ? parseCsv(trimmedText, detectDelimiter(trimmedText))
    : trimmedText
        .split(/\r?\n/)
        .map((line) => [line.trim()])
        .filter((row) => row[0]);
  const dataRows = rows.filter((row, index) => !(index === 0 && looksLikeHeader(row)));
  const seen = new Set<string>();
  const emails: string[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;
  const preview: CsvPreviewRow[] = [];

  dataRows.forEach((row) => {
    const rawValue = row.find((cell) => cell.trim())?.trim() ?? "";
    const email = findEmail(row);
    const valid = Boolean(email);
    const duplicate = valid && seen.has(email);

    if (!valid) invalidCount += 1;
    else if (duplicate) duplicateCount += 1;
    else {
      seen.add(email);
      emails.push(email);
    }

    if (preview.length < 5) {
      preview.push({ value: email || rawValue, valid, duplicate });
    }
  });

  return {
    fileName,
    emails,
    totalRows: dataRows.length,
    validCount: emails.length,
    invalidCount,
    duplicateCount,
    preview,
  };
}
