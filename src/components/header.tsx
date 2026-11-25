"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./providers";
import { NotificationBell } from "./notification-bell";
import { Avatar } from "./ui";

export function Logo() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-display text-xl font-extrabold" aria-label="bdap home">
      <span aria-hidden="true" className="relative inline-block h-7 w-8 rounded-md border-2 border-ink bg-sun">
        <span className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-accent" />
        <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-accent" />
      </span>
      bdap
    </Link>
  );
}

export function Header() {
  const { session, loading } = useSession();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1">
          {loading ? null : session ? (
            <>
              <Link href="/rooms" aria-current={path === "/rooms" ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-full px-3 font-bold hover:bg-surface-2">
                My rooms
              </Link>
              <NotificationBell />
              <Link href="/me" aria-label="Your profile" className="inline-flex min-h-11 min-w-11 items-center justify-center">
                <Avatar name={session.profile?.fullName ?? session.suggestedName ?? "You"} url={session.profile?.avatarUrl} size={36} />
              </Link>
            </>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(path === "/" ? "/rooms" : path)}`} className="btn-ghost btn-sm">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
