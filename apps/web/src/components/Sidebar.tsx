import { NavLink } from "react-router-dom";
import type { User } from "../types";
import { Avatar } from "./Avatar";
import { ArrowRightIcon, ChevronDownIcon, ClockIcon, LogoMark, PlusIcon, SendIcon, SlackIcon, XIcon } from "./Icons";

interface SidebarProps {
  user: User;
  open: boolean;
  activeTab: "scheduled" | "sent";
  scheduledCount: number;
  sentCount: number;
  slackConnected: boolean;
  onClose: () => void;
  onCompose: () => void;
  onConnectSlack: () => void;
  onLogout: () => void;
}

function mailboxLinkClass(active: boolean): string {
  return `mail-nav-link ${active ? "is-active" : ""}`;
}

export function Sidebar({ user, open, activeTab, scheduledCount, sentCount, slackConnected, onClose, onCompose, onConnectSlack, onLogout }: SidebarProps) {
  return (
    <>
      <button type="button" className={`sidebar-scrim ${open ? "is-visible" : ""}`} aria-label="Close navigation" onClick={onClose} />
      <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="ReachInbox navigation">
        <div className="sidebar-brand">
          <NavLink to="/dashboard?tab=scheduled" className="brand-lockup" onClick={onClose} aria-label="ReachInbox mailbox">
            <span className="brand-mark"><LogoMark size={22} /></span>
            <span className="brand-wordmark">reach<span>inbox</span></span>
          </NavLink>
          <button type="button" className="icon-button mobile-close" aria-label="Close navigation" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>

        <button type="button" className="sidebar-compose button button-primary" onClick={onCompose}>
          <PlusIcon size={16} /> Compose
        </button>

        <nav className="sidebar-nav" aria-label="Mailbox folders">
          <p className="nav-section-label">Core</p>
          <NavLink to="/dashboard?tab=scheduled" className={mailboxLinkClass(activeTab === "scheduled")} onClick={onClose}>
            <ClockIcon size={16} />
            <span>Scheduled</span>
            <span className="nav-badge">{scheduledCount}</span>
          </NavLink>
          <NavLink to="/dashboard?tab=sent" className={mailboxLinkClass(activeTab === "sent")} onClick={onClose}>
            <SendIcon size={16} />
            <span>Sent</span>
            <span className="nav-badge">{sentCount}</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <button type="button" className={`sidebar-slack ${slackConnected ? "is-connected" : ""}`} onClick={onConnectSlack}>
            <span className="sidebar-slack-icon"><SlackIcon size={15} /></span>
            <span><strong>{slackConnected ? "Slack connected" : "Connect Slack"}</strong><small>{slackConnected ? "Alerts are live" : "Get delivery alerts"}</small></span>
          </button>
          <div className="sidebar-account">
            <Avatar user={user} size="sm" />
            <div className="sidebar-account-copy">
              <strong>{user.name}</strong>
              <span>{user.email || "Signed-in account"}</span>
            </div>
            <button type="button" className="account-menu-button" aria-label="Sign out" title="Sign out" onClick={onLogout}>
              <ChevronDownIcon size={14} />
            </button>
          </div>
          <button type="button" className="sidebar-signout" onClick={onLogout}>
            <ArrowRightIcon size={14} /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
