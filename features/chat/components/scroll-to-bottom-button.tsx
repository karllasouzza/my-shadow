/**
 * Scroll To Bottom Button
 *
 * Botão flutuante que aparece quando o usuário rola para cima.
 * Animações sutis:
 * - Entrada: sobe de baixo para cima com fade-in
 * - Saída: desce de cima para baixo com fade-out
 */

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import React from "react";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

interface ScrollToBottomButtonProps {
  visible: boolean;
  onPress: () => void;
}

const ANIM_DURATION = 250;

export function ScrollToBottomButton({
  visible,
  onPress,
}: ScrollToBottomButtonProps) {
  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      // Entrada: sobe + fade-in
      translateY.value = withTiming(0, {
        duration: ANIM_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      opacity.value = withTiming(1, {
        duration: ANIM_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      // Saída: desce + fade-out
      translateY.value = withTiming(10, {
        duration: ANIM_DURATION * 0.7,
        easing: Easing.in(Easing.cubic),
      });
      opacity.value = withTiming(0, {
        duration: ANIM_DURATION * 0.7,
        easing: Easing.in(Easing.cubic),
      });
    }
  }, [visible, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="absolute bottom-0 left-0 right-0 items-center pb-24 pointer-events-none"
      style={animatedStyle}
    >
      <Button
        variant="secondary"
        size="icon"
        onPress={onPress}
        className="rounded-full shadow-lg pointer-events-auto"
        accessibilityLabel="Rolar para baixo"
      >
        <Icon
          as={require("lucide-react-native").ChevronsDown}
          className="size-5 text-foreground"
        />
      </Button>
    </Animated.View>
  );
}
