"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { BackLink, EmptyState, ErrorNote, Loading, Page } from "@/components/ui";
import { data } from "@/lib/data";
import { celebrate } from "@/lib/confetti";
import { formatISODayMonth } from "@/lib/dates";
import { drawStoryCard, shareStoryCard, type CardTheme } from "@/lib/share-card";
import { useAsync } from "@/lib/use-async";
import type { Session, WallInfo, Wish, WishColor } from "@/lib/types";
import { LockIcon } from "@/components/icons";

export function WallView() {
  return <AuthGate>{(s) => <WallLoader session={s} />}</AuthGate>;
}

function WallLoader({ session }: { session: Session }) {
  const { id, celebrationId } = useParams<{ id: string; celebrationId: string }>();
  const wall = useAsync(() => data.getWall(celebrationId), [celebrationId, session.userId]);
  if (wall.loading) return <Page><Loading /></Page>;
  if (!wall.data) {
    // Also what the birthday person sees before the day: nothing to give the surprise away.
    return (
      <Page>
        <EmptyState title="Nothing here" action={<Link href={`/rooms/${id}`} className="btn w-full">Back to the room</Link>}>
          This page doesn&apos;t exist or has moved.
        </EmptyState>
      </Page>
    );
  }
  return <Wall info={wall.data.info} initialWishes={wall.data.wishes} reload={wall.reload} />;
}

const COLORS: { id: WishColor; label: string; bg: string }[] = [
  { id: "sun", label: "Yellow", bg: "#fff1b8" },
  { id: "pink", label: "Pink", bg: "#ffe3ea" },
  { id: "mint", label: "Mint", bg: "#d8f6ee" },
  { id: "sky", label: "Blue", bg: "#dfe9ff" },
  { id: "white", label: "White", bg: "#ffffff" },
];
const colorBg = (c: WishColor) => COLORS.find((x) => x.id === c)?.bg ?? "#fff1b8";

function Wall({ info, initialWishes, reload }: { info: WallInfo; initialWishes: Wish[]; reload: () => void }) {
  const [wishes, setWishes] = useState(initialWishes);
  const first = info.birthdayName.split(" ")[0];
  const isMe = info.isBirthdayPerson;
  const celebrated = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWishes(initialWishes);
  }, [initialWishes]);

  useEffect(() => {
    if (isMe && info.revealed && !celebrated.current) {
      celebrated.current = true;
      celebrate();
    }
  }, [isMe, info.revealed]);

  const canMove = (w: Wish) => w.mine || (isMe && info.revealed);

  return (
    <Page size="wide">
      <BackLink href={`/rooms/${info.roomId}`}>{info.roomName}</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {isMe ? (
            <span className="pill pill-sun">Happy birthday!</span>
          ) : (
            <span className="pill pill-pink">{info.revealed ? `${first}'s birthday is today` : `Revealed to ${first} on ${formatISODayMonth(info.date)}`}</span>
          )}
          <h1 className="a-h mt-2">
            {isMe ? (
              <>
                Your birthday <span className="hl">wall</span>
              </>
            ) : (
              <>
                <span className="hl">{first}&apos;s</span> birthday wall
              </>
            )}
          </h1>
          <p className="a-sub">
            {isMe
              ? `${info.wishCount} ${info.wishCount === 1 ? "note" : "notes"} from ${info.roomName}. Drag them around to make it yours.`
              : `Stick a note for ${first}. Drag your own notes to move them. ${first} sees the wall on their birthday.`}
          </p>
        </div>
        <ShareCardButton info={info} wishes={wishes} />
      </div>

      {info.plan && (
        <p className="card text-sm">
          <span className="label inline">The plan · </span>
          {info.plan}
        </p>
      )}

      <Board wishes={wishes} setWishes={setWishes} canMove={canMove} isMe={isMe} firstName={first!} onDeleted={reload} />

      {!isMe && <Composer celebrationId={info.celebrationId} firstName={first!} onAdded={reload} />}
    </Page>
  );
}

