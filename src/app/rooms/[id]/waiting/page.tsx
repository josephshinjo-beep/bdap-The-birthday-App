import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { WaitingView } from "./waiting-view";

export const metadata: Metadata = { title: "Waiting for the moderator" };

export default function WaitingPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <WaitingView />
    </Suspense>
  );
}
