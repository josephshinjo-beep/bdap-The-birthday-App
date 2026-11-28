import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { cleanEnv } from "@/lib/push";

/** True when the request carries `Authorization: Bearer $CRON_SECRET` (compared in constant time). */
export function hasCronSecret(request: NextRequest): boolean {
  const secret = cleanEnv(process.env.CRON_SECRET);
  if (secret.length < 16) return false;
  const a = Buffer.from(request.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