/** The painted wall with paper notes. Notes can be dragged (or moved with arrow keys). */
function Board({
  wishes,
  setWishes,
  canMove,
  isMe,
  firstName,
  onDeleted,
}: {
  wishes: Wish[];
  setWishes: React.Dispatch<React.SetStateAction<Wish[]>>;
  canMove: (w: Wish) => boolean;
  isMe: boolean;
  firstName: string;
  onDeleted: () => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const [top, setTop] = useState<string | null>(null);

  function toPercent(clientX: number, clientY: number) {
    const r = boardRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  }

  function place(id: string, x: number, y: number) {
    setWishes((list) => list.map((w) => (w.id === id ? { ...w, x: Math.min(88, Math.max(0, x)), y: Math.min(86, Math.max(0, y)) } : w)));
  }

  async function save(id: string) {
    const w = wishes.find((v) => v.id === id);
    if (w) await data.moveWish(id, Math.round(w.x * 10) / 10, Math.round(w.y * 10) / 10).catch(() => {});
  }

  return (
    <div
      ref={boardRef}
      role="region"
      aria-label="Birthday wall"
      className="relative w-full touch-pan-y select-none overflow-hidden rounded-xl border-[10px] border-cork-edge shadow-board"
      style={{
        aspectRatio: "var(--wall-ratio)",
        background:
          "radial-gradient(circle at 20% 15%, var(--wall-gloss), transparent 40%), repeating-linear-gradient(0deg, var(--wall-rule) 0 2px, transparent 2px 26px), linear-gradient(160deg, var(--note-peach), var(--note-rose) 55%, var(--lilac))",
      }}
    >
      <style>{`[aria-label="Birthday wall"]{--wall-ratio:3/4.4;--note-max-x:57%}@media(min-width:768px){[aria-label="Birthday wall"]{--wall-ratio:16/10;--note-max-x:80%}}`}</style>
      {wishes.length === 0 && (
        <p className="absolute inset-0 grid place-items-center p-6 text-center font-display text-xl font-bold text-plum/60">
          {isMe ? "No notes yet. They're on their way!" : `Be the first to stick a note for ${firstName}.`}
        </p>
      )}
      {wishes.map((w) => {
        const movable = canMove(w);
        return (
          <article
            key={w.id}
            tabIndex={movable ? 0 : undefined}
            aria-label={`Note from ${w.authorName}${w.isPrivate ? ", private" : ""}${movable ? ". Use arrow keys to move it." : ""}`}
            className={`absolute w-[42%] max-w-[230px] p-3 pt-5 text-[13px] leading-snug text-plum shadow-note md:w-[19%] md:text-sm ${
              movable ? "cursor-grab touch-none active:cursor-grabbing" : ""
            } ${top === w.id ? "z-20" : "z-10"} focus-visible:outline-3 focus-visible:outline-sky`}
            // Clamp so a note always fits on the wall, whatever the screen width.
            style={{ left: `min(${w.x}%, var(--note-max-x))`, top: `min(${w.y}%, calc(100% - 140px))`, transform: `rotate(${w.rotation}deg)`, background: colorBg(w.color) }}
            onPointerDown={(e) => {
              if (!movable || (e.target as HTMLElement).closest("button")) return;
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              drag.current = { id: w.id, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
              setTop(w.id);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || d.id !== w.id) return;
              d.moved = true;
              const p = toPercent(e.clientX - d.dx, e.clientY - d.dy);
              place(w.id, p.x, p.y);
            }}
            onPointerUp={() => {
              const d = drag.current;
              drag.current = null;
              if (d?.moved) void save(d.id);
            }}
            onKeyDown={(e) => {
              if (!movable) return;
              const step = e.shiftKey ? 6 : 2;
              const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
              const m = moves[e.key];
              if (!m) return;
              e.preventDefault();
              place(w.id, w.x + m[0], w.y + m[1]);
              setTop(w.id);
            }}
            onKeyUp={(e) => e.key.startsWith("Arrow") && void save(w.id)}
          >
            <span aria-hidden="true" className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 rotate-[-3deg] bg-white/70 shadow-sm" />
            {w.isPrivate && (
              <span className="mb-1 inline-block rounded-full bg-plum px-2 py-0.5 text-[10px] font-bold text-white">
                <LockIcon /> {isMe ? "Only you can read this" : "Private"}
              </span>
            )}
            <p className="whitespace-pre-wrap break-words">{w.message}</p>
            <p className="mt-2 text-right text-xs font-bold text-muted">{w.authorName.split(" ")[0]}</p>
            {w.mine && (
              <button
                type="button"
                className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-plum text-xs font-bold text-white"
                aria-label="Delete your note"
                onClick={async () => {
                  await data.deleteWish(w.id).catch(() => {});
                  onDeleted();
                }}
              >
                ✕
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Composer({ celebrationId, firstName, onAdded }: { celebrationId: string; firstName: string; onAdded: () => void }) {
  const [message, setMessage] = useState("");
  const [color, setColor] = useState<WishColor>("sun");
  const [isPrivate, setPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return setError("Write something first.");
    setBusy(true);
    setError(null);
    try {
      await data.addWish(celebrationId, { message: message.trim(), isPrivate, color });
      setMessage("");
      setPrivate(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't stick it up.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 lg:max-w-2xl" noValidate>
      <h2 className="label">Write a note for {firstName}</h2>
      <label htmlFor="wish-text" className="sr-only">Your note</label>
      <textarea
        id="wish-text"
        className="field min-h-24"
        maxLength={500}
        placeholder={`Happy birthday ${firstName}! …`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        style={{ background: colorBg(color) }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex items-center gap-1.5">
          <legend className="sr-only">Note colour</legend>
          {COLORS.map((c) => (
            <label key={c.id} className="cursor-pointer">
              <input type="radio" name="wish-color" className="peer sr-only" checked={color === c.id} onChange={() => setColor(c.id)} />
              <span
                aria-hidden="true"
                className="block h-8 w-8 rounded-full border-2 border-line peer-checked:border-plum peer-checked:ring-2 peer-checked:ring-plum/30 peer-focus-visible:outline-3 peer-focus-visible:outline-sky"
                style={{ background: c.bg }}
              />
              <span className="sr-only">{c.label}</span>
            </label>
          ))}
        </fieldset>
        <span className="hint">{message.length}/500</span>
      </div>
      <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--plum)]" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
        <span>
          <b className="text-plum"><LockIcon /> Private message</b>
          <span className="block text-muted">Only {firstName} can read it (classmates see nothing).</span>
        </span>
      </label>
      <ErrorNote>{error}</ErrorNote>
      <button type="submit" className="btn" disabled={busy || !message.trim()}>
        {busy ? "Sticking…" : isPrivate ? `Send privately to ${firstName}` : "Stick it on the wall"}
      </button>
    </form>
  );
}

/** One tap: a designed story card (with the plan) for Instagram. */
function ShareCardButton({ info, wishes }: { info: WallInfo; wishes: Wish[] }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<CardTheme>("party");
  const [line, setLine] = useState(info.plan ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const first = info.birthdayName.split(" ")[0];
  const quotes = wishes.filter((w) => !w.isPrivate).slice(0, 3).map((w) => ({ text: w.message.slice(0, 120), author: w.authorName }));

  useEffect(() => {
    if (!open) return;
    let live = true;
    const t = setTimeout(() => {
      drawStoryCard({ name: first!, roomName: info.roomName, wishCount: info.wishCount, line: line.trim() || null, quotes, theme })
        .then((blob) => {
          if (!live) return;
          blobRef.current = blob;
          setPreview((old) => {
            if (old) URL.revokeObjectURL(old);
            return URL.createObjectURL(blob);
          });
        })
        .catch(() => live && setStatus("Couldn't draw the card on this browser."));
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // quotes is derived from wishes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, theme, line, wishes, first, info.roomName, info.wishCount]);

  async function share() {
    if (!blobRef.current) return;
    const result = await shareStoryCard(blobRef.current, `${first}-birthday-bdap.png`, `Happy birthday ${first}!`);
    setStatus(result === "shared" ? "Shared!" : result === "downloaded" ? "Saved. Open Instagram and add it to your story." : null);
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        Share to Instagram
      </button>
    );
  }

  return (
    <div className="card pop-in flex w-full flex-col gap-3 md:flex-row md:items-start" role="dialog" aria-label="Share card">
      <div className="mx-auto w-[180px] shrink-0 overflow-hidden rounded-md border border-line bg-surface-2" style={{ aspectRatio: "9/16" }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`Story card: Happy birthday ${first}`} className="h-full w-full object-cover" />
        ) : (
          <Loading label="Drawing the card" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <fieldset>
          <legend className="label mb-1">Design</legend>
          <div className="seg">
            <label>
              <input type="radio" name="card-theme" className="sr-only" checked={theme === "party"} onChange={() => setTheme("party")} />
              Party night
            </label>
            <label>
              <input type="radio" name="card-theme" className="sr-only" checked={theme === "sunshine"} onChange={() => setTheme("sunshine")} />
              Sunshine
            </label>
          </div>
        </fieldset>
        <div>
          <label htmlFor="card-line" className="label">Your plan or a line</label>
          <input id="card-line" className="field" maxLength={140} placeholder="Cake at 4:30 PM in the CSE lab" value={line} onChange={(e) => setLine(e.target.value)} />
        </div>
        <p className="hint">On a phone, “Share” opens the share sheet: pick Instagram and add it to your story. Private notes are never on the card.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={share} disabled={!preview}>
            Share
          </button>
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
        {status && (
          <p className="text-sm font-bold text-ok" role="status">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
