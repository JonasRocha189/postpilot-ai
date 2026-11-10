import { cn } from "@/utils";

/**
 * PostPilot symbol: a paper plane (the "pilot" that sends the post), with a
 * trail and a sparkle (the AI). Same drawing as `public/favicon.svg`.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" fill="#465FFF" />
      <path d="M26 7 6.5 14.6l7.6 3.1Z" fill="#fff" />
      <path d="M26 7 14.1 17.7l3.4 8.3Z" fill="#fff" opacity=".7" />
      <path
        d="M6.2 26c2.2-.3 4.2-1.5 5.6-3.4"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity=".55"
      />
      <path
        d="M9.6 4.8l.75 1.9 1.9.75-1.9.75-.75 1.9-.75-1.9-1.9-.75 1.9-.75Z"
        fill="#fff"
      />
    </svg>
  );
}

/** PostPilot brand. `iconOnly` for the collapsed sidebar. */
export default function Logo({
  iconOnly = false,
  className,
}: {
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!iconOnly && (
        <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Post<span className="text-brand-500 dark:text-brand-400">Pilot</span>
        </span>
      )}
    </span>
  );
}
