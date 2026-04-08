/**
 * Onboarding Router Component
 *
 * Renders the correct onboarding screen based on the guard state.
 * Uses getInitialRoute() to determine which screen to show.
 * On completion: redirects to main app using router.replace('/').
 */

import { router } from "expo-router";
import React, { useEffect } from "react";
import {
    getInitialRoute,
    type OnboardingRoute,
} from "../service/onboarding-guard";
import { ModelLoadingScreen } from "../view/model-loading-screen";
import { ModelSelectionScreen } from "../view/model-selection-screen";
import { SecurityGateScreen } from "../view/security-gate-screen";

/**
 * Props for the OnboardingRouter component.
 * Allows overriding the route for testing or deep-linking scenarios.
 */
export interface OnboardingRouterProps {
  /** Override the automatic route detection */
  forceRoute?: OnboardingRoute;
  /** Callback fired when onboarding completes (before redirect) */
  onComplete?: () => void;
}

/**
 * OnboardingRouter renders the appropriate onboarding screen based on
 * the current onboarding state.
 *
 * Route mapping:
 * - 'security-gate' → SecurityGateScreen (password/biometric setup)
 * - 'model-selection' → ModelSelectionScreen (choose and download model)
 * - 'model-loading' → ModelLoadingScreen (load model into memory)
 * - 'main' → Redirects to the main app
 */
export function OnboardingRouter({
  forceRoute,
  onComplete,
}: OnboardingRouterProps): React.JSX.Element {
  const route = forceRoute ?? getInitialRoute();

  // If already fully onboarded, redirect to main app
  useEffect(() => {
    if (route === "main") {
      const timer = setTimeout(() => {
        onComplete?.();
        router.replace("/" as any);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [route, onComplete]);

  switch (route) {
    case "security-gate":
      return <SecurityGateScreen />;

    case "model-selection":
      return <ModelSelectionScreen />;

    case "model-loading":
      return <ModelLoadingScreen />;

    case "main":
    default:
      // Show a brief loading state while redirecting
      return (
        <React.Fragment>
          {/* Redirecting — no visible UI needed */}
        </React.Fragment>
      );
  }
}

export default OnboardingRouter;
