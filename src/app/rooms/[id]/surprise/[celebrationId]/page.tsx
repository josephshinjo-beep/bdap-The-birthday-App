import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { SurpriseView } from "./surprise-view";

export const metadata: Metadata = { title: "A secret surprise", robots: { index: false } };

export default function SurprisePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SurpriseView />
    </Suspense>
  );
}
