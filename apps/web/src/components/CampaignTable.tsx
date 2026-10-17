import type { CampaignRecord } from "../types";
import { Avatar } from "./Avatar";
import { ArrowUpRightIcon, CalendarIcon, ChevronDownIcon, ChevronRightIcon, ClockIcon, RefreshIcon, SendIcon, StarIcon } from "./Icons";

interface CampaignTableProps {
  mode: "scheduled" | "sent";
  records: CampaignRecord[];
  loading: boolean;
  error?: string;
  selectedId?: string | null;
  onSelect?: (record: CampaignRecord) => void;
  onRetry: () => void;
}

function formatDate(value: string | undefined): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const difference = date.getTime() - Date.now();
  const minutes = Math.round(Math.abs(difference) / 60000);
  if (minutes < 60) return difference >= 0 ? `in ${Math.max(1, minutes)} min` : `${Math.max(1, minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return difference >= 0 ? `in ${hours} hr` : `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return difference >= 0 ? `in ${days} days` : `${days} days ago`;
}

function statusLabel(status: CampaignRecord["status"], mode: CampaignTableProps["mode"]): string {
  if (status === "paused") return "Paused";
  if (status === "sending") return "Sending";
  if (status === "rate_limited") return "Rate limited";
  if (status === "needs_review" || status === "failed") return "Needs attention";
  return mode === "sent" ? "Sent" : "Scheduled";
}

function statusClass(status: CampaignRecord["status"], mode: CampaignTableProps["mode"]): string {
  if (status === "failed" || status === "needs_review") return "status-danger";
  if (status === "paused") return "status-muted";
  return mode === "sent" ? "status-sent" : "status-scheduled";
}

function StatusBadge({ record, mode }: { record: CampaignRecord; mode: CampaignTableProps["mode"] }) {
  return (
    <span className={`status-badge ${statusClass(record.status, mode)}`}>
      <span className="status-dot" />
      {statusLabel(record.status, mode)}
    </span>
  );
}

function TableSkeleton({ mode }: { mode: CampaignTableProps["mode"] }) {
  return (
    <div className="email-list-loading" aria-label={`Loading ${mode} emails`} role="status" aria-live="polite">
      {Array.from({ length: 5 }).map((_, index) => (
        <div className="email-skeleton-row" key={index}>
          <span className="skeleton-avatar" />
          <span className="skeleton-lines"><i /><i /><i /></span>
          <span className="skeleton-date" />
          <span className="skeleton-pill" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ mode }: { mode: CampaignTableProps["mode"] }) {
  return (
    <div className="table-empty">
      <span className="empty-icon">{mode === "scheduled" ? <CalendarIcon size={21} /> : <SendIcon size={21} />}</span>
      <strong>{mode === "scheduled" ? "Nothing scheduled yet" : "No sent emails yet"}</strong>
      <p>{mode === "scheduled" ? "Compose an email and choose a future time. It will appear here while it waits to send." : "Once an email leaves your workspace, its delivery details will settle here."}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="table-empty table-error-state">
      <span className="empty-icon empty-icon-error"><RefreshIcon size={21} /></span>
      <strong>Couldn’t load this mailbox</strong>
      <p>{message}</p>
      <button type="button" className="button button-small button-ghost" onClick={onRetry}>Try again</button>
    </div>
  );
}

function bodyPreview(record: CampaignRecord, mode: CampaignTableProps["mode"]): string {
  const rawBody = record.body?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return rawBody || record.fileName || (mode === "scheduled" ? "Ready for delivery" : "Outbound email");
}

export function CampaignTable({ mode, records, loading, error, selectedId, onSelect, onRetry }: CampaignTableProps) {
  if (loading) return <TableSkeleton mode={mode} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!records.length) return <EmptyState mode={mode} />;

  return (
    <div className="email-list" role="list" aria-label={`${mode} emails`}>
      {records.map((record) => {
        const dateValue = mode === "scheduled" ? record.scheduledAt : record.sentAt || record.scheduledAt;
        const recipient = record.recipient || record.recipientsList?.[0] || `${record.recipients.toLocaleString()} recipients`;
        const label = `${mode === "scheduled" ? "Scheduled" : "Sent"} email to ${recipient}: ${record.subject}`;
        return (
          <div className="email-row-shell" role="listitem" key={record.id}>
            <div
              className={`email-row ${selectedId === record.id ? "is-selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-current={selectedId === record.id ? "true" : undefined}
              onClick={() => onSelect?.(record)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect?.(record);
                }
              }}
            >
              <span className={`email-type-icon ${mode === "scheduled" ? "email-type-scheduled" : "email-type-sent"}`} aria-hidden="true">
                {mode === "scheduled" ? <CalendarIcon size={17} /> : <SendIcon size={17} />}
              </span>
              <span className="email-row-main">
                <span className="email-row-top">
                  <strong><span className="email-row-to-label">To:</span> {recipient}</strong>
                  <span className="email-row-time">
                    <b>{formatRelativeDate(dateValue)}</b>
                    <small>{formatDate(dateValue)}</small>
                  </span>
                </span>
                <span className="email-row-subject">{record.subject}</span>
                <span className="email-row-preview">{bodyPreview(record, mode)}</span>
              </span>
              <span className="email-row-sender">
                <Avatar user={{ name: record.sender, email: record.sender, initials: record.sender.slice(0, 2).toUpperCase() }} size="sm" />
                <span>{record.sender}</span>
              </span>
              <span className="email-row-status">
                <StatusBadge record={record} mode={mode} />
                <span className="email-row-time-badge"><ClockIcon size={12} /> {formatRelativeDate(dateValue)}</span>
                {record.previewUrl ? <a className="preview-link" href={record.previewUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Ethereal preview <ArrowUpRightIcon size={11} /></a> : null}
              </span>
              <span className={`email-row-star ${record.starred ? "is-starred" : ""}`} aria-hidden="true"><StarIcon size={16} filled={Boolean(record.starred)} /></span>
              <span className="email-row-arrow" aria-hidden="true"><ChevronRightIcon size={16} /></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Pagination({ page, pageCount, total, pageSize, onChange }: { page: number; pageCount: number; total: number; pageSize: number; onChange: (page: number) => void }) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="pagination">
      <span>Showing <strong>{start}–{end}</strong> of <strong>{total}</strong></span>
      <div className="pagination-actions">
        <button type="button" className="icon-button pagination-button" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronDownIcon size={16} /></button>
        <span className="pagination-page">{page} <span>/ {pageCount}</span></span>
        <button type="button" className="icon-button pagination-button pagination-next" aria-label="Next page" disabled={page >= pageCount} onClick={() => onChange(page + 1)}><ChevronDownIcon size={16} /></button>
      </div>
    </div>
  );
}
