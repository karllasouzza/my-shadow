/**
 * Onboarding Route
 *
 * Wrapper route that shows the current onboarding step based on guard state.
 * Uses OnboardingRouter to render the correct screen:
 * SecurityGateScreen | ModelSelectionScreen | ModelLoadingScreen
 *
 * On completion: redirects to main app with router.replace('/').
 */

import React from "react";
import { OnboardingRouter } from "@/features/onboarding";

export default function OnboardingRoute() {
  return <OnboardingRouter />;
}
