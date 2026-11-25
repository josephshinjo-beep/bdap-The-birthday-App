"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./providers";
import { NotificationBell } from "./notification-bell";
import { Avatar } from "./ui";

export function Logo() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center font-display text-[22px] font-extrabold tracking-[-0.03em] text-plum" aria-label="bdap home">
      bd<span className="text-accent">ap</span>
    </Link>
  );
}

export function Header() {
  const { session, loading } = useSession();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-[18px] py-1.5">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-0.5">
          {loading ? null : session ? (
            <>
              <Link href="/rooms" aria-current={path === "/rooms" ? "page" : undefined} className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-plum">
                My rooms
              </Link>
              <NotificationBell />
              <Link href="/me" aria-label="Your profile" className="inline-flex min-h-11 min-w-11 items-center justify-center">
                <Avatar name={session.profile?.fullName ?? session.suggestedName ?? "You"} url={session.profile?.avatarUrl} size={32} />
              </Link>
            </>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(path === "/" ? "/rooms" : path)}`} className="inline-flex min-h-11 items-center text-sm font-bold text-plum">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
