import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { RoomsView } from "./rooms-view";

export const metadata: Metadata = { title: "My rooms" };

export default function RoomsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RoomsView />
    </Suspense>
  );
}
