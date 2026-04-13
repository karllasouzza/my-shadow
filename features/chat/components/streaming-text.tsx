/**
 * Streaming Text
 *
 * Texto com scroll auto-para-baixo quando atualiza.
 * Reutilizável em thinking-section e ai-bubble.
 */

import React, { useRef } from "react";
import { ScrollView, Text } from "react-native";

interface StreamingTextProps {
  text: string;
  className?: string;
  selectable?: boolean;
  /** Auto-scroll to bottom when text updates */
  autoScroll?: boolean;
  /** Limit visible lines — uses constrained ScrollView */
  numberOfLines?: number;
}

const LINE_HEIGHT = 20;

export function StreamingText({
  text,
  className = "",
  selectable = true,
  autoScroll = false,
  numberOfLines,
}: StreamingTextProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const prevTextRef = useRef(text);

  // Scroll to bottom when text changes
  React.useEffect(() => {
    if ((autoScroll || numberOfLines) && text !== prevTextRef.current) {
      prevTextRef.current = text;
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [text, autoScroll, numberOfLines]);

  const hasLineLimit = numberOfLines != null;
  const maxHeight = hasLineLimit ? numberOfLines * LINE_HEIGHT : undefined;

  // Constrained ScrollView for line limit or auto-scroll
  if (hasLineLimit || autoScroll) {
    return (
      <ScrollView
        ref={scrollViewRef}
        style={hasLineLimit ? { maxHeight } : undefined}
        className={className}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        onContentSizeChange={() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }}
      >
        <Text className={className} selectable={selectable}>
          {text}
        </Text>
      </ScrollView>
    );
  }

  // Plain text, no scrolling
  return (
    <Text className={className} selectable={selectable}>
      {text}
    </Text>
  );
}
