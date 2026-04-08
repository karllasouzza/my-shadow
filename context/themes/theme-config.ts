import { vars } from "nativewind";

/**
 * Raw color values - Single source of truth for all theme colors.
 *
 * Design System: Shadow Jung Theme (Carl Jung inspired)
 * Primary: Deep Shadow Purple (#6b21a8 → HSL 277 65% 40%)
 * Secondary: Dark Slate (#1a1a1a → HSL 240 4% 14%)
 * Background: Near Black (#0a0a0a → HSL 240 5% 3%)
 * Accent: Individuation Gold (#d4a843 → HSL 40 60% 55%)
 * Concept: The unconscious shadow rendered in deep purple and warm gold
 */
export const rawColors = {
  shadow: {
    light: {
      // === CORE ===
      "--color-primary": "277 65% 40%",
      "--color-primary-foreground": "0 0% 100%",
      "--color-secondary": "240 4% 14%",
      "--color-secondary-foreground": "240 5% 90%",
      "--color-background": "240 5% 6%",
      "--color-foreground": "240 5% 92%",

      // === SURFACES ===
      "--color-card": "240 4% 9%",
      "--color-card-foreground": "240 5% 96%",
      "--color-popover": "240 4% 9%",
      "--color-popover-foreground": "240 5% 96%",

      // === MUTED / ACCENT ===
      "--color-muted": "240 3% 14%",
      "--color-muted-foreground": "240 5% 60%",
      "--color-accent": "40 60% 55%",
      "--color-accent-foreground": "240 5% 8%",

      // === DESTRUCTIVE ===
      "--color-destructive": "0 70% 55%",
      "--color-destructive-foreground": "0 0% 100%",

      // === BORDERS & INPUTS ===
      "--color-border": "240 4% 18%",
      "--color-input": "240 4% 18%",
      "--color-ring": "277 65% 50%",

      // === SEMANTIC ===
      "--color-success": "160 50% 45%",
      "--color-success-foreground": "240 5% 96%",
      "--color-warning": "40 75% 55%",
      "--color-warning-foreground": "240 5% 8%",
      "--color-info": "277 50% 60%",
      "--color-info-foreground": "240 5% 96%",

      // === ONBOARDING ===
      "--color-onboarding-1": "240 5% 3%",
      "--color-onboarding-1-foreground": "240 5% 92%",
      "--color-onboarding-2": "277 40% 15%",
      "--color-onboarding-2-foreground": "240 5% 96%",
      "--color-onboarding-3": "240 3% 12%",
      "--color-onboarding-3-foreground": "240 5% 90%",

      // === BOTTOM BAR ===
      "--color-bottom-bar": "240 4% 5%",
      "--color-bottom-bar-foreground": "240 5% 88%",
      "--color-bottom-bar-accent": "277 65% 40%",
      "--color-bottom-bar-accent-foreground": "0 0% 100%",
    },
    dark: {
      // === CORE ===
      "--color-primary": "277 70% 48%",
      "--color-primary-foreground": "0 0% 100%",
      "--color-secondary": "240 4% 14%",
      "--color-secondary-foreground": "240 5% 90%",
      "--color-background": "240 5% 3%",
      "--color-foreground": "240 5% 96%",

      // === SURFACES ===
      "--color-card": "240 4% 7%",
      "--color-card-foreground": "240 5% 96%",
      "--color-popover": "240 4% 7%",
      "--color-popover-foreground": "240 5% 96%",

      // === MUTED / ACCENT ===
      "--color-muted": "240 3% 12%",
      "--color-muted-foreground": "240 5% 58%",
      "--color-accent": "40 65% 58%",
      "--color-accent-foreground": "240 5% 8%",

      // === DESTRUCTIVE ===
      "--color-destructive": "0 70% 55%",
      "--color-destructive-foreground": "0 0% 100%",

      // === BORDERS & INPUTS ===
      "--color-border": "240 4% 16%",
      "--color-input": "240 4% 16%",
      "--color-ring": "277 70% 55%",

      // === SEMANTIC ===
      "--color-success": "160 50% 48%",
      "--color-success-foreground": "240 5% 96%",
      "--color-warning": "40 75% 58%",
      "--color-warning-foreground": "240 5% 8%",
      "--color-info": "277 55% 65%",
      "--color-info-foreground": "240 5% 96%",

      // === ONBOARDING ===
      "--color-onboarding-1": "240 5% 3%",
      "--color-onboarding-1-foreground": "240 5% 96%",
      "--color-onboarding-2": "277 40% 18%",
      "--color-onboarding-2-foreground": "240 5% 96%",
      "--color-onboarding-3": "240 3% 10%",
      "--color-onboarding-3-foreground": "240 5% 90%",

      // === BOTTOM BAR ===
      "--color-bottom-bar": "240 4% 4%",
      "--color-bottom-bar-foreground": "240 5% 85%",
      "--color-bottom-bar-accent": "277 70% 48%",
      "--color-bottom-bar-accent-foreground": "0 0% 100%",
    },
  },
} as const;

/**
 * Themes with NativeWind vars() for use in style props.
 * These are automatically generated from rawColors to avoid duplication.
 */
export const themes = {
  shadow: {
    light: vars(rawColors.shadow.light),
    dark: vars(rawColors.shadow.dark),
  },
};
