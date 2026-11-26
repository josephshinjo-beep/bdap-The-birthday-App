import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { WallView } from "./wall-view";

export const metadata: Metadata = { title: "Birthday wall", robots: { index: false } };

export default function WallPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <WallView />
    </Suspense>
  );
}
