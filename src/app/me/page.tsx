import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { MeView } from "./me-view";

export const metadata: Metadata = { title: "Your profile" };

export default function MePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MeView />
    </Suspense>
  );
}
