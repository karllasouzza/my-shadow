import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Brain } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";

interface ReasoningToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function ReasoningToggle({ enabled, onToggle }: ReasoningToggleProps) {
  const fillOpacity = useSharedValue(0);
  const prevEnabled = useRef(enabled);

  useEffect(() => {
    if (prevEnabled.current === enabled) return;
    prevEnabled.current = enabled;

    fillOpacity.value = withSpring(enabled ? 1 : 0, {
      damping: 15,
      stiffness: 80,
    });
  }, [enabled]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: fillOpacity.value,
  }));

  return (
    <Button
      variant={"outline"}
      size="sm"
      onPress={onToggle}
      className={cn("min-w-0", enabled ? "!border-primary" : "border-border")}
      accessibilityRole="button"
      accessibilityLabel="Alterne entre o processo de raciocínio da IA"
    >
      {/* Glow overlay behind icon */}
      <Animated.View
        className="absolute inset-0 rounded-md bg-primary/20"
        style={glowStyle}
        pointerEvents="none"
      />

      <Brain
        size={16}
        strokeWidth={2}
        color={enabled ? "hsl(247 96% 78%)" : "hsl(240 5% 44%)"}
        fill={enabled ? "hsla(247 96% 78% / 0.3)" : "transparent"}
      />
    </Button>
  );
}
