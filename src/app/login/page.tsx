import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { LoginView } from "./login-view";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <LoginView />
    </Suspense>
  );
}
