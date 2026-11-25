import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { ManageView } from "./manage-view";

export const metadata: Metadata = { title: "Moderator dashboard" };

export default function ManagePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ManageView />
    </Suspense>
  );
}
