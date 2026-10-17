import { useEffect, useRef, useState } from "react";
import type { User } from "../types";
import { Avatar } from "./Avatar";
import { ArrowRightIcon, BellIcon, ChevronDownIcon, MenuIcon, SearchIcon } from "./Icons";

interface TopbarProps {
  user: User;
  viewLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  onOpenMenu: () => void;
  onLogout: () => void;
}

export function Topbar({ user, viewLabel, search, onSearchChange, onOpenMenu, onLogout }: TopbarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="icon-button mobile-menu" aria-label="Open navigation" onClick={onOpenMenu}>
          <MenuIcon size={20} />
        </button>
        <div className="breadcrumb">
          <span>Workspace</span>
          <span className="breadcrumb-slash">/</span>
          <strong>{viewLabel}</strong>
        </div>
      </div>
      <div className="topbar-actions">
        <label className="topbar-search">
          <SearchIcon size={16} />
          <input ref={searchRef} type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search workspace" aria-label="Search workspace" />
          <kbd>⌘ K</kbd>
        </label>
        <button type="button" className="icon-button notification-button" aria-label="Notifications">
          <BellIcon size={18} />
          <span className="notification-dot" />
        </button>
        <div className="topbar-user-wrap" ref={userMenuRef}>
          <button type="button" className="topbar-user" onClick={() => setUserMenuOpen((open) => !open)} aria-expanded={userMenuOpen} aria-haspopup="menu" aria-label={`Open ${user.name} account menu`}>
            <Avatar user={user} size="sm" />
            <span className="topbar-user-name">{user.name.split(" ")[0]}</span>
            <ChevronDownIcon size={14} />
          </button>
          {userMenuOpen ? <div className="user-menu-popover" role="menu">
            <span className="user-menu-label">Signed in as</span>
            <strong>{user.email || user.name}</strong>
            <button type="button" className="user-menu-signout" role="menuitem" onClick={() => { setUserMenuOpen(false); onLogout(); }}>
              Sign out <ArrowRightIcon size={14} />
            </button>
          </div> : null}
        </div>
      </div>
    </header>
  );
}
