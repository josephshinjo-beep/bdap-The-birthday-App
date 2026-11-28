import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import webpush from "web-push";

vi.mock("server-only", () => ({}));

const KEYS = webpush.generateVAPIDKeys();
const ENV = ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;

// push.ts caches its configuration, so load a fresh copy for each set of env values.
async function load(env: Partial<Record<(typeof ENV)[number], string>>) {
  for (const k of ENV) delete process.env[k];
  Object.assign(process.env, env);
  vi.resetModules();
  return import("./push");
}

describe("pushConfigProblem", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => {
    for (const k of ENV) delete process.env[k];
    vi.restoreAllMocks();
  });

  it("accepts a valid key pair and mailto subject", async () => {
    const push = await load({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: KEYS.publicKey, VAPID_PRIVATE_KEY: KEYS.privateKey, VAPID_SUBJECT: "mailto:a@b.co" });
    expect(push.pushConfigProblem()).toBeNull();
    expect(push.isPushConfigured()).toBe(true);
  });

  it("turns a bare email subject into mailto:", async () => {
    const push = await load({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: KEYS.publicKey, VAPID_PRIVATE_KEY: KEYS.privateKey, VAPID_SUBJECT: "a@b.co" });
    expect(push.pushConfigProblem()).toBeNull();
  });

  it("ignores stray whitespace and quotes around values", async () => {
    const push = await load({
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: ` "${KEYS.publicKey}"\n`,
      VAPID_PRIVATE_KEY: `'${KEYS.privateKey}' `,
      VAPID_SUBJECT: " mailto:a@b.co ",
    });
    expect(push.pushConfigProblem()).toBeNull();
  });

  it("names a missing key", async () => {
    const push = await load({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: KEYS.publicKey });
    expect(push.pushConfigProblem()).toMatch(/VAPID_PRIVATE_KEY is not set/);
  });

  it("names a bad subject without echoing its value", async () => {
    const push = await load({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: KEYS.publicKey, VAPID_PRIVATE_KEY: KEYS.privateKey, VAPID_SUBJECT: "Birthday Team" });
    const problem = push.pushConfigProblem();
    expect(problem).toMatch(/^VAPID_SUBJECT/);
    expect(problem).not.toContain("Birthday Team");
  });

  it("names an invalid public key instead of throwing", async () => {
    const push = await load({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: KEYS.privateKey, VAPID_PRIVATE_KEY: KEYS.privateKey });
    expect(push.pushConfigProblem()).toMatch(/^NEXT_PUBLIC_VAPID_PUBLIC_KEY/);
  });

  it("names an invalid private key", async () => {
    const push = await load({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: KEYS.publicKey, VAPID_PRIVATE_KEY: KEYS.publicKey });
    expect(push.pushConfigProblem()).toMatch(/^VAPID_PRIVATE_KEY/);
  });

  it("sendPushes reports nothing sent rather than throwing when settings are bad", async () => {
    const push = await load({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: "nope", VAPID_PRIVATE_KEY: "nope" });
    await expect(
      push.sendPushes([{ sub: { endpoint: "https://fcm.googleapis.com/x", p256dh: "a", auth: "b" }, payload: { title: "t", body: "b", url: "/" } }]),
    ).resolves.toEqual({ sent: 0, failed: 0, gone: [] });
  });
});
