/**
 * VoiceInputButton component
 *
 * Renders a microphone button with long-press, tap, and swipe-left gesture support.
 * Delegates all logic to the useVoiceInput hook via props.
 *
 * Requirements: 1.4, 1.5, 2.1, 3.1, 6.1, 10.3, 11.1
 */

import { Icon } from "@/components/ui/icon";
import type { VoiceInputStatus } from "@/features/chat/view-model/hooks/useVoiceInput";
import { Mic } from "lucide-react-native";
import { useRef } from "react";
import { PanResponder, Pressable, View } from "react-native";

// ---------------------------------------------------------------------------
// Accessibility labels (Brazilian Portuguese)
// ---------------------------------------------------------------------------

const ACCESSIBILITY_LABELS: Record<VoiceInputStatus, string> = {
  idle: "Gravar mensagem de voz",
  recording: "Parar gravação",
  processing: "Processando gravação",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VoiceInputButtonProps {
  status: VoiceInputStatus;
  isCancelPreview: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  onTap: () => void;
  onSwipeUpdate: (dx: number) => void;
  onSwipeEnd: (dx: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceInputButton({
  status,
  isCancelPreview,
  onPressIn,
  onPressOut,
  onTap,
  onSwipeUpdate,
  onSwipeEnd,
}: VoiceInputButtonProps) {
  const isDisabled = status === "processing";
  const isRecording = status === "recording";

  // Track whether a swipe gesture is in progress to suppress the tap handler
  const isSwipingRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Capture horizontal swipes (dx dominates dy)
        return (
          Math.abs(gestureState.dx) > 5 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderGrant: () => {
        isSwipingRef.current = true;
      },
      onPanResponderMove: (_evt, gestureState) => {
        onSwipeUpdate(gestureState.dx);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        isSwipingRef.current = false;
        onSwipeEnd(gestureState.dx);
      },
      onPanResponderTerminate: (_evt, gestureState) => {
        isSwipingRef.current = false;
        onSwipeEnd(gestureState.dx);
      },
    }),
  ).current;

  const handlePress = () => {
    if (!isSwipingRef.current) {
      onTap();
    }
  };

  return (
    <View {...panResponder.panHandlers}>
      <Pressable
        onPress={handlePress}
        onLongPress={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={ACCESSIBILITY_LABELS[status]}
        style={{
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
        className={[
          "rounded-full items-center justify-center",
          isRecording ? "bg-primary" : "bg-transparent",
          isDisabled ? "opacity-50" : "opacity-100",
          isCancelPreview ? "opacity-50" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Icon
          as={Mic}
          size={22}
          className={
            isRecording ? "text-primary-foreground" : "text-foreground"
          }
        />
      </Pressable>
    </View>
  );
}
