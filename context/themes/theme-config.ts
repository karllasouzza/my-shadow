import { vars } from "nativewind";

/**
 * Raw color values - Single source of truth for all theme colors.
 *
 * Design System: Minimalist AI Chat Interface
 * Primary: Soft Lavender (#999ff3 → HSL 238 78% 73%)
 * Rule 60-30-10: 60% white background, 30% soft grey cards, 10% lavender accents
 * Concept: Clean, airy, modern - inspired by contemporary AI assistants
 */
export const rawColors = {
  minimalist: {
    light: {
      // === CORE (60% - Dominant) ===
      "--color-background": "0 0% 98%" /* #FAFAFA */,
      "--color-foreground": "240 10% 12%" /* #1A1A2E */,

      // === SURFACES (30% - Secondary) ===
      "--color-card": "0 0% 100%" /* #FFFFFF */,
      "--color-card-foreground": "240 10% 12%",
      "--color-popover": "0 0% 100%",
      "--color-popover-foreground": "240 10% 12%",

      // === PRIMARY (10% - Accent) ===
      "--color-primary": "238 78% 73%" /* #999ff3 - Lavender */,
      "--color-primary-foreground": "240 10% 12%",

      // === SECONDARY ===
      "--color-secondary": "240 5% 96%" /* #F5F5F7 */,
      "--color-secondary-foreground": "240 10% 12%",

      // === MUTED ===
      "--color-muted": "240 5% 96%",
      "--color-muted-foreground": "240 5% 50%",

      // === ACCENT ===
      "--color-accent": "238 78% 93%" /* Very light lavender */,
      "--color-accent-foreground": "240 10% 12%",

      // === DESTRUCTIVE ===
      "--color-destructive": "0 70% 55%",
      "--color-destructive-foreground": "0 0% 100%",

      // === BORDERS & INPUTS ===
      "--color-border": "240 5% 90%" /* #E5E5E5 */,
      "--color-input": "240 5% 90%",
      "--color-ring": "238 78% 73%" /* Matches primary */,

      // === SEMANTIC ===
      "--color-success": "160 45% 48%",
      "--color-success-foreground": "0 0% 100%",
      "--color-warning": "40 70% 55%",
      "--color-warning-foreground": "240 10% 12%",
      "--color-info": "238 60% 65%",
      "--color-info-foreground": "0 0% 100%",

      // === ONBOARDING ===
      "--color-onboarding-1": "0 0% 98%",
      "--color-onboarding-1-foreground": "240 10% 12%",
      "--color-onboarding-2": "238 60% 92%",
      "--color-onboarding-2-foreground": "240 10% 12%",
      "--color-onboarding-3": "240 5% 94%",
      "--color-onboarding-3-foreground": "240 10% 12%",

      // === BOTTOM BAR ===
      "--color-bottom-bar": "0 0% 100%",
      "--color-bottom-bar-foreground": "240 10% 12%",
      "--color-bottom-bar-accent": "238 78% 73%",
      "--color-bottom-bar-accent-foreground": "240 10% 12%",
    },
    dark: {
      // === CORE (60% - Dominant) ===
      "--color-background": "240 10% 8%" /* #111118 */,
      "--color-foreground": "0 0% 95%" /* #F2F2F2 */,

      // === SURFACES (30% - Secondary) ===
      "--color-card": "240 8% 12%" /* #1A1A24 */,
      "--color-card-foreground": "0 0% 95%",
      "--color-popover": "240 8% 12%",
      "--color-popover-foreground": "0 0% 95%",

      // === PRIMARY (10% - Accent, brighter for dark) ===
      "--color-primary": "238 78% 78%" /* #A5AAF4 */,
      "--color-primary-foreground": "240 10% 12%",

      // === SECONDARY ===
      "--color-secondary": "240 5% 16%" /* #28282F */,
      "--color-secondary-foreground": "0 0% 95%",

      // === MUTED ===
      "--color-muted": "240 5% 16%",
      "--color-muted-foreground": "240 5% 55%",

      // === ACCENT ===
      "--color-accent": "238 78% 20%" /* Subtle lavender tint */,
      "--color-accent-foreground": "0 0% 95%",

      // === DESTRUCTIVE ===
      "--color-destructive": "0 70% 55%",
      "--color-destructive-foreground": "0 0% 100%",

      // === BORDERS & INPUTS ===
      "--color-border": "240 5% 20%" /* #333340 */,
      "--color-input": "240 5% 20%",
      "--color-ring": "238 78% 78%",

      // === SEMANTIC ===
      "--color-success": "160 45% 48%",
      "--color-success-foreground": "0 0% 100%",
      "--color-warning": "40 70% 55%",
      "--color-warning-foreground": "240 10% 12%",
      "--color-info": "238 60% 65%",
      "--color-info-foreground": "0 0% 100%",

      // === ONBOARDING ===
      "--color-onboarding-1": "240 10% 8%",
      "--color-onboarding-1-foreground": "0 0% 95%",
      "--color-onboarding-2": "238 50% 18%",
      "--color-onboarding-2-foreground": "0 0% 95%",
      "--color-onboarding-3": "240 5% 14%",
      "--color-onboarding-3-foreground": "0 0% 95%",

      // === BOTTOM BAR ===
      "--color-bottom-bar": "240 8% 10%",
      "--color-bottom-bar-foreground": "0 0% 95%",
      "--color-bottom-bar-accent": "238 78% 78%",
      "--color-bottom-bar-accent-foreground": "240 10% 12%",
    },
  },
} as const;

/**
 * Themes with NativeWind vars() for use in style props.
 */
export const themes = {
  minimalist: {
    light: vars(rawColors.minimalist.light),
    dark: vars(rawColors.minimalist.dark),
  },
};
