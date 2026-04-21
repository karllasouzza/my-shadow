/**
 * RecordingIndicator component
 *
 * Displays a pulsing animated dot while recording is active.
 * Uses react-native-reanimated for continuous scale/opacity animation.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 6.4, 11.2
 */

import { useEffect } from "react";
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecordingIndicatorProps {
  visible: boolean;
  cancelPreview: boolean; // reduces opacity to 0.5 when true
}

// ---------------------------------------------------------------------------
// Animation constants
// ---------------------------------------------------------------------------

const PULSE_DURATION = 600;
const SCALE_MIN = 0.75;
const SCALE_MAX = 1.0;
const OPACITY_MIN = 0.5;
const OPACITY_MAX = 1.0;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecordingIndicator({
  visible,
  cancelPreview,
}: RecordingIndicatorProps) {
  const scale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      // Start continuous pulsing animation
      scale.value = withRepeat(
        withSequence(
          withTiming(SCALE_MIN, { duration: PULSE_DURATION }),
          withTiming(SCALE_MAX, { duration: PULSE_DURATION }),
        ),
        -1, // infinite
        false,
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(OPACITY_MIN, { duration: PULSE_DURATION }),
          withTiming(OPACITY_MAX, { duration: PULSE_DURATION }),
        ),
        -1,
        false,
      );
    } else {
      // Stop animation and reset
      cancelAnimation(scale);
      cancelAnimation(pulseOpacity);
      scale.value = withTiming(1, { duration: 150 });
      pulseOpacity.value = withTiming(1, { duration: 150 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: cancelPreview ? 0.5 : pulseOpacity.value,
    display: visible ? "flex" : "none",
  }));

  return (
    <Animated.View
      className="bg-primary rounded-full w-3 h-3"
      style={animatedStyle}
      accessibilityRole="none"
    />
  );
}
