import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { EditView } from "./edit-view";

export const metadata: Metadata = { title: "Edit room" };

export default function EditPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditView />
    </Suspense>
  );
}
