import Link from "next/link";
import { BalloonField } from "@/components/balloons";
import { HowItWorks } from "./home-steps";

function HeroArt({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-plum ${className}`}>
      <div className="absolute inset-y-0 right-0 w-[46%]">
        <BalloonField count={3} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-[18px] pb-28 pt-3 md:max-w-3xl md:px-8 md:pt-10 lg:pt-14 lg:max-w-6xl xl:max-w-[1360px] xl:px-12 2xl:max-w-[1520px] lg:gap-12">
      {/* Hero: stacked on phones (text inside the plum card), side by side on laptops. */}
      <section aria-labelledby="hero" className="grid gap-3.5 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-12 xl:gap-20">
        <div className="relative flex flex-col gap-3.5 lg:gap-5">
          <div className="enter relative h-[180px] overflow-hidden rounded-xl bg-plum md:h-[220px] lg:h-auto lg:overflow-visible lg:bg-transparent">
            <HeroArt className="absolute inset-0 lg:hidden" />
            <h1 id="hero" className="absolute left-4 top-[18px] max-w-[62%] font-display text-[22px] font-extrabold leading-[1.1] text-white md:left-6 md:top-7 md:text-[32px] lg:static lg:max-w-none lg:text-[58px] lg:leading-[1.02] lg:text-plum xl:text-[68px]">
              Never miss a classmate&apos;s birthday.
              <small className="mt-1.5 block font-sans text-xs font-medium text-plum-soft md:text-sm lg:mt-3 lg:font-display lg:text-[58px] lg:font-extrabold lg:leading-[1.02] lg:text-accent xl:text-[68px]">
                And never spoil the surprise.
              </small>
            </h1>
          </div>

          <p className="enter-2 a-sub max-w-xl">
            bdap reminds your class the evening before a birthday, keeps it secret from the birthday person, and collects the gift money over UPI.
          </p>

          <div className="enter-3 flex flex-col gap-3.5 md:flex-row">
            <Link href="/join" className="btn md:flex-1 lg:flex-none lg:px-7">Join your class room</Link>
            <Link href="/create" className="btn-secondary md:flex-1 lg:flex-none lg:px-7">Create a room for your class</Link>
          </div>
        </div>

        {/* Laptop-only visual: the blueprint's 6 PM lock screen with the secret heads-up. */}
        <div
          className="relative hidden h-[440px] flex-col xl:h-[480px] gap-3.5 overflow-hidden rounded-xl p-7 text-white lg:flex"
          style={{ background: "linear-gradient(160deg, var(--plum), #4b2a6e 60%, var(--accent))" }}
        >
          <div className="absolute inset-x-6 bottom-0 h-[42%]">
            <BalloonField count={5} sizes={[46, 54, 40, 50, 44]} start={1} />
          </div>
          <p className="mt-6 text-center font-display text-[72px] font-bold leading-none">18:00</p>
          <p className="-mt-1 text-center text-sm text-[#e8defd]">The evening before Riya&apos;s birthday</p>
          <div className="drop-in relative z-10 mt-4 grid grid-cols-[38px_1fr] gap-3 rounded-lg bg-white/95 p-3.5 text-ink">
            <span className="grid h-[38px] w-[38px] place-items-center rounded-[9px] bg-plum font-display text-[13px] font-extrabold text-white">bd</span>
            <span>
              <span className="flex justify-between text-xs text-muted">
                <b className="text-ink">bdap · CSE-B</b>
                <span>now</span>
              </span>
              <span className="block text-sm">
                <b>Psst. Riya&apos;s birthday is tomorrow.</b> A gift is waiting for you to unwrap. Don&apos;t tell her.
              </span>
            </span>
          </div>
          <div className="drop-in relative z-10 grid grid-cols-[38px_1fr] gap-3 rounded-lg bg-white/90 p-3.5 text-ink [animation-delay:350ms]">
            <span className="grid h-[38px] w-[38px] place-items-center rounded-[9px] bg-plum font-display text-[13px] font-extrabold text-white">bd</span>
            <span>
              <span className="flex justify-between text-xs text-muted">
                <b className="text-ink">bdap · CSE-B</b>
                <span>tomorrow, 07:30</span>
              </span>
              <span className="block text-sm">
                <b>Today&apos;s the day!</b> 22 of 40 have chipped in. Wish Riya before class.
              </span>
            </span>
          </div>
          <p className="relative z-10 mt-auto text-center text-xs text-[#e8defd]">Riya gets none of these. (Pop a balloon!)</p>
        </div>
      </section>

      <section aria-labelledby="how" className="mt-2 flex flex-col gap-2 lg:mt-0 lg:gap-4">
        <h2 id="how" className="label lg:text-sm">How it works · tap a card</h2>
        <HowItWorks />
      </section>

      <div className="grid gap-3.5 md:grid-cols-2 lg:gap-5">
        <section aria-labelledby="secret" className="flex items-center gap-3 rounded-lg bg-night p-3.5 text-white md:p-5">
          <span aria-hidden="true" className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent font-display font-extrabold md:h-12 md:w-12">sh</span>
          <div>
            <h2 id="secret" className="font-sans text-[15px] font-bold text-white md:text-base">Built for surprises</h2>
            <p className="text-[13px] text-plum-soft md:text-sm">When it&apos;s your birthday, your room goes quiet for you. Everyone else plans.</p>
          </div>
        </section>

        <ul className="card flex flex-col justify-center gap-1.5 text-[13px] text-muted md:p-5 md:text-sm">
          <li><b className="text-plum">Your birth year stays private.</b> Classmates only see the day and month.</li>
          <li><b className="text-plum">Only moderators see who paid.</b> Everyone else sees the total.</li>
        </ul>
      </div>

      <footer className="mt-4 text-center text-xs text-muted md:text-sm">bdap · made for classes that celebrate together</footer>
    </main>
  );
}
