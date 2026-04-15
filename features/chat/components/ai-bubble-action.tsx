import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import React from "react";
import { View } from "react-native";

type ActionProps = { onRetry?: () => void; onCopy?: () => void };
export function AIBubbleAction({ onRetry, onCopy }: ActionProps) {
  if (!onRetry && !onCopy) return null;
  return (
    <View className="w-full flex flex-row gap-2">
      <Button variant="outline" size="icon" onPress={onRetry}>
        <Icon
          as={require("lucide-react-native").RotateCcw}
          className="size-4 text-muted-foreground"
        />
      </Button>
      <Button variant="outline" size="icon" onPress={onCopy}>
        <Icon
          as={require("lucide-react-native").Copy}
          className="size-4 text-muted-foreground"
        />
      </Button>
    </View>
  );
}
