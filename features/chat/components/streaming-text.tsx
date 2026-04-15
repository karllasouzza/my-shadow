/**
 * Streaming Text
 *
 * Simple, robust typing-like renderer that gradually reveals appended
 * characters. Removes the ScrollView-based auto-scroll logic which caused
 * bugs. When `numberOfLines` is provided the container is bottom-anchored
 * (new lines push the content upward) by constraining the height and
 * aligning content to the bottom — no ScrollView required.
 */

import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

interface StreamingTextProps {
  text: string;
  className?: string;
  selectable?: boolean;
  /** kept for API compatibility (no-op here) */
  autoScroll?: boolean;
  /** Limit visible lines — uses constrained container with bottom alignment */
  numberOfLines?: number;
  /** Typing speed in ms per character */
  typingSpeed?: number;
}

const LINE_HEIGHT = 20;

export function StreamingText({
  text,
  className = "",
  selectable = true,
  numberOfLines,
  typingSpeed = 20,
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState(text);
  const displayedRef = useRef(displayedText);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    displayedRef.current = displayedText;
  }, [displayedText]);

  useEffect(() => {
    // clear any running timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (text === displayedRef.current) return;

    // If the new text simply appends to what's already shown, reveal the
    // suffix character-by-character to simulate typing. Otherwise replace
    // immediately.
    if (text.startsWith(displayedRef.current)) {
      const suffix = text.slice(displayedRef.current.length);
      let i = 0;
      timerRef.current = setInterval(() => {
        i += 1;
        setDisplayedText((prev) => {
          const next = prev + suffix[i - 1];
          displayedRef.current = next;
          return next;
        });
        if (i >= suffix.length && timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }, typingSpeed);
    } else {
      setDisplayedText(text);
      displayedRef.current = text;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [text, typingSpeed]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const hasLineLimit = numberOfLines != null;
  const maxHeight = hasLineLimit ? numberOfLines * LINE_HEIGHT : undefined;
  const containerStyle = hasLineLimit
    ? ({ maxHeight, overflow: "hidden", justifyContent: "flex-end" } as any)
    : undefined;

  if (hasLineLimit) {
    return (
      <View style={containerStyle}>
        <Text className={className} selectable={selectable}>
          {displayedText}
        </Text>
      </View>
    );
  }

  return (
    <Text className={className} selectable={selectable}>
      {displayedText}
    </Text>
  );
}
