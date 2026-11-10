import type { AuthUser } from "@/lib/auth/useAuth";
import { cn } from "@/utils";

function initials(user?: AuthUser): string {
  const source = user?.name || user?.email || "?";
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** The user's photo (Auth0) or their initials. */
export default function UserAvatar({
  user,
  className = "size-20 text-2xl",
}: {
  user?: AuthUser;
  className?: string;
}) {
  if (user?.picture) {
    return (
      <img
        src={user.picture}
        alt=""
        referrerPolicy="no-referrer"
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
        className,
      )}
    >
      {initials(user)}
    </span>
  );
}
