import type { CampaignRecord, User } from "../types";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  FileTextIcon,
  InboxIcon,
  LayersIcon,
  PlugIcon,
  SendIcon,
  SettingsIcon,
  SlackIcon,
  SparklesIcon,
  UsersIcon,
} from "./Icons";

export type WorkspaceViewKind = "overview" | "sequences" | "contacts" | "templates" | "inbox" | "integrations" | "settings";

interface WorkspaceViewProps {
  view: Exclude<WorkspaceViewKind, "overview">;
  user: User;
  scheduled: CampaignRecord[];
  sent: CampaignRecord[];
  slackConnected: boolean;
  onBack: () => void;
  onCompose: () => void;
  onConnectSlack: () => void;
}

const viewCopy: Record<Exclude<WorkspaceViewKind, "overview">, { eyebrow: string; title: string; description: string }> = {
  sequences: {
    eyebrow: "Workspace / sequences",
    title: "A calmer way to keep momentum.",
    description: "Keep every send rhythm visible at a glance. Your live queue still lives in Mail, right where delivery data is freshest.",
  },
  contacts: {
    eyebrow: "Workspace / contacts",
    title: "Bring the right people into focus.",
    description: "Audience files are checked in the composer before they reach the queue. This space keeps that workflow close by.",
  },
  templates: {
    eyebrow: "Workspace / templates",
    title: "Start with a thoughtful first draft.",
    description: "Keep repeatable ideas close, then personalize them before scheduling. Open the composer to turn a draft into a real send.",
  },
  inbox: {
    eyebrow: "Manage / inbox",
    title: "The quiet between sends.",
    description: "Replies and team notes will have a home here as inbox connections come online. Your scheduled and sent data remains available in Mail.",
  },
  integrations: {
    eyebrow: "Manage / integrations",
    title: "Connect the tools around your send.",
    description: "Keep your team in the loop without leaving the workspace. Slack connection status is live below.",
  },
  settings: {
    eyebrow: "Manage / settings",
    title: "Make the workspace feel like yours.",
    description: "Keep the account connected and the delivery preferences visible while real scheduling stays API-backed.",
  },
};

function ViewHeader({ view, onBack }: Pick<WorkspaceViewProps, "view" | "onBack">) {
  const copy = viewCopy[view];
  return (
    <div className="view-header">
      <div>
        <div className="hero-kicker"><span className="hero-kicker-dot" /> {copy.eyebrow}</div>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </div>
      <button type="button" className="button button-secondary view-back-button" onClick={onBack}>
        <ArrowRightIcon size={15} className="view-back-icon" />
        Back to overview
      </button>
    </div>
  );
}

function ViewBadge() {
  return <span className="view-badge"><SparklesIcon size={13} /> Visual navigation</span>;
}

function SequencesView({ scheduled, sent, onCompose }: Pick<WorkspaceViewProps, "scheduled" | "sent" | "onCompose">) {
  const latestScheduled = scheduled.slice(0, 3);
  return (
    <>
      <div className="view-metrics" aria-label="Sequence summary">
        <div className="view-metric view-metric-lime"><span className="view-metric-icon"><LayersIcon size={17} /></span><span><small>Active sequences</small><strong>{scheduled.length.toString().padStart(2, "0")}</strong></span><ArrowUpRightIcon size={15} /></div>
        <div className="view-metric view-metric-orange"><span className="view-metric-icon"><SendIcon size={17} /></span><span><small>Sent sequences</small><strong>{sent.length.toString().padStart(2, "0")}</strong></span><ArrowUpRightIcon size={15} /></div>
        <div className="view-metric view-metric-blue"><span className="view-metric-icon"><SparklesIcon size={17} /></span><span><small>Next handoff</small><strong>{scheduled[0] ? "Ready" : "—"}</strong></span><ArrowUpRightIcon size={15} /></div>
      </div>
      <div className="view-columns">
        <section className="view-card view-card-large">
          <div className="view-card-heading"><div><span className="modal-kicker">In the rhythm</span><h2>Upcoming sequences</h2></div><ViewBadge /></div>
          <div className="sequence-list">
            {latestScheduled.length ? latestScheduled.map((record, index) => (
              <div className="sequence-row" key={record.id}>
                <span className="sequence-index">0{index + 1}</span>
                <span className="sequence-row-copy"><strong>{record.subject}</strong><span>{record.recipient || record.fileName || "Audience list"}</span></span>
                <span className="sequence-row-status"><span className="status-dot" /> Scheduled</span>
              </div>
            )) : <div className="view-empty"><LayersIcon size={19} /><strong>No sequences queued yet</strong><span>Compose a campaign to see its rhythm here.</span></div>}
          </div>
          <button type="button" className="text-button" onClick={onCompose}>Start a new sequence <ArrowRightIcon size={15} /></button>
        </section>
        <aside className="view-card view-card-accent">
          <span className="view-card-mark"><SparklesIcon size={17} /></span>
          <span className="modal-kicker">Good to know</span>
          <h2>Small batches make space for better replies.</h2>
          <p>Use the composer’s delay and hourly limit to keep every sequence at a human pace.</p>
          <span className="view-card-caption">Live controls stay in the compose flow</span>
        </aside>
      </div>
    </>
  );
}

