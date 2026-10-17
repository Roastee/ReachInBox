import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToasts } from "../hooks/useToasts";
import { api, isApiConfigured } from "../lib/api";
import type { CampaignRecord, CreateCampaignPayload } from "../types";
import { CampaignTable, Pagination } from "../components/CampaignTable";
import { ComposeModal } from "../components/ComposeModal";
import { EmailDetail } from "../components/EmailDetail";
import { RefreshIcon, SearchIcon, SendIcon, ClockIcon, PlusIcon, ChevronDownIcon } from "../components/Icons";
import { Sidebar } from "../components/Sidebar";
import { ToastViewport } from "../components/Toast";
import { Topbar } from "../components/Topbar";

type ActiveTab = "scheduled" | "sent";
type ScheduledFilter = "all" | "next24" | "next7";
type SentFilter = "all" | "delivered" | "attention";
type EmailAction = "star" | "archive" | "delete";

function getActiveTab(value: string | null): ActiveTab {
  return value === "sent" ? "sent" : "scheduled";
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function filterScheduled(records: CampaignRecord[], filter: ScheduledFilter): CampaignRecord[] {
  if (filter === "all") return records;
  const now = Date.now();
  const windowEnd = now + (filter === "next24" ? 24 : 24 * 7) * 60 * 60 * 1000;
  return records.filter((record) => {
    const timestamp = record.scheduledAt ? new Date(record.scheduledAt).getTime() : 0;
    return timestamp >= now && timestamp <= windowEnd;
  });
}

function filterSent(records: CampaignRecord[], filter: SentFilter): CampaignRecord[] {
  if (filter === "all") return records;
  if (filter === "delivered") return records.filter((record) => (record.bounced ?? 0) === 0);
  return records.filter((record) => record.status === "failed" || record.status === "needs_review" || (record.bounced ?? 0) > 0);
}

function removeRecord(records: CampaignRecord[], id: string): CampaignRecord[] {
  return records.filter((record) => record.id !== id);
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isPreview, logout } = useAuth();
  const { toasts, addToast, removeToast } = useToasts();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [scheduled, setScheduled] = useState<CampaignRecord[]>([]);
  const [sent, setSent] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<{ scheduled?: string; sent?: string }>({});
  const [search, setSearch] = useState("");
  const [scheduledFilter, setScheduledFilter] = useState<ScheduledFilter>("all");
  const [sentFilter, setSentFilter] = useState<SentFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<CampaignRecord | null>(null);
  const [detailError, setDetailError] = useState<string | undefined>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [isConnectingSlack, setIsConnectingSlack] = useState(false);
  const requestId = useRef(0);

  const demoMode = isPreview;
  const activeTab = getActiveTab(searchParams.get("tab"));

  const loadCampaigns = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);
    setErrors({});

    // Preview mode starts with an intentionally empty mailbox. Composed messages
    // are added locally, so the preview never presents invented recipient data.
    if (demoMode) {
      setSlackConnected(false);
      setLoading(false);
      return;
    }

    const [scheduledResult, sentResult, slackResult] = await Promise.allSettled([
      api.listCampaigns("scheduled", search),
      api.listCampaigns("sent", search),
      api.getSlackStatus(),
    ]);

    if (requestId.current !== currentRequest) return;

    const nextErrors: { scheduled?: string; sent?: string } = {};
    if (scheduledResult.status === "fulfilled") setScheduled(scheduledResult.value.items);
    else nextErrors.scheduled = scheduledResult.reason instanceof Error ? scheduledResult.reason.message : "Unable to load scheduled emails.";
    if (sentResult.status === "fulfilled") setSent(sentResult.value.items);
    else nextErrors.sent = sentResult.reason instanceof Error ? sentResult.reason.message : "Unable to load sent emails.";
    if (slackResult.status === "fulfilled") setSlackConnected(slackResult.value.connected);
    setErrors(nextErrors);
    setLoading(false);
  }, [demoMode, search]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (!selectedEmail) return;
    const currentRecords = activeTab === "scheduled" ? scheduled : sent;
    const freshRecord = currentRecords.find((record) => record.id === selectedEmail.id);
    if (!freshRecord) {
      setSelectedEmail(null);
      setDetailError(undefined);
    }
  }, [activeTab, scheduled, selectedEmail, sent]);

  const sourceRecords = activeTab === "scheduled" ? scheduled : sent;
  const filteredRecords = useMemo(() => {
    const scopedRecords = activeTab === "scheduled"
      ? filterScheduled(sourceRecords, scheduledFilter)
      : filterSent(sourceRecords, sentFilter);
    const needle = normalizeSearch(search);
    if (!needle) return scopedRecords;
    return scopedRecords.filter((record) => (
      `${record.subject} ${record.sender} ${record.recipient ?? ""} ${record.fileName ?? ""} ${record.body ?? ""}`
        .toLowerCase()
        .includes(needle)
    ));
  }, [activeTab, scheduledFilter, search, sentFilter, sourceRecords]);

  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const visibleRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, scheduledFilter, sentFilter]);

  const selectTab = (tab: ActiveTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    setSearchParams(nextParams);
    setSelectedEmail(null);
    setDetailError(undefined);
    setMobileNavOpen(false);
  };

  const selectEmail = async (record: CampaignRecord) => {
    setSelectedEmail(record);
    setDetailError(undefined);
    if (demoMode) {
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    try {
      setSelectedEmail(await api.getEmail(record.id, activeTab));
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "We could not open this email.");
    } finally {
      setDetailLoading(false);
    }
  };

  const updateRecord = (id: string, updater: (record: CampaignRecord) => CampaignRecord) => {
    setScheduled((records) => records.map((record) => record.id === id ? updater(record) : record));
    setSent((records) => records.map((record) => record.id === id ? updater(record) : record));
    setSelectedEmail((record) => record?.id === id ? updater(record) : record);
  };

  const handleEmailAction = async (email: CampaignRecord, action: EmailAction) => {
    if (demoMode) {
      if (action === "star") {
        updateRecord(email.id, (record) => ({ ...record, starred: !record.starred }));
        addToast({ tone: "success", title: email.starred ? "Removed star" : "Email starred", message: "Preview mailbox updated." });
      } else {
        setScheduled((records) => removeRecord(records, email.id));
        setSent((records) => removeRecord(records, email.id));
        setSelectedEmail(null);
        addToast({ tone: "success", title: action === "archive" ? "Email archived" : "Email deleted", message: "Preview mailbox updated." });
      }
      return;
    }

    try {
      if (action === "star") await api.starEmail(email.id);
      if (action === "archive") await api.archiveEmail(email.id);
      if (action === "delete") await api.deleteEmail(email.id);

      if (action === "star") {
        updateRecord(email.id, (record) => ({ ...record, starred: !record.starred }));
      } else {
        setScheduled((records) => removeRecord(records, email.id));
        setSent((records) => removeRecord(records, email.id));
        setSelectedEmail(null);
      }
      addToast({
        tone: "success",
        title: action === "star" ? (email.starred ? "Removed star" : "Email starred") : action === "archive" ? "Email archived" : "Email deleted",
      });
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "We could not update this email.");
      addToast({ tone: "error", title: "Email action failed", message: error instanceof Error ? error.message : "Try again in a moment." });
    }
  };

  const handleCreateCampaign = async (payload: CreateCampaignPayload) => {
    if (demoMode) {
      const record: CampaignRecord = {
        id: `preview-${Date.now()}`,
        subject: payload.subject,
        body: payload.body,
        bodyHtml: payload.bodyHtml,
        sender: payload.sender,
        recipient: payload.recipients[0],
        recipientsList: payload.recipients,
        recipients: payload.recipients.length,
        attachments: payload.attachments?.map((attachment) => ({ name: attachment.name, size: attachment.size, contentType: attachment.type })),
        scheduledAt: payload.scheduledAt,
        delaySeconds: payload.delaySeconds,
        hourlyLimit: payload.hourlyLimit,
        fileName: payload.fileName,
        status: "scheduled",
      };
      setScheduled((records) => [record, ...records]);
    } else {
      await api.createCampaign(payload);
      await loadCampaigns();
    }
    selectTab("scheduled");
    addToast({ tone: "success", title: "Email scheduled", message: `${payload.recipients.length.toLocaleString()} recipients are queued.` });
  };

  const handleConnectSlack = async () => {
    if (isConnectingSlack) return;
    if (demoMode) {
      setSlackConnected((current) => !current);
      addToast({ tone: "success", title: slackConnected ? "Slack disconnected" : "Slack connected", message: "Preview integration state updated." });
      return;
    }
    if (slackConnected) {
      setIsConnectingSlack(true);
      try {
        await api.disconnectSlack();
        setSlackConnected(false);
        addToast({ tone: "success", title: "Slack disconnected", message: "Slack alerts are off for this workspace." });
      } catch (error) {
        addToast({ tone: "error", title: "Slack disconnect failed", message: error instanceof Error ? error.message : "Try again in a moment." });
      } finally {
        setIsConnectingSlack(false);
      }
      return;
    }
    if (!isApiConfigured) {
      addToast({ tone: "info", title: "Connect your API first", message: "Set VITE_API_URL to enable Slack connections." });
      return;
    }
    setIsConnectingSlack(true);
    api.connectSlack();
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const userValue = user ?? { id: "unknown", name: "ReachInbox user", email: "", initials: "RI" };
  const viewLabel = activeTab === "scheduled" ? "Scheduled" : "Sent";
  const currentError = activeTab === "scheduled" ? errors.scheduled : errors.sent;
  const currentFilter = activeTab === "scheduled" ? scheduledFilter : sentFilter;

  return (
    <div className="mail-app-shell">
      <Sidebar
        user={userValue}
        open={mobileNavOpen}
        activeTab={activeTab}
        scheduledCount={scheduled.length}
        sentCount={sent.length}
        slackConnected={slackConnected}
        onClose={() => setMobileNavOpen(false)}
        onCompose={() => { setComposeOpen(true); setMobileNavOpen(false); }}
        onConnectSlack={() => void handleConnectSlack()}
        onLogout={() => void handleLogout()}
      />

      <div className="mail-app-main">
        <Topbar
          user={userValue}
          viewLabel={viewLabel}
          search={search}
          onSearchChange={setSearch}
          onOpenMenu={() => setMobileNavOpen(true)}
          onLogout={() => void handleLogout()}
        />

        <main className="mail-main">
          <section className="mail-heading">
            <div>
              <span className="mail-eyebrow">ReachInbox / Mailbox</span>
              <h1>{viewLabel}</h1>
              <p>{activeTab === "scheduled" ? "Keep an eye on what is queued for a thoughtful send." : "Review every message that has left your workspace."}</p>
            </div>
            <button type="button" className="button button-primary compose-trigger" onClick={() => setComposeOpen(true)}>
              <PlusIcon size={17} /> Compose
            </button>
          </section>

          <section className="mail-panel" aria-label={`${viewLabel} email mailbox`}>
            <div className="mail-panel-toolbar">
              <div className="mail-tabs" role="tablist" aria-label="Mailbox views">
                <button type="button" role="tab" aria-selected={activeTab === "scheduled"} className={`mail-tab ${activeTab === "scheduled" ? "is-active" : ""}`} onClick={() => selectTab("scheduled")}>
                  <ClockIcon size={15} /> Scheduled <span>{scheduled.length}</span>
                </button>
                <button type="button" role="tab" aria-selected={activeTab === "sent"} className={`mail-tab ${activeTab === "sent" ? "is-active" : ""}`} onClick={() => selectTab("sent")}>
                  <SendIcon size={15} /> Sent <span>{sent.length}</span>
                </button>
              </div>

              <div className="mail-controls">
                <label className="mail-search">
                  <SearchIcon size={15} />
                  <span className="sr-only">Search {viewLabel.toLowerCase()} emails</span>
                  <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search emails" />
                </label>
                <label className="mail-filter">
                  <span className="sr-only">Filter {viewLabel.toLowerCase()} emails</span>
                  <select value={currentFilter} onChange={(event) => activeTab === "scheduled" ? setScheduledFilter(event.target.value as ScheduledFilter) : setSentFilter(event.target.value as SentFilter)}>
                    {activeTab === "scheduled" ? <><option value="all">All scheduled</option><option value="next24">Next 24 hours</option><option value="next7">Next 7 days</option></> : <><option value="all">All sent</option><option value="delivered">Fully delivered</option><option value="attention">Needs attention</option></>}
                  </select>
                  <ChevronDownIcon size={14} />
                </label>
                <button type="button" className="icon-button mail-refresh" aria-label="Refresh mailbox" title="Refresh mailbox" onClick={() => void loadCampaigns()} disabled={loading}>
                  <RefreshIcon size={16} className={loading ? "spin" : ""} />
                </button>
              </div>
            </div>

            <div className={`mail-workspace ${selectedEmail ? "has-selection" : ""}`}>
              <div className="mail-list-pane">
                <div className="mail-list-meta">
                  <span>{loading ? "Loading messages…" : `${filteredRecords.length} ${filteredRecords.length === 1 ? "message" : "messages"}`}</span>
                  <span>{activeTab === "scheduled" ? "Sorted by send time" : "Sorted by most recent"}</span>
                </div>
                <CampaignTable
                  mode={activeTab}
                  records={visibleRecords}
                  loading={loading}
                  error={currentError}
                  selectedId={selectedEmail?.id}
                  onSelect={(record) => void selectEmail(record)}
                  onRetry={() => void loadCampaigns()}
                />
                <Pagination page={page} pageCount={pageCount} total={filteredRecords.length} pageSize={pageSize} onChange={setPage} />
              </div>
              <EmailDetail
                email={selectedEmail}
                loading={detailLoading}
                error={detailError}
                onClose={() => setSelectedEmail(null)}
                onStar={(email) => void handleEmailAction(email, "star")}
                onArchive={(email) => void handleEmailAction(email, "archive")}
                onDelete={(email) => void handleEmailAction(email, "delete")}
              />
            </div>
          </section>
        </main>
      </div>

      <ComposeModal
        open={composeOpen}
        defaultSender={userValue.email}
        onClose={() => setComposeOpen(false)}
        onSubmit={handleCreateCampaign}
      />
      <ToastViewport toasts={toasts} onClose={removeToast} />
    </div>
  );
}
