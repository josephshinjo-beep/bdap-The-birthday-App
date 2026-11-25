"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { CodeInput } from "@/components/code-input";
import { ProfileForm } from "@/components/profile-form";
import { useSession } from "@/components/providers";
import { BackLink, ErrorNote, Page, RoomBadge } from "@/components/ui";
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
      <Page>
        <button type="button" onClick={() => setStep("code")} className="back">
          <span aria-hidden="true">←</span> Back
        </button>
        <span className="pill self-start">Joining {preview.name}</span>
        <h1 className="a-h">Tell your class <em>who you are</em></h1>
        <p className="a-sub">{preview.moderatorFirstName ?? "The moderator"} sees these when you ask to join.</p>
        <ProfileForm
          initial={{ fullName: session.suggestedName ?? "" }}
          submitLabel="Send join request"
          onSaved={async () => {
            await refresh();
            await sendRequest();
          }}
        />
        <ErrorNote>{error}</ErrorNote>
      </Page>
    );
  }

  return (
    <Page>
      <BackLink href="/">Back</BackLink>
      <h1 className="a-h enter">Got a <em>room code?</em></h1>
      <p className="a-sub enter-2">
        Ask your class moderator. It looks like <span className="font-mono text-[13px] text-plum">K7P2QX</span>.
      </p>
      <div className="enter-2">
        <CodeInput value={code} onChange={setCode} invalid={notFound} autoFocus={!initialCode} />
      </div>
      <p className="min-h-5 text-[13px]" aria-live="polite">
        {checking ? <span className="text-muted">Checking the code…</span> : notFound ? <span className="font-bold text-danger">No room with that code. Check it with your moderator.</span> : null}
      </p>

      {preview && (
        <>
          <div className="card pop-in flex items-center gap-2.5">
            <RoomBadge name={preview.name} />
            <div>
              <b className="text-plum">{preview.name}</b>
              <p className="hint">
                {preview.memberCount} {preview.memberCount === 1 ? "member" : "members"}
                {preview.moderatorFirstName && <> · Moderator: {preview.moderatorFirstName}</>}
              </p>
            </div>
          </div>
          {preview.myStatus === "declined" && <p className="hint">Your last request was declined. You can ask again.</p>}
          <button type="button" className="btn pop-in" onClick={onThisIsMyClass} disabled={sending}>
            {sending ? "Sending…" : preview.myStatus === "approved" ? "Open the room →" : preview.myStatus === "pending" ? "See my request →" : "This is my class →"}
          </button>
          <ErrorNote>{error}</ErrorNote>
        </>
      )}
      <p className="hint">Wrong room? Clear the boxes and try again. Codes are not case-sensitive.</p>
    </Page>
  );
}
