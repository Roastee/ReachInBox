import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import type { CreateCampaignPayload, CsvPreviewRow } from "../types";
import { parseRecipientText, type ParsedRecipients } from "../lib/csv";
import {
  AlignLeftIcon,
  ArchiveIcon,
  BoldIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  PaperclipIcon,
  UnderlineIcon,
  UploadIcon,
  XIcon,
} from "./Icons";

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateCampaignPayload) => Promise<void>;
  defaultSender?: string;
}

interface ComposeForm {
  subject: string;
  body: string;
  bodyHtml: string;
  sender: string;
  scheduledAt: string;
  delaySeconds: string;
  hourlyLimit: string;
}

function defaultDateTime(offsetMinutes = 60): string {
  const date = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

const initialForm = (defaultSender: string): ComposeForm => ({
  subject: "",
  body: "",
  bodyHtml: "",
  sender: defaultSender,
  scheduledAt: defaultDateTime(),
  delaySeconds: "15",
  hourlyLimit: "100",
});

function FieldLabel({ children, hint, htmlFor }: { children: ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <div className="field-label-row">
      <label className="field-label" htmlFor={htmlFor}>{children}</label>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

function PreviewStatus({ row }: { row: CsvPreviewRow }) {
  if (row.duplicate) return <span className="preview-status preview-status-duplicate">Duplicate</span>;
  if (row.valid) return <span className="preview-status preview-status-valid"><CheckIcon size={12} /> Ready</span>;
  return <span className="preview-status preview-status-invalid">Invalid</span>;
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ComposeModal({ open, onClose, onSubmit, defaultSender = "" }: ComposeModalProps) {
  const [form, setForm] = useState<ComposeForm>(() => initialForm(defaultSender));
  const [recipientFile, setRecipientFile] = useState<ParsedRecipients | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [manualRecipients, setManualRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isCustomSender, setIsCustomSender] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const sendLaterRef = useRef<HTMLDivElement>(null);

  const senderOptions = useMemo(() => Array.from(new Set([defaultSender].filter(Boolean))), [defaultSender]);
  const recipients = useMemo(
    () => Array.from(new Set([...(recipientFile?.emails ?? []), ...manualRecipients])),
    [manualRecipients, recipientFile],
  );

  useEffect(() => {
    if (!open) return;
    setForm(initialForm(defaultSender));
    setRecipientFile(null);
    setSourceFile(null);
    setManualRecipients([]);
    setRecipientInput("");
    setAttachments([]);
    setIsCustomSender(false);
    setError("");
    setIsSubmitting(false);
    setSendLaterOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    if (editorRef.current) editorRef.current.innerHTML = "";
  }, [defaultSender, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        if (sendLaterOpen) {
          event.preventDefault();
          setSendLaterOpen(false);
          return;
        }
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable='true'], a[href]") ?? [])
        .filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isSubmitting, onClose, open, sendLaterOpen]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => document.getElementById("campaign-subject")?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open || !sendLaterOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (sendLaterRef.current && !sendLaterRef.current.contains(event.target as Node)) setSendLaterOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, sendLaterOpen]);

  if (!open) return null;

  const updateField = (field: keyof ComposeForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  };

  const syncEditor = () => {
    const editor = editorRef.current;
    if (!editor) return;
    updateField("bodyHtml", editor.innerHTML);
    updateField("body", editor.innerText.replace(/\u00a0/g, " ").trim());
  };

  const runEditorCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditor();
  };

  const addRecipients = (value: string) => {
    const values = value.split(/[\s,;]+/).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
    if (!values.length) return;
    const invalid = values.find((entry) => !/^\S+@\S+\.\S+$/.test(entry));
    if (invalid) {
      setError(`“${invalid}” is not a valid email address.`);
      return;
    }
    setManualRecipients((current) => Array.from(new Set([...current, ...values])));
    setRecipientInput("");
    setError("");
  };

  const handleRecipientKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "," || event.key === ";" || event.key === "Tab") {
      if (recipientInput.trim()) {
        event.preventDefault();
        addRecipients(recipientInput);
      }
    }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError("Upload a CSV or text file with one recipient per row.");
      return;
    }
    setIsReading(true);
    setError("");
    try {
      const text = await file.text();
      setRecipientFile(parseRecipientText(text, file.name));
      setSourceFile(file);
    } catch {
      setError("We could not read that file. Try exporting it as CSV or TXT.");
    } finally {
      setIsReading(false);
    }
  };

  const handleAttachments = (files: FileList | null) => {
    if (!files) return;
    setAttachments((current) => [...current, ...Array.from(files)]);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  };

  const choosePreset = (minutes: number) => {
    updateField("scheduledAt", defaultDateTime(minutes));
    setSendLaterOpen(false);
  };

  const chooseTomorrowMorning = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    const offset = date.getTimezoneOffset();
    updateField("scheduledAt", new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16));
    setSendLaterOpen(false);
  };

  const validate = (recipientList = recipients): string | null => {
    if (!form.subject.trim()) return "Add a subject before scheduling.";
    if (!form.body.trim()) return "Write the message before scheduling.";
    if (!/^\S+@\S+\.\S+$/.test(form.sender.trim())) return "Choose a valid sender email.";
    if (!recipientList.length) return "Add at least one recipient or upload a recipient list.";
    if (!form.scheduledAt || new Date(form.scheduledAt).getTime() <= Date.now()) return "Choose a future send time.";
    if (Number(form.delaySeconds) < 0 || !Number.isFinite(Number(form.delaySeconds))) return "Add a valid delay between messages.";
    if (Number(form.hourlyLimit) <= 0 || !Number.isFinite(Number(form.hourlyLimit))) return "Add a valid hourly limit.";
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const pendingRecipients = recipientInput.split(/[\s,;]+/).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
    const invalidPending = pendingRecipients.find((entry) => !/^\S+@\S+\.\S+$/.test(entry));
    const submitRecipients = Array.from(new Set([...recipients, ...pendingRecipients]));
    if (invalidPending) {
      setError(`“${invalidPending}” is not a valid email address.`);
      return;
    }
    const validationError = validate(submitRecipients);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const hasManualRecipients = manualRecipients.length > 0 || pendingRecipients.length > 0 || (!sourceFile && submitRecipients.length > 0);
      const recipientUpload = hasManualRecipients
        ? new File([submitRecipients.join("\n")], recipientFile?.fileName || "recipients.txt", { type: "text/plain" })
        : sourceFile ?? undefined;
      await onSubmit({
        subject: form.subject.trim(),
        body: form.body.trim(),
        bodyHtml: form.bodyHtml || form.body.trim(),
        sender: form.sender.trim(),
        recipients: submitRecipients,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        delaySeconds: Number(form.delaySeconds),
        hourlyLimit: Number(form.hourlyLimit),
        fileName: recipientFile?.fileName,
        file: recipientUpload,
        attachments,
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We could not schedule this email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isSubmitting && onClose()}>
      <section ref={dialogRef} className="compose-modal" role="dialog" aria-modal="true" aria-labelledby="compose-title" aria-describedby="compose-description" tabIndex={-1}>
        <div className="compose-header">
          <div>
            <span className="compose-kicker">New email</span>
            <h2 id="compose-title">Compose a new email</h2>
            <p id="compose-description">Write once, choose the rhythm, and ReachInbox will take it from there.</p>
          </div>
          <button type="button" className="icon-button modal-close" aria-label="Close compose" onClick={onClose} disabled={isSubmitting}><XIcon size={19} /></button>
        </div>

        <form ref={formRef} className="compose-form" onSubmit={handleSubmit}>
          <div className="compose-main-grid">
            <div className="compose-editor-column">
              <div className="compose-row compose-from-row">
                <label className="compose-inline-label" htmlFor="campaign-sender">From</label>
                {!isCustomSender ? (
                  <select id="campaign-sender" className="compose-select compose-from-select" value={form.sender || senderOptions[0] || ""} onChange={(event) => {
                    if (event.target.value === "__custom__") {
                      setIsCustomSender(true);
                      updateField("sender", "");
                    } else updateField("sender", event.target.value);
                  }}>
                    {senderOptions.length ? senderOptions.map((sender) => <option key={sender} value={sender}>{sender}</option>) : <option value="">Add a sender email</option>}
                    <option value="__custom__">Use another sender…</option>
                  </select>
                ) : (
                  <div className="compose-custom-sender"><input id="campaign-sender" className="compose-text-input" type="email" value={form.sender} onChange={(event) => updateField("sender", event.target.value)} placeholder="sender@company.com" /><button type="button" className="text-link-button" onClick={() => { setIsCustomSender(false); updateField("sender", senderOptions[0] ?? ""); }}>Use account email</button></div>
                )}
              </div>

              <div className="compose-row compose-recipients-row">
                <label className="compose-inline-label" htmlFor="recipient-input">To</label>
                <div className="recipient-chip-field">
                  {recipients.slice(0, 10).map((recipient) => <span className="recipient-chip" key={recipient}>{recipient}{manualRecipients.includes(recipient) ? <button type="button" aria-label={`Remove ${recipient}`} onClick={() => setManualRecipients((current) => current.filter((entry) => entry !== recipient))}><XIcon size={12} /></button> : null}</span>)}
                  {recipients.length > 10 ? <span className="recipient-chip recipient-chip-more">+{recipients.length - 10} more</span> : null}
                  <input id="recipient-input" value={recipientInput} onChange={(event) => setRecipientInput(event.target.value)} onKeyDown={handleRecipientKeyDown} onBlur={() => { if (recipientInput.trim()) addRecipients(recipientInput); }} placeholder={recipients.length ? "Add another recipient" : "Add recipients or upload a list"} />
                </div>
              </div>

              <div className="compose-field">
                <FieldLabel htmlFor="campaign-subject">Subject</FieldLabel>
                <input id="campaign-subject" className="compose-text-input compose-subject-input" value={form.subject} onChange={(event) => updateField("subject", event.target.value)} placeholder="A thoughtful note for your next customer" autoFocus />
              </div>

              <div className="compose-field compose-message-field">
                <FieldLabel htmlFor="campaign-body" hint={`${form.body.length}/4,000`}>Message</FieldLabel>
                <div className="rich-editor-shell">
                  <div className="rich-toolbar" aria-label="Message formatting">
                    <button type="button" aria-label="Bold" title="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand("bold")}><BoldIcon size={15} /></button>
                    <button type="button" aria-label="Italic" title="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand("italic")}><ItalicIcon size={15} /></button>
                    <button type="button" aria-label="Underline" title="Underline" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand("underline")}><UnderlineIcon size={15} /></button>
                    <span className="toolbar-divider" />
                    <button type="button" aria-label="Bulleted list" title="Bulleted list" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand("insertUnorderedList")}><ListIcon size={15} /></button>
                    <button type="button" aria-label="Align left" title="Align left" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand("justifyLeft")}><AlignLeftIcon size={15} /></button>
                    <button type="button" aria-label="Add link" title="Add link" onMouseDown={(event) => event.preventDefault()} onClick={() => { const url = window.prompt("Link URL"); if (url) runEditorCommand("createLink", url); }}><LinkIcon size={15} /></button>
                  </div>
                  <div id="campaign-body" ref={editorRef} className="rich-editor" contentEditable role="textbox" aria-multiline="true" data-placeholder="Hi {{first_name}},\n\nI wanted to share a quick idea…" onInput={syncEditor} />
                  <div className="rich-editor-footer"><span>Use <code>{"{{first_name}}"}</code> to personalize each message.</span><span><ArchiveIcon size={13} /> Rich text supported</span></div>
                </div>
              </div>
            </div>

            <aside className="compose-settings-column">
              <section className="compose-side-section">
                <div className="compose-side-heading"><span>Audience file</span><span className="compose-side-number">01</span></div>
                <input ref={fileInputRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(event) => void handleFile(event.target.files?.[0])} />
                <button type="button" className={`upload-zone ${recipientFile ? "has-file" : ""}`} onClick={() => fileInputRef.current?.click()} disabled={isReading}>
                  <span className="upload-icon">{recipientFile ? <CheckIcon size={18} /> : <UploadIcon size={18} />}</span>
                  <span className="upload-copy"><strong>{isReading ? "Reading recipients…" : recipientFile ? recipientFile.fileName : "Upload CSV or TXT"}</strong><span>{recipientFile ? `${recipientFile.validCount.toLocaleString()} ready to send` : "One recipient per row"}</span></span>
                  <PaperclipIcon size={16} />
                </button>
                {recipientFile ? <>
                  <div className="recipient-summary"><div><strong>{recipientFile.totalRows.toLocaleString()}</strong><span>Rows</span></div><div className="recipient-stat-good"><strong>{recipientFile.validCount.toLocaleString()}</strong><span>Ready</span></div><div className="recipient-stat-warn"><strong>{recipientFile.invalidCount.toLocaleString()}</strong><span>Invalid</span></div><div><strong>{recipientFile.duplicateCount.toLocaleString()}</strong><span>Duplicates</span></div></div>
                  <button type="button" className="text-link-button audience-clear" onClick={() => { setRecipientFile(null); setSourceFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>Remove uploaded list</button>
                </> : <p className="audience-helper">You can also paste addresses into the To field above.</p>}
                {recipientFile?.preview.length ? <div className="preview-list"><div className="preview-list-head"><span>Preview</span><span>Status</span></div>{recipientFile.preview.map((row, index) => <div className="preview-row" key={`${row.value}-${index}`}><span title={row.value}>{row.value}</span><PreviewStatus row={row} /></div>)}</div> : null}
              </section>

              <section className="compose-side-section">
                <div className="compose-side-heading"><span>Send rhythm</span><span className="compose-side-number">02</span></div>
                <div className="compose-field compact-field"><FieldLabel htmlFor="campaign-start">Send later</FieldLabel><div className="input-with-leading-icon"><CalendarIcon size={16} /><input id="campaign-start" className="compose-text-input" type="datetime-local" value={form.scheduledAt} onChange={(event) => updateField("scheduledAt", event.target.value)} /></div></div>
                <div className="two-fields"><div className="compose-field compact-field"><FieldLabel htmlFor="campaign-delay" hint="seconds">Delay</FieldLabel><div className="input-with-trailing"><input id="campaign-delay" className="compose-text-input" type="number" min="0" step="1" value={form.delaySeconds} onChange={(event) => updateField("delaySeconds", event.target.value)} /><span>sec</span></div></div><div className="compose-field compact-field"><FieldLabel htmlFor="campaign-limit" hint="per hour">Limit</FieldLabel><div className="input-with-trailing"><input id="campaign-limit" className="compose-text-input" type="number" min="1" step="1" value={form.hourlyLimit} onChange={(event) => updateField("hourlyLimit", event.target.value)} /><span>/hr</span></div></div></div>
              </section>

              <section className="compose-side-section compose-attachments-section">
                <div className="compose-side-heading"><span>Attachments</span><span className="compose-side-number">03</span></div>
                <input ref={attachmentInputRef} type="file" multiple className="sr-only" onChange={(event) => handleAttachments(event.target.files)} />
                <button type="button" className="attachment-add" onClick={() => attachmentInputRef.current?.click()}><PaperclipIcon size={15} /> Add files</button>
                {attachments.length ? <div className="attachment-list">{attachments.map((attachment, index) => <div className="attachment-row" key={`${attachment.name}-${index}`}><PaperclipIcon size={14} /><span><strong>{attachment.name}</strong><small>{formatFileSize(attachment.size)}</small></span><button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}><XIcon size={13} /></button></div>)}</div> : <p className="audience-helper">Optional files to send with this email.</p>}
              </section>
            </aside>
          </div>

          {error ? <div className="form-error" role="alert"><span>!</span>{error}</div> : null}

          <footer className="compose-footer">
            <span className="compose-footer-note"><ClockIcon size={15} /> Sends after the time you choose</span>
            <div className="compose-actions"><button type="button" className="button button-ghost" onClick={onClose} disabled={isSubmitting}>Discard</button><div className="send-later-wrap" ref={sendLaterRef}><div className="send-later-button-group"><button type="submit" className="button button-primary send-later-submit" disabled={isSubmitting || isReading}>{isSubmitting ? <span className="button-spinner" /> : <CalendarIcon size={16} />}{isSubmitting ? "Scheduling…" : "Send later"}</button><button type="button" className="button button-primary send-later-toggle" aria-label="Choose send time preset" aria-haspopup="menu" aria-expanded={sendLaterOpen} onClick={() => setSendLaterOpen((current) => !current)} disabled={isSubmitting || isReading}><ChevronDownIcon size={15} /></button></div>{sendLaterOpen ? <div className="send-later-popover" role="menu"><strong>Choose a send time</strong><button type="button" role="menuitem" onClick={() => choosePreset(60)}>In one hour</button><button type="button" role="menuitem" onClick={() => choosePreset(60 * 4)}>In four hours</button><button type="button" role="menuitem" onClick={chooseTomorrowMorning}>Tomorrow at 9:00 AM</button><button type="button" role="menuitem" onClick={() => { setSendLaterOpen(false); document.getElementById("campaign-start")?.focus(); }}>Choose custom time…</button></div> : null}</div></div>
          </footer>
        </form>
      </section>
    </div>
  );
}
