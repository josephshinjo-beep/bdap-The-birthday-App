import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { CreateView } from "./create-view";

export const metadata: Metadata = { title: "Create a room" };

export default function CreatePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CreateView />
    </Suspense>
  );
}
