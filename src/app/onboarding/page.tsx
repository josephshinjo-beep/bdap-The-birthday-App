import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { OnboardingView } from "./onboarding-view";

export const metadata: Metadata = { title: "Your profile" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <OnboardingView />
    </Suspense>
  );
}
