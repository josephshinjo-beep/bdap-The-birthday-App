"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { CodeInput } from "@/components/code-input";
import { ProfileForm } from "@/components/profile-form";
import { useSession } from "@/components/providers";
import { ErrorNote, Page } from "@/components/ui";
import { data } from "@/lib/data";
import { DataError, type RoomPreview, type Session } from "@/lib/types";

export function JoinView() {
  return <AuthGate needProfile={false}>{(s) => <Join session={s} />}</AuthGate>;
}

type Step = "code" | "enrol";

function Join({ session }: { session: Session }) {
  const router = useRouter();
  const { refresh } = useSession();
  const initialCode = (useSearchParams().get("code") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const [code, setCode] = useState(initialCode);
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState<Step>("code");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Reset when the code changes; look it up once all six are in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(null);
    setNotFound(false);
    if (code.length !== 6) return;
    let live = true;
    setChecking(true);
    data
      .previewRoom(code)
      .then((p) => {
        if (!live) return;
        setPreview(p);
        setNotFound(!p);
      })
      .catch(() => live && setNotFound(true))
      .finally(() => live && setChecking(false));
    return () => {
      live = false;
    };
  }, [code]);

  async function sendRequest() {
    setSending(true);
    setError(null);
    try {
      const r = await data.requestJoin(code);
      router.push(r.status === "approved" ? `/rooms/${r.roomId}` : `/rooms/${r.roomId}/waiting`);
    } catch (e) {
      setError(e instanceof DataError && e.code === "room_not_found" ? "That room no longer exists. Ask for a new code." : "Couldn't send your request. Try again.");
      setSending(false);
    }
  }

  function onThisIsMyClass() {
    if (!preview) return;
    if (preview.myStatus === "approved") return router.push(`/rooms/${preview.roomId}`);
    if (preview.myStatus === "pending") return router.push(`/rooms/${preview.roomId}/waiting`);
    if (!session.profile) return setStep("enrol");
    void sendRequest();
  }

  if (step === "enrol" && preview) {
    return (
      <Page narrow>
        <button type="button" onClick={() => setStep("code")} className="mb-3 inline-flex min-h-11 items-center gap-1 font-bold text-muted hover:text-ink">
          <span aria-hidden="true">←</span> Back
        </button>
        <p className="chip">Joining {preview.name}</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold">Your details for the class</h1>
        <p className="mt-1 text-muted">{preview.moderatorFirstName ?? "The moderator"} will see these when you ask to join.</p>
        <div className="card mt-5 p-5">
          <ProfileForm
            initial={{ fullName: session.suggestedName ?? "" }}
            submitLabel="Send join request"
            onSaved={async () => {
              await refresh();
              await sendRequest();
            }}
          />
          <ErrorNote>{error}</ErrorNote>
        </div>
      </Page>
    );
  }

  return (
    <Page narrow>
      <div className="enter mt-6 text-center">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Join your class room</h1>
        <p className="mt-1 text-muted">Type the 6-character code your class rep shared.</p>
      </div>
      <div className="enter-2 mt-8">
        <CodeInput value={code} onChange={setCode} invalid={notFound} autoFocus={!initialCode} />
        <p className="mt-3 min-h-6 text-center text-sm" aria-live="polite">
          {checking ? <span className="text-muted">Checking the code…</span> : notFound ? <span className="font-medium text-danger">No room with that code. Check it with your class rep.</span> : null}
        </p>
      </div>

      {preview && (
        <div className="card pop-in mt-4 p-5">
          <p className="text-sm font-bold uppercase tracking-wide text-muted">Room found</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{preview.name}</p>
          <p className="mt-1 text-muted">
            {preview.memberCount} {preview.memberCount === 1 ? "member" : "members"}
            {preview.moderatorFirstName && <> · run by {preview.moderatorFirstName}</>}
          </p>
          {preview.myStatus === "declined" && <p className="mt-2 text-sm text-muted">Your last request was declined. You can ask again.</p>}
          <button type="button" className="btn mt-4 w-full" onClick={onThisIsMyClass} disabled={sending}>
            {sending ? "Sending…" : preview.myStatus === "approved" ? "Open the room →" : preview.myStatus === "pending" ? "See my request →" : "This is my class →"}
          </button>
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </Page>
  );
}
