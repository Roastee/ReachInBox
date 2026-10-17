import type { CampaignRecord } from "../types";
import { ArchiveIcon, ArrowRightIcon, StarIcon, TrashIcon, XIcon } from "./Icons";
import { Avatar } from "./Avatar";

interface EmailDetailProps {
  email: CampaignRecord | null;
  loading: boolean;
  error?: string;
  onClose?: () => void;
  onStar: (email: CampaignRecord) => void;
  onArchive: (email: CampaignRecord) => void;
  onDelete: (email: CampaignRecord) => void;
}

function formatFullDate(value: string | undefined): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function safeHtml(value: string): { __html: string } {
  const template = document.createElement("template");
  template.innerHTML = value;
  template.content.querySelectorAll("script,style,iframe,object,embed,form").forEach((element) => element.remove());
  template.content.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith("on") || (attribute.name.toLowerCase() === "href" && attribute.value.trim().toLowerCase().startsWith("javascript:"))) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return { __html: template.innerHTML };
}

function DetailPlaceholder({ loading, error }: Pick<EmailDetailProps, "loading" | "error">) {
  return (
    <section className="email-detail email-detail-placeholder" aria-live="polite">
      {loading ? <><span className="detail-loading-mark" /><strong>Opening email…</strong><p>Loading the message and its delivery details.</p></> : <><span className="detail-placeholder-mark"><ArrowRightIcon size={18} /></span><strong>Select an email</strong><p>Choose a message from your queue to read it here.</p>{error ? <span className="detail-error-copy">{error}</span> : null}</>}
    </section>
  );
}

export function EmailDetail({ email, loading, error, onClose, onStar, onArchive, onDelete }: EmailDetailProps) {
  if (!email || loading) return <DetailPlaceholder loading={loading} error={error} />;

  const isScheduled = Boolean(email.scheduledAt && !email.sentAt && email.status !== "sent");
  const dateValue = isScheduled ? email.scheduledAt : email.sentAt || email.scheduledAt;
  const recipient = email.recipient || email.recipientsList?.[0] || `${email.recipients.toLocaleString()} recipients`;

  return (
    <section className="email-detail" aria-labelledby="email-detail-subject">
      <header className="detail-toolbar">
        <div className="detail-toolbar-left"><span className={`detail-status-dot ${isScheduled ? "is-scheduled" : "is-sent"}`} />{isScheduled ? "Scheduled email" : "Sent email"}</div>
        <div className="detail-toolbar-actions">
          {onClose ? <button type="button" className="icon-button detail-close-mobile" aria-label="Close email detail" onClick={onClose}><XIcon size={17} /></button> : null}
          <button type="button" className={`icon-button detail-action ${email.starred ? "is-starred" : ""}`} aria-label={email.starred ? "Unstar email" : "Star email"} title={email.starred ? "Unstar" : "Star"} onClick={() => onStar(email)}><StarIcon size={18} filled={Boolean(email.starred)} /></button>
          <button type="button" className="icon-button detail-action" aria-label="Archive email" title="Archive" onClick={() => onArchive(email)}><ArchiveIcon size={18} /></button>
          <button type="button" className="icon-button detail-action detail-delete" aria-label="Delete email" title="Delete" onClick={() => onDelete(email)}><TrashIcon size={18} /></button>
        </div>
      </header>

      <article className="detail-content">
        {error ? <div className="detail-inline-error" role="status">{error} Showing the list preview instead.</div> : null}
        <div className="detail-subject-row"><h2 id="email-detail-subject">{email.subject}</h2><span className={`status-badge ${isScheduled ? "status-scheduled" : "status-sent"}`}><span className="status-dot" />{isScheduled ? "Scheduled" : "Sent"}</span></div>
        <div className="detail-meta">
          <Avatar user={{ name: email.sender, email: email.sender, initials: email.sender.slice(0, 2).toUpperCase() }} size="md" />
          <div className="detail-meta-copy"><strong>{email.sender}</strong><span>to {recipient}</span></div>
          <time dateTime={dateValue}>{formatFullDate(dateValue)}</time>
        </div>
        <div className="detail-recipient-line"><span>From</span><strong>{email.sender}</strong><span>·</span><span>To</span><strong>{recipient}</strong></div>
        <div className="detail-body">{email.bodyHtml ? <div dangerouslySetInnerHTML={safeHtml(email.bodyHtml)} /> : <p>{email.body || "This email does not include a message preview."}</p>}</div>
        {email.attachments?.length ? <div className="detail-attachments"><span className="detail-section-label">Attachments</span>{email.attachments.map((attachment) => <a href={attachment.url || "#"} key={attachment.id || attachment.name} onClick={(event) => { if (!attachment.url) event.preventDefault(); }}><span>{attachment.name}</span><small>{attachment.size ? `${Math.round(attachment.size / 1024)} KB` : "Attachment"}</small></a>)}</div> : null}
        <div className="detail-footer-actions"><button type="button" className="button button-secondary" onClick={() => onStar(email)}><StarIcon size={15} filled={Boolean(email.starred)} />{email.starred ? "Starred" : "Star"}</button><button type="button" className="button button-secondary" onClick={() => onArchive(email)}><ArchiveIcon size={15} /> Archive</button><button type="button" className="button button-danger" onClick={() => onDelete(email)}><TrashIcon size={15} /> Delete</button></div>
      </article>
    </section>
  );
}
