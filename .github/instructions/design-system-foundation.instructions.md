---
name: design-system-foundation.instructions
description: |
  Use when adapting design tokens, themes, or NativeWind-based primitives to
  match a design asset. Trigger phrases: design tokens, NativeWind, theme,
  global.css, theme-config.ts, components/ui, Expo font loading. Enforces:
  - No shadcn/ui initialization
  - No web-only APIs (next/*, div, main, aside, next/link)
applyTo: "**/*.css, context/themes/**, components/**,  features/*.tsx, features/**/*.tsx, app/_layout.tsx, tailwind.config.js, assets/fonts/**"
---

Purpose

- Ensure design-system work follows the repository conventions: NativeWind,
  HSL token variables in `global.css`, and JS runtime sync in
  `context/themes/theme-config.ts`.

Hard Rules

- Always update `global.css` token variables as raw HSL triples (no wrapping
  with `hsl(...)`).
- Mirror any token changes in `context/themes/theme-config.ts` `rawColors` so
  the JS runtime has the same single source of truth.
- Prefer updating existing `components/ui/*` primitives. Do not introduce a
  second UI layer or install `shadcn/ui`.
- Never add web-only APIs or Next.js-only packages. Keep all UI work
  React-Native + Expo-compatible.
- Only add semantic tokens (`--success`, `--warning`, `--info`) when they are
  actually required by components or requested explicitly.

Process (recommended)

1. Confirm inputs: `screenshot` path/URL and any `overrides` (color, font,
   radius).
2. Produce an initial token proposal (HSL triples). If ambiguous, provide 2–3
   options for the user to choose from.
3. Prepare patches for `/global.css` and `/context/themes/theme-config.ts`.
4. Present patches for review and request confirmation before applying.
5. After approval, apply patches and optionally update `components/ui/*` to
   consume tokens via `className` and `cn(...)`/`cva(...)` patterns.

Font rules

- If a non-default font is required, add font loading via `expo-font` and
  update `app/_layout.tsx` only after user approval. Do not use web font
  loaders or `next/font`.

Accessibility

- Aim for body text contrast ≥ 4.5:1 where practical. Document any
  accessibility trade-offs and assumptions.

Change Controls

- Present diffs for any token or font changes prior to committing. If running
  non-interactively, apply only minimal safe changes and include a summary
  explaining assumptions.

Examples (prompts)

- "Adapt tokens from assets/designs/home.png and prepare patches."
- "Only prepare a `global.css` patch for review; don't apply changes yet."
- "Add Inter font loading from assets/fonts/Inter.ttf and update layout."

Notes

- Keep changes minimal and consistent with existing NativeWind +
  `components/ui` patterns. Avoid one-off hardcoded colors. Document all
  assumptions.
