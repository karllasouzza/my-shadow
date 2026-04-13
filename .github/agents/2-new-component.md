# Prompt 2: Component Development

Add a [COMPONENT NAME] to the project using the react-native-reusables pattern (NativeWind + @rn-primitives).

## Project Stack

- **React Native + Expo** — no HTML elements; use `View`, `Text`, `Pressable` from `react-native`
- **NativeWind v4** — `className` prop on RN components; token colors via `hsl(var(--...))` in `tailwind.config.js`
- **@rn-primitives** — accessible unstyled primitives (already installed) for complex interactive components
- **react-native-reusables pattern** — `cva`, `cn`, `TextClassContext`, wrapper components in `components/ui/`
- **No shadcn/ui**, no `next/*`, no HTML tags (`div`, `span`, `aside`), no dedicated preview route

## Hard Constraints

- All elements must be `View`, `Text`, `Pressable`, `Image`, `ScrollView`, or other RN core components
- Use `className` (NativeWind) for styling — no `style` prop unless absolutely required for dynamic values
- Color tokens only via Tailwind semantic classes (`bg-primary`, `text-muted-foreground`, `border-border`)
- Do **not** create a dedicated design-system or styleguide route

## Workflow

### 1. Check if a Primitive Exists in @rn-primitives

First check if `@rn-primitives` already provides a headless base for this component. Look in `components/ui/` — most primitives are already wrapped there.

**@rn-primitives available primitives (already installed):**

- **Layout:** Accordion, Collapsible, Separator, Tabs
- **Forms:** Checkbox, Label, Radio Group, Select, Switch, Toggle, Toggle Group
- **Feedback:** Progress
- **Overlay:** Alert Dialog, Context Menu, Dialog, Dropdown Menu, Hover Card, Menubar, Popover, Tooltip
- **Utilities:** Avatar, Badge, Portal, Slot

**Decision:**

- Primitive exists in @rn-primitives → go to Step 2 (Create wrapper)
- No primitive needed (simple visual component) → go to Step 3 (Build from scratch)

### 2. Create Wrapper Around @rn-primitives

Look at `components/ui/button.tsx`, `badge.tsx`, `alert.tsx`, `checkbox.tsx` as reference for the established pattern.

**Pattern A — Variant display component with `cva` (e.g. Badge, Alert):**

```tsx
import { View } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";

const componentVariants = cva(
  "items-center justify-center rounded-md border px-3 py-1.5",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary",
        secondary: "border-transparent bg-secondary",
        outline: "border-border bg-transparent",
        destructive: "border-transparent bg-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const componentTextVariants = cva("text-sm font-semibold", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      outline: "text-foreground",
      destructive: "text-destructive-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

interface ComponentProps
  extends
    React.ComponentPropsWithoutRef<typeof View>,
    VariantProps<typeof componentVariants> {
  label: string;
}

function Component({ label, variant, className, ...props }: ComponentProps) {
  return (
    <View className={cn(componentVariants({ variant }), className)} {...props}>
      <Text className={cn(componentTextVariants({ variant }))}>{label}</Text>
    </View>
  );
}

export { Component, componentVariants, componentTextVariants };
```

**Pattern B — Interactive Pressable component with `TextClassContext` (e.g. Button):**

```tsx
import { Pressable } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Text, TextClassContext } from "@/components/ui/text";

const buttonVariants = cva("flex-row items-center justify-center rounded-md", {
  variants: {
    variant: {
      default: "bg-primary active:opacity-90",
      outline: "border border-input bg-background active:bg-accent",
      ghost: "active:bg-accent",
      destructive: "bg-destructive active:opacity-90",
    },
    size: {
      default: "h-10 px-4 py-2",
      sm: "h-9 px-3",
      lg: "h-11 px-8",
      icon: "h-10 w-10",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

const buttonTextVariants = cva("text-sm font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      outline: "text-foreground",
      ghost: "text-foreground",
      destructive: "text-destructive-foreground",
    },
    size: { default: "", sm: "text-sm", lg: "text-base", icon: "" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

interface ButtonProps
  extends
    React.ComponentPropsWithoutRef<typeof Pressable>,
    VariantProps<typeof buttonVariants> {}

function Button({ variant, size, className, children, ...props }: ButtonProps) {
  return (
    <TextClassContext.Provider
      value={cn(buttonTextVariants({ variant, size }))}
    >
      <Pressable
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </Pressable>
    </TextClassContext.Provider>
  );
}

export { Button, buttonVariants, buttonTextVariants };
```

