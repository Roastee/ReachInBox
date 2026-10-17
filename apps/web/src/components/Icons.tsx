import type { ReactNode, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconBase({ size = 18, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function LogoMark({ size = 24, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 28 28" fill="none" {...props}>
      <path d="M7 5.5h14v17H7z" fill="currentColor" opacity=".14" />
      <path d="M7 5.5h14v17H7z" stroke="currentColor" strokeWidth="1.7" />
      <path d="m10 9 8 5-8 5V9Z" fill="currentColor" />
      <path d="M3.5 9.5h2M3.5 14h2M3.5 18.5h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
      <rect x="14.5" y="14.5" width="6" height="6" rx="1" />
    </IconBase>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m21 3-7.4 18-3.2-7.4L3 10.4 21 3Z" />
      <path d="m10.4 13.6 4.7-4.7" />
    </IconBase>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 5.5h16v13H4z" />
      <path d="M4 13h4l1.5 2h5L16 13h4" />
    </IconBase>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c.4-3.1 2.1-5 5.5-5s5.1 1.9 5.5 5" />
      <path d="M16 5.5a3 3 0 0 1 0 5.9M17 15c2.1.5 3.4 2.1 3.7 4.5" />
    </IconBase>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3Z" />
      <path d="m4 12 8 4 8-4M4 16.5l8 4 8-4" />
    </IconBase>
  );
}

export function PlugIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 3v5M15 3v5M7 8h10v2a5 5 0 0 1-10 0V8Z" />
      <path d="M12 15v6M9 21h6" />
    </IconBase>
  );
}

export function FileTextIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 3.5h8l4 4V20.5H6z" />
      <path d="M14 3.5v4h4M9 12h6M9 16h6" />
    </IconBase>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      <path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.1a1.8 1.8 0 0 1-3.6 0v-.1a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H4a1.8 1.8 0 0 1 0-3.6h.1a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9V2.8a1.8 1.8 0 0 1 3.6 0v.1a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.1a1.8 1.8 0 0 1 0 3.6h-.1a1.8 1.8 0 0 0-.9 2.1Z" />
    </IconBase>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10.7" cy="10.7" r="6.2" />
      <path d="m16 16 4.5 4.5" />
    </IconBase>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </IconBase>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 22h4" />
    </IconBase>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m14.5 6-6 6 6 6" />
    </IconBase>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </IconBase>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 17 17 7M8 7h9v9" />
    </IconBase>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </IconBase>
  );
}

export function XIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </IconBase>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </IconBase>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M8 3v5M16 3v5M4 10h16" />
    </IconBase>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </IconBase>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M5 15v4h14v-4" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12 4.2 4.2L19 6.5" />
    </IconBase>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.5 21 20H3l9-16.5Z" />
      <path d="M12 9v4M12 16.5v.1" />
    </IconBase>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 11a8 8 0 0 0-14.7-4L3 10M3 5v5h5M4 13a8 8 0 0 0 14.7 4L21 14m0 5v-5h-5" />
    </IconBase>
  );
}

export function PaperclipIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m20 11.5-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.2 3.2 0 0 1 4.5 4.5L9.7 16.6a1.5 1.5 0 0 1-2.1-2.1L15 7.1" />
    </IconBase>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
    </IconBase>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </IconBase>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c.7-3.3 3-5.1 7.5-5.1s6.8 1.8 7.5 5.1" />
    </IconBase>
  );
}

export function StarIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <IconBase {...props} fill={filled ? "currentColor" : "none"}>
      <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.6Z" />
    </IconBase>
  );
}

export function ArchiveIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7.5h16v12H4zM3 4.5h18v3H3zM9 12h6" />
    </IconBase>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 7h14M10 11v5M14 11v5M8 7l.7-2h6.6l.7 2M7 7l.8 14h8.4L17 7" />
    </IconBase>
  );
}

export function ReplyIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 8 4 12l6 4v-3c5.2 0 8.5 1.1 10 4-1-5.4-4.3-8-10-8V8Z" />
    </IconBase>
  );
}

export function BoldIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 4h5.2a4 4 0 0 1 1.3 7.8A4.2 4.2 0 0 1 12.2 20H7V4Zm0 7h4.3a3.5 3.5 0 0 0 0-7M7 20h5.2" />
    </IconBase>
  );
}

export function ItalicIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 4h5M5 20h5M15 4 9 20" />
    </IconBase>
  );
}

export function UnderlineIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 4v6a5 5 0 0 0 10 0V4M5 20h14" />
    </IconBase>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9.5 14.5-1.1 1.1a3.5 3.5 0 0 1-5-5l2.2-2.2a3.5 3.5 0 0 1 5-0M14.5 9.5l1.1-1.1a3.5 3.5 0 0 1 5 5l-2.2 2.2a3.5 3.5 0 0 1-5 0M8 16l8-8" />
    </IconBase>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.1M4.5 12h.1M4.5 18h.1" />
    </IconBase>
  );
}

export function AlignLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6h16M4 10h11M4 14h16M4 18h9" />
    </IconBase>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 3 1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2L12 3ZM19 14l.6 2.4L22 17l-2.4.6L19 20l-.6-2.4L16 17l2.4-.6L19 14ZM5 15l.5 2L7 17.5 5.5 18 5 20l-.5-2L3 17.5l1.5-.5L5 15Z" />
    </IconBase>
  );
}

export function SlackIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M8.4 3.5a2.4 2.4 0 1 0 0 4.8H10V5.9a2.4 2.4 0 0 0-1.6-2.4ZM3.5 8.4a2.4 2.4 0 1 0 4.8 0V7H5.9a2.4 2.4 0 0 0-2.4 1.4ZM15.6 20.5a2.4 2.4 0 1 0 0-4.8H14v2.4a2.4 2.4 0 0 0 1.6 2.4ZM20.5 15.6a2.4 2.4 0 1 0-4.8 0V17h2.4a2.4 2.4 0 0 0 2.4-1.4ZM20.5 8.4a2.4 2.4 0 1 0-4.8 0V10h2.4a2.4 2.4 0 0 0 2.4-1.6ZM15.6 3.5a2.4 2.4 0 1 0-2.4 2.4v2.4h2.4V5.9a2.4 2.4 0 0 0-0-2.4ZM3.5 15.6a2.4 2.4 0 1 0 2.4-2.4H3.5v2.4ZM8.4 20.5a2.4 2.4 0 1 0 2.4-2.4v-2.4H8.4v2.4a2.4 2.4 0 0 0 0 2.4Z" fill="currentColor" />
    </svg>
  );
}

export function GoogleIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.8 3.1-4.3 3.1-7.4Z" fill="#4285F4" />
      <path d="M12 22c2.8 0 5.2-.9 6.9-2.4l-3.2-2.5c-.9.6-2.1 1-3.7 1-2.8 0-5.2-1.9-6-4.5H2.7v2.6A10.4 10.4 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6 13.6a6.1 6.1 0 0 1 0-3.2V7.8H2.7a10.4 10.4 0 0 0 0 8.4L6 13.6Z" fill="#FBBC05" />
      <path d="M12 5.9c1.7 0 3.2.6 4.4 1.8l3.3-3.2C17.2 2.9 14.8 2 12 2a10.4 10.4 0 0 0-9.3 5.8L6 10.4c.8-2.6 3.2-4.5 6-4.5Z" fill="#EA4335" />
    </svg>
  );
}
