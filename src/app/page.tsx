import Link from "next/link";
import { HeroGift } from "./hero-gift";

const STEPS = [
  { n: "1", title: "Join with a code", body: "Your class rep shares a 6-letter room code. Type it in, add your name and birthday.", colour: "bg-sun" },
  { n: "2", title: "The moderator lets you in", body: "Only people the moderator approves see the room. Strangers stay out.", colour: "bg-mint" },
  { n: "3", title: "A secret heads-up", body: "The evening before a birthday, everyone gets a quiet reminder. Everyone except the birthday person.", colour: "bg-sky" },
  { n: "4", title: "Chip in with UPI", body: "Unwrap the gift, scratch the card, pay from any UPI app. Watch the pool fill up.", colour: "bg-accent" },
];

export default function Home() {
  return (
    <main id="main" className="flex-1">
      <section className="mx-auto grid max-w-5xl items-center gap-8 px-4 pb-14 pt-8 sm:px-6 md:grid-cols-[1.15fr_1fr] md:pt-16">
        <div>
          <p className="enter chip mb-4">🎂 Birthdays for college classes</p>
          <h1 className="enter-2 font-display text-[2.6rem] font-extrabold leading-[1.02] sm:text-6xl">
            Never miss a classmate&apos;s birthday. <span className="text-accent">They never see it coming.</span>
          </h1>
          <p className="enter-3 mt-5 max-w-lg text-lg text-muted">
            bdap reminds your whole class the evening before, keeps it secret from the birthday person, and collects the gift money over UPI.
          </p>
          <div className="enter-3 mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/join" className="btn text-lg">Join your class room</Link>
            <Link href="/create" className="btn-ghost">Create a room for your class</Link>
          </div>
        </div>
        <HeroGift />
      </section>

      <section aria-labelledby="how" className="border-y-2 border-ink bg-surface-2 py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 id="how" className="font-display text-3xl font-extrabold sm:text-4xl">How bdap works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="card p-5 transition-transform duration-200 hover:-translate-y-0.5">
                <span className={`${s.colour} inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink font-display text-lg font-extrabold text-[#221b3a]`}>{s.n}</span>
                <h3 className="mt-3 font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-1 text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="privacy" className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="card grid gap-6 bg-night p-6 text-white sm:grid-cols-[auto_1fr] sm:p-8" style={{ background: "var(--night)", borderColor: "var(--night)" }}>
          <span aria-hidden="true" className="text-5xl">🤫</span>
          <div>
            <h2 id="privacy" className="font-display text-2xl font-extrabold sm:text-3xl">Built to keep the secret</h2>
            <ul className="mt-3 space-y-2 text-white/85">
              <li>• The birthday person never sees their own reminders, surprise page or pool.</li>
              <li>• Classmates see your birthday as a day and month. Your birth year stays with you.</li>
              <li>• Only the moderators see who has paid. Everyone else sees the total.</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        bdap · made for classes that celebrate together · <Link href="/login" className="underline">Log in</Link>
      </footer>
    </main>
  );
}
