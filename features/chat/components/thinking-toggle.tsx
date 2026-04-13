import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import React from "react";

interface ThinkingToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function ThinkingToggle({ enabled, onToggle }: ThinkingToggleProps) {
  return (
    <Button
      variant={"outline"}
      size="sm"
      onPress={onToggle}
      className={enabled ? "border-primary" : "border-border"}
      accessibilityRole="button"
      accessibilityLabel="Alterne entre o processo de raciocínio da IA"
    >
      <Icon
        as={require("lucide-react-native").Brain}
        className={cn(
          "size-4",
          enabled ? "text-primary-foreground" : "text-muted-foreground",
        )}
      />
    </Button>
  );
}
