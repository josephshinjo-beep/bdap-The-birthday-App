import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { JoinView } from "./join-view";

export const metadata: Metadata = { title: "Join your class room" };

export default function JoinPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <JoinView />
    </Suspense>
  );
}
