import type { User } from "../types";

export function Avatar({ user, size = "md" }: { user: Pick<User, "name" | "email" | "avatarUrl" | "initials">; size?: "sm" | "md" | "lg" }) {
  const initials = user.initials ||
    user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

  return user.avatarUrl ? (
    <img className={`avatar avatar-${size}`} src={user.avatarUrl} alt={`${user.name} avatar`} />
  ) : (
    <span className={`avatar avatar-${size} avatar-fallback`} aria-label={`${user.name} avatar`}>
      {initials || "RI"}
    </span>
  );
}
