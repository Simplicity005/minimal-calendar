"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  Calendar,
  Hash,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  User,
  X,
} from "lucide-react";
import type { Room } from "../../types/calendar";
import styles from "./sidebar.module.css";

type Props = {
  rooms: Room[];
  activeRoom: Room | null;
  onSelectRoom: (roomId: string) => void;
  onOpenManageRooms: () => void;
  onOpenManageAccount: () => void;
  onSignOut: () => void;
  userName?: string;
  userEmail?: string;
  isExpanded: boolean;
  setIsExpanded: (val: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (val: boolean) => void;
  isSubscribed?: boolean;
  isNotifSupported?: boolean;
  isNotifLoading?: boolean;
  onToggleNotifications?: () => void;
};

export function Sidebar({
  rooms,
  activeRoom,
  onSelectRoom,
  onOpenManageRooms,
  onOpenManageAccount,
  onSignOut,
  userName,
  userEmail,
  isExpanded,
  setIsExpanded,
  isMobileOpen,
  setIsMobileOpen,
  isSubscribed = false,
  isNotifSupported = false,
  isNotifLoading = false,
  onToggleNotifications,
}: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const toggleButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isMobileOpen) return;
    const opener = document.activeElement;
    const panel = sidebar.current;
    closeButton.current?.focus();

    return () => {
      if (
        opener instanceof HTMLElement &&
        (panel?.contains(document.activeElement) || document.activeElement === document.body)
      ) {
        opener.focus();
      }
    };
  }, [isMobileOpen]);

  const personalRoom = rooms.find((room) => room.name === "Personal Calendar");
  const sharedRooms = rooms.filter((room) => room.name !== "Personal Calendar");
  const orderedRooms = personalRoom ? [personalRoom, ...sharedRooms] : sharedRooms;
  const accountName = userName || userEmail;
  const toggleLabel = isExpanded ? "Collapse sidebar" : "Expand sidebar";
  const notificationsLabel = isSubscribed ? "Notifications on" : "Enable notifications";

  const closeSidebar = () => {
    if (isMobileOpen) {
      setIsMobileOpen(false);
    } else if (isExpanded) {
      toggleButton.current?.focus();
      setIsExpanded(false);
    }
  };

  return (
    <>
      <div
        className={styles.overlay}
        data-expanded={isExpanded}
        data-mobile-open={isMobileOpen}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        ref={sidebar}
        className={styles.sidebar}
        data-expanded={isExpanded}
        data-mobile-open={isMobileOpen}
        aria-label="Calendar sidebar"
        onKeyDown={(event) => {
          if (event.key === "Escape" && (isExpanded || isMobileOpen)) {
            event.stopPropagation();
            closeSidebar();
          }
        }}
      >
        <header className={styles.header}>
          <button
            ref={toggleButton}
            type="button"
            className={styles.desktopToggle}
            onClick={() => setIsExpanded(!isExpanded)}
            aria-controls="app-sidebar"
            aria-expanded={isExpanded}
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            {isExpanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <button
            ref={closeButton}
            type="button"
            className={styles.mobileClose}
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
          <Link href="/" className={styles.brand} onClick={closeSidebar}>
            Align
          </Link>
        </header>

        <nav className={styles.body} aria-label="My spaces">
          <div className={styles.sectionHeader} aria-hidden="true">My spaces</div>
          {orderedRooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className={styles.navItem}
              aria-label={room.name}
              aria-current={activeRoom?.id === room.id ? "true" : undefined}
              onClick={() => {
                onSelectRoom(room.id);
                closeSidebar();
              }}
              title={room.name}
            >
              {room === personalRoom ? <Calendar size={18} /> : <Hash size={18} />}
              <span className={styles.label}>{room.name}</span>
            </button>
          ))}
          <button
            type="button"
            className={styles.navItem}
            aria-label="Create or join space"
            onClick={() => {
              closeSidebar();
              onOpenManageRooms();
            }}
            title="Create or join space"
          >
            <Plus size={18} />
            <span className={styles.label}>Create or join space</span>
          </button>
        </nav>

        <footer className={styles.footer}>
          {isNotifSupported && (
            <button
              type="button"
              className={styles.navItem}
              onClick={onToggleNotifications}
              disabled={isNotifLoading}
              aria-label="Event notifications"
              aria-pressed={isSubscribed}
              title={notificationsLabel}
            >
              {isSubscribed ? <Bell size={18} /> : <BellOff size={18} />}
              <span className={styles.label}>
                {isNotifLoading ? "Please wait…" : notificationsLabel}
              </span>
            </button>
          )}
          <button
            type="button"
            className={styles.navItem}
            aria-label="Sign out"
            onClick={() => {
              closeSidebar();
              onSignOut();
            }}
            title="Sign out"
          >
            <LogOut size={18} />
            <span className={styles.label}>Sign out</span>
          </button>
          <button
            type="button"
            className={styles.account}
            onClick={() => {
              closeSidebar();
              onOpenManageAccount();
            }}
            aria-label={accountName ? `Manage account for ${accountName}` : "Manage account"}
            title="Manage account"
          >
            <span className={styles.avatar} aria-hidden="true">
              {accountName ? accountName.charAt(0).toUpperCase() : <User size={16} />}
            </span>
            <span className={styles.accountInfo}>
              <span className={styles.accountName}>{userName || "Manage account"}</span>
              {userEmail && <span className={styles.accountEmail}>{userEmail}</span>}
            </span>
          </button>
        </footer>
      </aside>
    </>
  );
}
