export interface IconProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

export function MailIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

export function LockIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

export function EyeIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

export function EyeOffIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
      />
    </svg>
  );
}

export function ArrowRightLoginIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
        transform="rotate(180 12 12)"
      />
    </svg>
  );
}

export function DatabaseIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth={1.8} />
      <path strokeWidth={1.8} d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path strokeWidth={1.8} d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

export function AlertCircleIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={1.8} />
      <line x1="12" y1="8" x2="12" y2="12" strokeWidth={1.8} strokeLinecap="round" />
      <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

export function CheckCircleIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function SpinnerIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={`${className} animate-spin`} width={width} height={height} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export function ChevronLeftIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export function KeyIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
      />
    </svg>
  );
}

export function HomeNavIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

export function TasksNavIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

export function UsersNavIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

export function ApiNavIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

export function CreditCardIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <line x1="2" y1="10" x2="22" y2="10" strokeWidth={1.8} />
      <line x1="6" y1="15" x2="10" y2="15" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

export function CinemaNavIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="4" width="20" height="16" rx="3" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <path strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M2 9.5h20M2 14.5h20M2 4.5h5M17 4.5h5M2 19.5h5M17 19.5h5" />
    </svg>
  );
}

export function SettingsNavIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
    </svg>
  );
}

export function HelpNavIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

export function LogOutIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

export function SlidersIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
      />
    </svg>
  );
}

export function UploadIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}

export function SearchIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

export function ChevronRightIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function FolderIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-1.5V9a3 3 0 00-3-3h-3.379a3 3 0 01-2.121-.879L8.379 4.043A3 3 0 006.257 3.164H4.5A3 3 0 001.5 6.164v11.836A3 3 0 004.5 21h15z" />
    </svg>
  );
}

export function SortArrowsIcon({ className = "w-3.5 h-3.5", width = 14, height = 14 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

export function FolderPlusIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"
      />
    </svg>
  );
}

export function UserIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

export function StorageNavIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

export function FileIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

export function FilePlusIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

export function DownloadIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

export function TrashIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

export function RefreshIcon({ className = "w-5 h-5", width = 20, height = 20 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

export function TagIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
      />
    </svg>
  );
}

export function SparklesIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.286L13 21l-2.286-6.857L5 12l5.714-2.286L13 3z"
      />
    </svg>
  );
}

export function BoldIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
    </svg>
  );
}

export function ItalicIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 4h-9m4 16H5M15 4L9 20" />
    </svg>
  );
}

export function UnderlineIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3v7a6 6 0 0012 0V3M4 21h16" />
    </svg>
  );
}

export function StrikethroughIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M16 6a3 3 0 00-3-3H9a3 3 0 000 6h4a3 3 0 010 6H8a3 3 0 01-3-3" />
    </svg>
  );
}

export function AlignLeftIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
    </svg>
  );
}

export function AlignCenterIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
    </svg>
  );
}

export function AlignRightIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
    </svg>
  );
}

export function ListIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export function NumberedListIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h14M7 12h14M7 18h14M3 6h1v4M3 10h2M3 14h2l-2 3v1h2" />
    </svg>
  );
}

export function TaskCheckIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12l3 3 5-6" />
    </svg>
  );
}

export function CodeIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

export function QuoteIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h4v4a4 4 0 01-4 4H6m11-8h4v4a4 4 0 01-4 4h-1" />
    </svg>
  );
}

export function TableIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}

export function ImageIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={2} />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15l-5-5L5 21" />
    </svg>
  );
}

export function PencilIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = "w-4 h-4", width = 16, height = 16 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

export function MenuIcon({ className = "w-6 h-6", width = 24, height = 24 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function CloseIcon({ className = "w-6 h-6", width = 24, height = 24 }: IconProps) {
  return (
    <svg className={className} width={width} height={height} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}


