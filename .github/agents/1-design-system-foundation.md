# Prompt 1: Design System Foundation

Analyze this design screenshot, extract design tokens, and adapt the existing design system for this React Native app.

## Project Stack

This repository is **not** a Next.js/shadcn web app.

Use the real stack already present in the project:

- **React Native + Expo Router**
- **NativeWind** for utility-first styling via `className`
- **react-native-reusables style wrappers** built on top of `@rn-primitives`
- Existing UI primitives in `components/ui/`
- Existing theme tokens in `global.css`
- Existing runtime theme sync in `context/themes/theme-config.ts`

## Hard Constraints

- Do **not** initialize `shadcn/ui`
- Do **not** use `next/font`, `next/link`, `div`, `aside`, `main`, or other web-only APIs
- Do **not** create a dedicated design-system route or preview screen unless the user explicitly asks for one
- Do **not** replace the current architecture with a web-first design system
- Prefer extending the existing token system and reusable primitives instead of inventing a second UI layer

## Input

[SCREENSHOT FROM DRIBBBLE, BEHANCE, OR ANY DESIGN INSPIRATION]

## Workflow

### 1. Analyze the Design

Look at the image and identify or infer:

**Colors:**

- Primary or brand color and a usable tonal scale
- Neutral greys for surfaces and text hierarchy
- Background and card surface colors
- Border and divider colors
- Semantic colors: success, warning, error, info

**Typography:**

- Likely font family
- Heading sizes and weights
- Body sizes
- Caption or helper text scale

**Spacing and Radius:**

- Spacing rhythm: compact, standard, relaxed
- Border radius style: sharp, rounded, pill

**Depth and Motion:**

- Shadow intensity
- Whether the UI feels flat, soft, elevated, or layered

### 2. Map the Design to the Existing Theme System

Use the existing theme structure instead of introducing a new one.

Primary files to update:

- `/global.css`
- `/context/themes/theme-config.ts`
- `/tailwind.config.js` only if new semantic tokens are required

Keep the token naming aligned with the current system:

- `--background`
- `--foreground`
- `--card`
- `--card-foreground`
- `--popover`
- `--popover-foreground`
- `--primary`
- `--primary-foreground`
- `--secondary`
- `--secondary-foreground`
- `--muted`
- `--muted-foreground`
- `--accent`
- `--accent-foreground`
- `--destructive`
- `--destructive-foreground`
- `--border`
- `--input`
- `--ring`
- `--radius`

If the design clearly needs additional semantic tokens, add them consistently across the stack, for example:

- `--success`
- `--success-foreground`
- `--warning`
- `--warning-foreground`
- `--info`
- `--info-foreground`

Only add extra domain-specific tokens when the design actually requires them.

### 3. Update `global.css`

Replace or refine the root tokens in `/global.css` using the extracted palette.

This project uses the existing NativeWind-compatible pattern, so keep the file in this style:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: [h s l];
    --foreground: [h s l];
    --card: [h s l];
    --card-foreground: [h s l];
    --popover: [h s l];
    --popover-foreground: [h s l];
    --primary: [h s l];
    --primary-foreground: [h s l];
    --secondary: [h s l];
    --secondary-foreground: [h s l];
    --muted: [h s l];
    --muted-foreground: [h s l];
    --accent: [h s l];
    --accent-foreground: [h s l];
    --destructive: [h s l];
    --destructive-foreground: [h s l];
    --border: [h s l];
    --input: [h s l];
    --ring: [h s l];
    --radius: [radius value];
  }

  .dark:root {
    --background: [dark h s l];
    --foreground: [dark h s l];
    --card: [dark h s l];
    --card-foreground: [dark h s l];
    --popover: [dark h s l];
    --popover-foreground: [dark h s l];
    --primary: [dark h s l];
    --primary-foreground: [dark h s l];
    --secondary: [dark h s l];
    --secondary-foreground: [dark h s l];
    --muted: [dark h s l];
    --muted-foreground: [dark h s l];
    --accent: [dark h s l];
    --accent-foreground: [dark h s l];
    --destructive: [dark h s l];
    --destructive-foreground: [dark h s l];
    --border: [dark h s l];
    --input: [dark h s l];
    --ring: [dark h s l];
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    background: hsl(var(--background));
    color: hsl(var(--foreground));
  }
}
```

Use HSL triples without wrapping them in `hsl(...)` inside the variables, matching the current project convention.

### 4. Keep `theme-config.ts` in Sync

If the app relies on `vars()` for runtime theme injection, update `/context/themes/theme-config.ts` to mirror the same token values.

Requirements:

- `rawColors` stays the single source of truth for JS-side theme values
- Light and dark entries stay aligned with `global.css`
- Any new semantic token added in CSS must also exist in `theme-config.ts` if used by runtime theme switching
- Preserve the existing object structure and naming conventions

### 5. Add the Recommended Font the React Native Way

If a specific font is important to match the design, integrate it with Expo, not Next.js.

Preferred options:

- `expo-font`
- A Google font package compatible with Expo, if already appropriate for the project

Update `/app/_layout.tsx` if needed, for example:

```tsx
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter: require('../assets/fonts/Inter.ttf'),
  });

  React.useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (...);
}
```

Only add font-loading code if the design actually depends on a non-default font.

### 6. Use Existing Reusable Primitives Instead of Installing shadcn Components

This project already has reusable UI wrappers in `components/ui/`.

Prefer reusing and updating those components:

- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/badge.tsx`
- `components/ui/alert.tsx`
- `components/ui/radio-group.tsx`
- other existing wrappers in `components/ui/`

Guidance:

- Keep styling in `className` using NativeWind
- Follow the current wrapper patterns based on `@rn-primitives`
- Preserve `cn(...)`, `cva(...)`, and shared text context patterns already used in the repo
- If a component is missing, create it under `components/ui/` using the existing conventions rather than introducing a web-only component library

### 7. Validate Through Real App Surfaces

Do not create a dedicated design-system screen by default.

Instead, validate the design system by one of these approaches:

- updating an existing screen to use the new tokens more consistently
- creating a small colocated preview component inside an existing feature folder if explicitly needed
- verifying the existing `components/ui` primitives render correctly with the new palette and radius values

If a visual preview is needed, keep it inside the existing app structure and only create it when explicitly requested.

## Output

- Updated `/global.css` with the extracted design tokens
- Updated `/context/themes/theme-config.ts` when runtime token sync is needed
- Updated `/app/_layout.tsx` only if font loading is required
- Existing reusable primitives in `components/ui/` aligned with the new token set when necessary
- No dedicated preview route and no web-only design-system implementation
- Design system ready for follow-up prompts that build components or screens in the real app

---

## Design Summary (also provide)

After setup, summarize:

- **Primary color:** [hex and color name]
- **Font:** [font name]
- **Style:** [e.g. "Modern minimal", "Bold moody", "Soft editorial"]
- **Border radius:** [e.g. "Rounded 12px", "Sharp", "Pill"]
- **Overall feel:** [brief description]

---

## Notes

- If colors are not clearly visible, make reasonable inferences
- Ensure accessible contrast, especially for body text and primary actions
- Prefer a single coherent token system instead of one-off hardcoded colors
- Match the current project conventions before adding new abstractions
- When in doubt, follow the existing NativeWind + `components/ui` architecture already present in the repo
