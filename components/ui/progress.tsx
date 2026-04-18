import { cn } from "@/lib/utils";
import * as ProgressPrimitive from "@rn-primitives/progress";
import * as React from "react";
import { Platform, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

function Progress({
  className,
  value,
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
}) {
  return (
    <ProgressPrimitive.Root
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className,
      )}
      {...props}
    >
      <Indicator value={value} className={indicatorClassName} />
    </ProgressPrimitive.Root>
  );
}

export { Progress };

const Indicator = Platform.select({
  web: WebIndicator,
  native: NativeIndicator,
  default: NullIndicator,
});

type IndicatorProps = {
  value: number | undefined | null;
  className?: string;
};

function WebIndicator({ value, className }: IndicatorProps) {
  if (Platform.OS !== "web") {
    return null;
  }

  return (
    <View
      className={cn(
        "bg-primary h-full w-full flex-1 transition-all",
        className,
      )}
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    >
      <ProgressPrimitive.Indicator className={cn("h-full w-full", className)} />
    </View>
  );
}

function NativeIndicator({ value, className }: IndicatorProps) {
  const widthShared = useSharedValue(1);

  React.useEffect(() => {
    const target = Math.max(1, Math.min(100, value ?? 0));
    widthShared.value = withSpring(target, { overshootClamping: true });
  }, [value]);

  const indicator = useAnimatedStyle(() => {
    return {
      width: `${widthShared.value}%`,
    };
  }, []);

  if (Platform.OS === "web") {
    return null;
  }

  return (
    <ProgressPrimitive.Indicator asChild>
      <Animated.View
        style={indicator}
        className={cn("bg-foreground h-full", className)}
      />
    </ProgressPrimitive.Indicator>
  );
}

function NullIndicator(_props: IndicatorProps) {
  return null;
}
