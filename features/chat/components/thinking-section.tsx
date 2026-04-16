import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { observer } from "@legendapp/state/react";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  ScrollView,
  Text,
  UIManager,
  View,
} from "react-native";

interface ThinkingSectionProps {
  reasoning_content: string;
  isStreaming?: boolean;
}

// Habilita LayoutAnimation no Android
if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export const ThinkingSection = observer(function ThinkingSection({
  reasoning_content,
  isStreaming = false,
}: ThinkingSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  if (!reasoning_content && !isStreaming) return null;

  // Animação do ícone
  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [expanded]);

  // Quando fecha: scroll para o final (conteúdo mais recente)
  useEffect(() => {
    if (!expanded && scrollViewRef.current && reasoning_content) {
      scrollViewRef.current.scrollToEnd({ animated: false });
    }
  }, [expanded, reasoning_content]);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(200, "easeInEaseOut", "opacity"),
    );
    setExpanded((prev) => !prev);
  }, []);

  const displayText = reasoning_content || (isStreaming ? "Pensando…" : "");
  const isPlaceholder = isStreaming && !reasoning_content;

  return (
    <View className="w-full max-w-[93%] pb-2 border border-border rounded-2xl bg-background overflow-hidden">
      {/* Header */}
      <Button
        onPress={toggleExpanded}
        className="flex-row justify-between items-center gap-2 p-3 !bg-background"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={expanded ? "Fechar pensamentos" : "Ver pensamentos"}
        accessibilityRole="button"
        variant="ghost"
      >
        <Text
          className={cn(
            "text-foreground/55 text-xs font-semibold uppercase tracking-wide",
            isPlaceholder && "animate-pulse",
          )}
        >
          {isPlaceholder
            ? "Pensando…"
            : expanded
              ? "Esconder pensamentos"
              : "Ver pensamentos"}
        </Text>

        <Icon
          as={expanded ? ChevronUp : ChevronDown}
          className="size-3 text-foreground/80"
        />
      </Button>

      {/* Content */}
      {expanded ? (
        <View className="px-3 max-h-96">
          <Text
            className="text-muted-foreground/55 text-sm leading-5"
            selectable
          >
            {displayText}
          </Text>
        </View>
      ) : (
        <View className="px-3 h-20 overflow-hidden">
          <ScrollView
            ref={scrollViewRef}
            className="flex-1"
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          >
            <Text
              className="text-muted-foreground/55 text-sm leading-5"
              selectable={false}
            >
              {displayText}
            </Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
});
