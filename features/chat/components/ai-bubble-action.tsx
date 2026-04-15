import React from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { RotateCcw } from "lucide-react-native";

type ActionProps = { onRetry?: () => void };
export function AIBubbleAction({ onRetry }: ActionProps) {
  if (!onRetry) return null;
  return (
    <Button variant="ghost" size="sm" onPress={onRetry} className="h-6 px-2">
      <Icon as={RotateCcw} className="size-3 text-muted-foreground" />
    </Button>
  );
}
