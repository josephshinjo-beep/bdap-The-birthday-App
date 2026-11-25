"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./providers";
import { NotificationBell } from "./notification-bell";
import { Avatar } from "./ui";

export function Logo() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center font-display text-[22px] font-extrabold tracking-[-0.03em] text-plum md:text-[26px]" aria-label="bdap home">
      bd<span className="text-accent">ap</span>
    </Link>
  );
}

function NavLink({ href, children, current }: { href: string; children: React.ReactNode; current: boolean }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-bold transition-colors md:px-3 ${current ? "text-accent" : "text-plum hover:bg-surface-2"}`}
    >
      {children}
    </Link>
  );
}

export function Header() {
  const { session, loading } = useSession();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-transparent bg-bg/90 backdrop-blur md:border-line" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-[18px] py-1.5 md:max-w-3xl md:px-8 md:py-2.5 lg:max-w-6xl">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-0.5 md:gap-1">
          {loading ? null : session ? (
            <>
              <NavLink href="/rooms" current={path === "/rooms"}>My rooms</NavLink>
              <span className="hidden md:contents">
                <NavLink href="/join" current={path === "/join"}>Join a room</NavLink>
                <NavLink href="/create" current={path === "/create"}>Create a room</NavLink>
              </span>
              <NotificationBell />
              <Link href="/me" aria-label="Your profile" className="inline-flex min-h-11 min-w-11 items-center justify-center">
                <Avatar name={session.profile?.fullName ?? session.suggestedName ?? "You"} url={session.profile?.avatarUrl} size={32} />
              </Link>
            </>
          ) : (
            <>
              <span className="hidden md:contents">
                <NavLink href="/join" current={path === "/join"}>Join a room</NavLink>
              </span>
              <Link href={`/login?next=${encodeURIComponent(path === "/" ? "/rooms" : path)}`} className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-plum md:ml-1 md:min-h-10 md:rounded-sm md:border-2 md:border-plum md:bg-surface md:px-4">
                Log in
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
