import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { PlanView } from "./plan-view";

export const metadata: Metadata = { title: "Plan a celebration", robots: { index: false } };

export default function PlanPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <PlanView />
    </Suspense>
  );
}
