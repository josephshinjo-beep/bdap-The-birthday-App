import Link from "next/link";
import { HowItWorks } from "./home-steps";

export default function Home() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-[18px] pb-28 pt-3">
      <section aria-labelledby="hero" className="enter relative h-[180px] overflow-hidden rounded-xl bg-plum">
        <h1 id="hero" className="absolute left-4 top-[18px] max-w-[62%] font-display text-[22px] font-extrabold leading-[1.1] text-white">
          Never miss a classmate&apos;s birthday.
          <small className="mt-1.5 block font-sans text-xs font-medium text-plum-soft">And never spoil the surprise.</small>
        </h1>
        <span aria-hidden="true" className="balloon" style={{ right: 22, background: "var(--accent)" }} />
        <span aria-hidden="true" className="balloon" style={{ right: 70, background: "var(--sun)", animationDelay: "-2s" }} />
        <span aria-hidden="true" className="balloon" style={{ right: 118, background: "var(--mint)", animationDelay: "-4s" }} />
      </section>

      <p className="enter-2 a-sub">
        bdap reminds your class the evening before a birthday, keeps it secret from the birthday person, and collects the gift money over UPI.
      </p>

      <Link href="/join" className="btn enter-2">Join your class room</Link>
      <Link href="/create" className="btn-secondary enter-3">Create a room for your class</Link>

      <section aria-labelledby="how" className="mt-2 flex flex-col gap-2">
        <h2 id="how" className="label">How it works · tap a card</h2>
        <HowItWorks />
      </section>

      <section aria-labelledby="secret" className="flex items-center gap-3 rounded-lg bg-night p-3.5 text-white">
        <span aria-hidden="true" className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent font-display font-extrabold">sh</span>
        <div>
          <h2 id="secret" className="font-sans text-[15px] font-bold text-white">Built for surprises</h2>
          <p className="text-[13px] text-plum-soft">When it&apos;s your birthday, your room goes quiet for you. Everyone else plans.</p>
        </div>
      </section>

      <ul className="card flex flex-col gap-1.5 text-[13px] text-muted">
        <li><b className="text-plum">Your birth year stays private.</b> Classmates only see the day and month.</li>
        <li><b className="text-plum">Only moderators see who paid.</b> Everyone else sees the total.</li>
      </ul>

      <footer className="mt-4 text-center text-xs text-muted">
        bdap · made for classes that celebrate together
      </footer>
    </main>
  );
}
