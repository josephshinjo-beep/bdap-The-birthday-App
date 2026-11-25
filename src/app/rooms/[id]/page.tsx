import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { RoomView } from "./room-view";

export default function RoomPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RoomView />
    </Suspense>
  );
}