function ContactsView({ scheduled, sent, onCompose }: Pick<WorkspaceViewProps, "scheduled" | "sent" | "onCompose">) {
  const audienceCount = scheduled.reduce((sum, record) => sum + record.recipients, 0) + sent.reduce((sum, record) => sum + record.recipients, 0);
  return (
    <div className="view-columns view-columns-contact">
      <section className="view-card view-card-large">
        <div className="view-card-heading"><div><span className="modal-kicker">Audience workspace</span><h2>Bring in a clean list.</h2></div><ViewBadge /></div>
        <div className="contact-illustration"><div className="contact-orbit contact-orbit-one" /><div className="contact-orbit contact-orbit-two" /><span className="contact-core"><UsersIcon size={22} /></span><span className="contact-token contact-token-one">AK</span><span className="contact-token contact-token-two">JM</span><span className="contact-token contact-token-three">RS</span></div>
        <div className="contact-summary"><strong>{audienceCount.toLocaleString()}</strong><span>recipients have passed through your workspace</span></div>
        <button type="button" className="button button-primary" onClick={onCompose}><UsersIcon size={15} /> Upload an audience</button>
      </section>
      <aside className="view-card view-card-quiet">
        <div className="view-card-heading"><div><span className="modal-kicker">Guardrails</span><h2>Ready before send.</h2></div><CheckIcon size={18} className="view-check" /></div>
        <ul className="view-check-list"><li><CheckIcon size={14} /> CSV and TXT supported</li><li><CheckIcon size={14} /> Duplicate rows identified</li><li><CheckIcon size={14} /> Invalid addresses held back</li></ul>
        <p className="view-note">The composer keeps this validation close to the moment it matters.</p>
      </aside>
    </div>
  );
}

function TemplatesView({ onCompose }: Pick<WorkspaceViewProps, "onCompose">) {
  return (
    <div className="view-columns view-columns-template">
      <section className="view-card template-editor-card">
        <div className="view-card-heading"><div><span className="modal-kicker">Draft library / 01</span><h2>The thoughtful follow-up</h2></div><ViewBadge /></div>
        <div className="template-editor"><div className="template-toolbar"><span /><span /><span /><small>PLAIN TEXT</small></div><div className="template-paper"><span>Hi &#123;&#123;first_name&#125;&#125;,</span><p>I wanted to share a small idea that might make your next launch feel a little lighter.</p><p>Would it be useful to compare notes?</p><span>— Sarah</span></div></div>
        <button type="button" className="text-button" onClick={onCompose}>Use this in a campaign <ArrowRightIcon size={15} /></button>
      </section>
      <aside className="view-card view-card-accent view-card-template-side"><FileTextIcon size={20} /><span className="modal-kicker">A softer system</span><h2>Write once.<br /><em>Make it yours.</em></h2><p>Templates are a starting point, never a substitute for context.</p></aside>
    </div>
  );
}

