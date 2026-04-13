---
name: new-component.instructions
description: |
  Use when adding a new UI component following the repo's react-native-reusables
  conventions (NativeWind + @rn-primitives). Trigger phrases: new component,
  components/ui, cva, cn, TextClassContext, NativeWind, component variants.
applyTo: "**/components/ui/**, app/**, features/**, tailwind.config.js, global.css"
---

Purpose

- Ensure new components follow the repository's patterns: React Native core
  components, NativeWind `className` utilities, semantic tailwind tokens, and
  accessible primitives from `@rn-primitives`.

Hard Rules

- Use only React Native core components (`View`, `Text`, `Pressable`,
  `Image`, `ScrollView`, `FlatList`) or accessible primitives from
  `@rn-primitives`.
- Use `className` (NativeWind) for styling. Avoid `style` prop except for
  dynamic runtime values that cannot be expressed via classes.
- Color and surface styles must use semantic Tailwind classes (e.g.
  `bg-primary`, `text-muted-foreground`, `border-border`). Do not hardcode
  color hexes in component files.
- Check `@rn-primitives` first: wrap primitives rather than re-implementing
  accessibility behavior when available.
- Use `cva` for variants and `cn` for merging classes. When the component
  affects text styling, provide `TextClassContext` so children inherit text
  styles consistently.
- Export named components only (no default exports). File: `components/ui/[name].tsx`.
- Do not introduce web-only APIs or `shadcn/ui` components. Keep everything
  Expo + React Native compatible.

Recommended Process

1. Discover
   - Search `@rn-primitives` and `components/ui/` for an existing primitive or
     wrapper that matches the desired behavior.
2. Decide
   - Primitive exists -> implement a thin wrapper exposing `variant`, `size`,
     and other props using `cva`.
   - Primitive not available -> implement a visual component using RN core
     primitives and `cva` for variants.
3. Implement
   - Create `components/ui/[component-name].tsx` following existing file
     patterns (see `button.tsx`, `card.tsx`, `badge.tsx`).
   - Define `componentVariants` via `cva(...)` and a matching
     `componentTextVariants` when applicable.
   - Provide TypeScript `VariantProps` typings and extend the appropriate RN
     prop type (`View`, `Pressable`, etc.).
   - Use `accessibilityRole`, `accessibilityLabel`, and other a11y props.
4. Validate
   - Use the new component in an existing screen under `app/` or `features/`
     to visually validate variants. Do not create a dedicated preview route.
   - Verify dark mode behavior via semantic tokens (e.g., `bg-card`).
5. Finalize
   - Present patches/diffs for review and apply after approval.

Files to Update

- `components/ui/[component-name].tsx` (new component)
- Optionally `components/ui/index.ts` (export) if the team prefers a barrel
- Optionally `global.css` and `context/themes/theme-config.ts` if new
  semantic tokens are required (present the token proposal first)
- Optionally `tailwind.config.js` only if you must register new utility names

Accessibility & QA

- Always include `accessibilityRole` and `accessibilityLabel` where appropriate.
- Test keyboard + screen reader behavior for interactive components.
- Ensure color tokens provide sufficient contrast for body text (>= 4.5:1
  when practical).

Examples

- Wrapper (primitive exists): use `@rn-primitives` wrapper pattern and expose
  `variant` via `cva`.
- Button (interactive): use `Pressable`, `TextClassContext`, `buttonVariants`,
  and export named `Button`.
- Card (visual): use `View` with `cardVariants`, provide `CardHeader`,
  `CardTitle`, and `CardContent` subcomponents.

Change Controls

- Present diffs for component code and any token changes before committing.
- If running non-interactively, apply only minimal safe changes and include a
  summary of assumptions.

Prompts (examples)

- "Create a `Badge` component in `components/ui/badge.tsx` wrapping the slot
  primitive and adding `variant` and `size` props."
- "Add a `Toast` component in `components/ui/toast.tsx` using `@rn-primitives`
  AlertDialog primitive for accessibility."

Notes

- Read the existing `components/ui/*` files before implementing. Match the
  repository's established patterns exactly.
- Keep component logic minimal and push styling to `cva`/Tailwind classes so
  tokens remain the single source of truth.