### 3. Build Visual-Only Component from Scratch

For layout components (cards, containers, separators, section wrappers):

```tsx
import { View } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";

const cardVariants = cva("rounded-xl border bg-card p-4", {
  variants: {
    variant: {
      default: "border-border",
      elevated: "border-transparent shadow-md",
      outline: "border-2 border-primary",
    },
  },
  defaultVariants: { variant: "default" },
});

interface CardProps
  extends
    React.ComponentPropsWithoutRef<typeof View>,
    VariantProps<typeof cardVariants> {}

function Card({ variant, className, ...props }: CardProps) {
  return (
    <View className={cn(cardVariants({ variant }), className)} {...props} />
  );
}

function CardHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof View>) {
  return <View className={cn("mb-2 gap-1", className)} {...props} />;
}

function CardTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Text>) {
  return (
    <Text
      role="heading"
      className={cn("text-xl font-semibold text-card-foreground", className)}
      {...props}
    />
  );
}

function CardContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof View>) {
  return <View className={cn("", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardContent };
```

### 4. Place the File

Save in `components/ui/[component-name].tsx`.

Export named — no default exports. No barrel `index.ts` needed unless the component is a multi-file module.

### 5. Validate on Real App Surfaces

**Do not create a dedicated styleguide or preview screen.** Validate the component by using it in an existing screen (`app/index.tsx`, `app/history.tsx`, or inside a feature under `features/`). Display all variants inline during development, then remove the test usage when done.

Example in a real screen:

```tsx
import { Badge, badgeVariants } from "@/components/ui/badge";

// Inside a real screen:
<View className="flex-row gap-2 flex-wrap">
  <Badge variant="default" label="Default" />
  <Badge variant="secondary" label="Secondary" />
  <Badge variant="outline" label="Outline" />
  <Badge variant="destructive" label="Destructive" />
</View>;
```

## Directory Structure

```
components/
├── ui/                          # react-native-reusables pattern
│   ├── button.tsx               # cva + Pressable + TextClassContext
│   ├── card.tsx                 # cva + View sub-components
│   ├── badge.tsx                # cva + @rn-primitives/slot
│   ├── alert.tsx                # cva + View/Text/Icon
│   └── [new-component].tsx      # ← new component here
└── [FeatureComponent].tsx       # Feature-specific compositions
```

## Output

- Component created in `components/ui/[component-name].tsx`
- Follows `cva` + `cn` + NativeWind `className` pattern
- Uses `@rn-primitives` if an accessible primitive exists
- Uses `View` / `Text` / `Pressable` — no HTML elements
- All token colors via Tailwind semantic classes (`bg-primary`, `text-muted-foreground`, etc.)
- Validated on an existing app screen — no dedicated preview route

---

## Notes

- **Read existing `components/ui/` files first** — match the established pattern exactly
- **CSS variables are the source of truth** in `global.css` and `context/themes/theme-config.ts`
- **Tailwind classes reference CSS variables** (`bg-primary`, `text-muted-foreground`, `border-border`)
- **No HTML elements** — only RN core components (`View`, `Text`, `Pressable`, `Image`, `ScrollView`, `FlatList`, etc.)
- **Dark mode** is handled by NativeWind's `darkMode: "class"` — use semantic tokens (`bg-card`, not `bg-white`)
- **Accessibility** — use `accessibilityRole`, `accessibilityLabel`, and `aria-*` props from @rn-primitives where needed
- **Extend, don't rebuild** — wrap existing `components/ui/` components before creating from scratch
