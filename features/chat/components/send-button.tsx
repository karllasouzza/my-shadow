/**
 * Send Button
 *
 * Troca de ícone com transição sutil:
 * - O novo ícone entra com rotação leve e rápida
 */

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import React, { useEffect, useRef } from "react";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

const AnimatedButton = Animated.createAnimatedComponent(Button);

interface SendButtonProps {
  isGenerating: boolean;
  hasMessage: boolean;
  onSend: () => void;
  onCancel: () => void;
}

export function SendButton({
  isGenerating,
  hasMessage,
  onSend,
  onCancel,
}: SendButtonProps) {
  const rotate = useSharedValue(0.5);
  const prevGenerating = useRef(isGenerating);

  useEffect(() => {
    if (prevGenerating.current === isGenerating) return;
    prevGenerating.current = isGenerating;

    rotate.value = withTiming(isGenerating ? 360.5 : 0.5, {
      duration: 300,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [isGenerating]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const handlePress = () => {
    if (isGenerating) {
      onCancel();
    } else {
      onSend();
    }
  };

  return (
    <AnimatedButton
      onPress={handlePress}
      variant={isGenerating ? "destructive" : "default"}
      size="icon"
      disabled={!hasMessage && !isGenerating}
      accessibilityRole="button"
      accessibilityLabel={isGenerating ? "Cancelar geração" : "Enviar mensagem"}
    >
      <Animated.View style={iconStyle}>
        {isGenerating ? (
          <Icon
            as={require("lucide-react-native").Square}
            className="text-destructive size-5"
          />
        ) : (
          <Icon
            as={require("lucide-react-native").ArrowUp}
            className="text-primary-foreground size-5"
          />
        )}
      </Animated.View>
    </AnimatedButton>
  );
}
