import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  strokeColor?: string;
}

/**
 * Circular progress ring using the rotating-halves technique.
 *
 * Implemented with react-native-reanimated + View (no react-native-svg),
 * which avoids a crash caused by the native SVG module being evaluated at
 * module-init time before the native bridge is ready.
 *
 * How it works:
 *  - A right-half clipping container (overflow: hidden) reveals 0-50%.
 *  - A left-half clipping container reveals 50-100%.
 *  - Each contains a full-size filled circle that rotates from -180° → 0°.
 *  - A centre hole (bg-background) on top creates the ring appearance.
 */
export function CircularProgress({
  progress,
  size = 24,
  strokeWidth = 2.5,
  trackColor = "rgba(153, 159, 243, 0.15)",
  strokeColor = "#999ff3",
}: CircularProgressProps) {
  const progressValue = useSharedValue(0);
  const prevProgress = useRef(progress);

  useEffect(() => {
    if (prevProgress.current === progress) return;
    prevProgress.current = progress;
    progressValue.value = withTiming(progress, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const halfSize = size / 2;
  const innerSize = size - strokeWidth * 2;

  // Right half: reveals 0–50% sweeping CW from 12 o'clock to 6 o'clock.
  // The inner circle rotates around the overall centre (its default origin).
  const rightStyle = useAnimatedStyle(() => {
    const p = Math.min(progressValue.value, 50);
    const deg = (p / 50) * 180 - 180;
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  // Left half: reveals 50–100% sweeping CW from 6 o'clock to 12 o'clock.
  const leftStyle = useAnimatedStyle(() => {
    const remaining = Math.max(progressValue.value - 50, 0);
    const deg = (remaining / 50) * 180 - 180;
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  return (
    <View style={{ width: size, height: size }}>
      {/* Track */}
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: halfSize,
          backgroundColor: trackColor,
        }}
      />

      {/* Right-half fill (0–50%): overflow hides the left half of the circle */}
      <View
        style={{
          position: "absolute",
          width: halfSize,
          height: size,
          left: halfSize,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              width: size,
              height: size,
              borderRadius: halfSize,
              backgroundColor: strokeColor,
              left: -halfSize,
            },
            rightStyle,
          ]}
        />
      </View>

      {/* Left-half fill (50–100%): overflow hides the right half of the circle */}
      <View
        style={{
          position: "absolute",
          width: halfSize,
          height: size,
          left: 0,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              width: size,
              height: size,
              borderRadius: halfSize,
              backgroundColor: strokeColor,
              left: 0,
            },
            leftStyle,
          ]}
        />
      </View>

      {/* Centre hole — creates the ring appearance */}
      <View
        className="bg-background"
        style={{
          position: "absolute",
          top: strokeWidth,
          left: strokeWidth,
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
        }}
      />
    </View>
  );
}