function InboxView() {
  return (
    <section className="view-card view-card-empty">
      <span className="view-empty-icon"><InboxIcon size={22} /></span>
      <span className="modal-kicker">Inbox preview</span>
      <h2>A quiet inbox is a good sign.</h2>
      <p>When replies are connected, this space will collect them without crowding your send queue.</p>
      <span className="view-badge"><SparklesIcon size={13} /> Coming into focus</span>
    </section>
  );
}

function IntegrationsView({ slackConnected, onConnectSlack }: Pick<WorkspaceViewProps, "slackConnected" | "onConnectSlack">) {
  return (
    <div className="integration-grid">
      <section className={`integration-card integration-card-slack ${slackConnected ? "is-connected" : ""}`}>
        <div className="integration-card-top"><span className="integration-icon integration-icon-slack"><SlackIcon size={20} /></span><span className="integration-state"><span />{slackConnected ? "Connected" : "Available"}</span></div>
        <h2>Slack notifications</h2><p>Stay close to delivery and rate-limit alerts with the team.</p>
        <button type="button" className="button button-primary" onClick={onConnectSlack}>{slackConnected ? "Disconnect Slack" : "Connect Slack"} <ArrowRightIcon size={15} /></button>
      </section>
      <section className="integration-card"><div className="integration-card-top"><span className="integration-icon integration-icon-google"><SparklesIcon size={20} /></span><span className="integration-state integration-state-muted"><span />Core</span></div><h2>Google workspace</h2><p>Sign-in and session access are handled through your existing Google OAuth connection.</p><span className="integration-foot"><CheckIcon size={14} /> Authentication enabled</span></section>
      <section className="integration-card integration-card-muted"><div className="integration-card-top"><span className="integration-icon integration-icon-muted"><PlugIcon size={20} /></span><span className="integration-state integration-state-muted"><span />Soon</span></div><h2>More in your stack</h2><p>Additional team connections will appear here as the workspace grows.</p><span className="integration-foot">Visual navigation frame</span></section>
    </div>
  );
}

function SettingsView({ user }: Pick<WorkspaceViewProps, "user">) {
  return (
    <div className="settings-layout">
       <section className="view-card settings-profile-card"><div className="view-card-heading"><div><span className="modal-kicker">Workspace identity</span><h2>ReachInbox</h2></div><SettingsIcon size={18} /></div><div className="settings-profile"><span className="workspace-avatar">{user.initials?.slice(0, 1) || "R"}</span><span><strong>{user.name}</strong><small>{user.email || "Signed-in workspace member"}</small></span></div><div className="settings-line"><span>Account</span><strong>Authenticated workspace</strong></div><div className="settings-line"><span>Timezone</span><strong>Local workspace time</strong></div></section>
      <section className="view-card settings-preferences-card"><div className="view-card-heading"><div><span className="modal-kicker">Preferences</span><h2>Keep the signal clear.</h2></div><ViewBadge /></div><div className="preference-row"><span><strong>Delivery alerts</strong><small>Surface important queue changes</small></span><span className="fake-toggle is-on"><span /></span></div><div className="preference-row"><span><strong>Quiet hours</strong><small>Follow each campaign’s own rhythm</small></span><span className="fake-toggle"><span /></span></div><p className="view-note">Preference controls are staged here; scheduling continues to use the live API-backed flow.</p></section>
    </div>
  );
}

export function WorkspaceView({ view, user, scheduled, sent, slackConnected, onBack, onCompose, onConnectSlack }: WorkspaceViewProps) {
  return (
    <section className={`workspace-view workspace-view-${view}`}>
      <ViewHeader view={view} onBack={onBack} />
      {view === "sequences" ? <SequencesView scheduled={scheduled} sent={sent} onCompose={onCompose} /> : null}
      {view === "contacts" ? <ContactsView scheduled={scheduled} sent={sent} onCompose={onCompose} /> : null}
      {view === "templates" ? <TemplatesView onCompose={onCompose} /> : null}
      {view === "inbox" ? <InboxView /> : null}
      {view === "integrations" ? <IntegrationsView slackConnected={slackConnected} onConnectSlack={onConnectSlack} /> : null}
      {view === "settings" ? <SettingsView user={user} /> : null}
    </section>
  );
}
