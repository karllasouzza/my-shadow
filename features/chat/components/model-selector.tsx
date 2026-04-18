import {
  AppModal,
  AppModalContent,
  AppModalHandle,
  AppModalHeader,
} from "@/components/molecules/app-modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { AvailableModel } from "@/shared/ai/types/model-loader";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Keyboard, Pressable, ScrollView, View } from "react-native";

interface ModelSelectorProps {
  models: AvailableModel[];
  selectedModelId: string | null;
  isLoading: boolean;
  error: string | null;
  onSelect: (modelId: string) => void;
}

export function ModelSelector({
  models,
  selectedModelId,
  isLoading,
  error,
  onSelect,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const isKeyboardVisibleRef = useRef(false);
  const pendingOpenRef = useRef(false);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId),
    [models, selectedModelId],
  );

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      isKeyboardVisibleRef.current = true;
    });

    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      isKeyboardVisibleRef.current = false;

      if (pendingOpenRef.current) {
        pendingOpenRef.current = false;
        setOpen(true);
      }
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleOpen = useCallback(() => {
    if (isKeyboardVisibleRef.current) {
      pendingOpenRef.current = true;
      Keyboard.dismiss();
      return;
    }

    setOpen(true);
  }, []);

  const displayText = selectedModel?.displayName ?? "Selecionar modelo";

  const handleSelect = useCallback(
    (modelId: string) => {
      setOpen(false);
      onSelect(modelId);
    },
    [onSelect],
  );

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    pendingOpenRef.current = false;
    setOpen(nextOpen);
  }, []);

  if (models.length === 0) return null;

  return (
    <>
      <Button
        onPress={handleOpen}
        disabled={isLoading}
        className="!bg-transparent"
        variant="outline"
        accessibilityRole="button"
        accessibilityLabel="Selecionar modelo"
        id="mode-selector"
      >
        <Text className="text-foreground text-sm font-medium" numberOfLines={1}>
          {isLoading ? "Carregando modelo" : displayText}
        </Text>
        {selectedModel && !isLoading && (
          <Text
            className="text-muted-foreground text-xs ml-1"
            numberOfLines={1}
          >
            ({selectedModel.bytes})
          </Text>
        )}
        <Icon
          as={
            isLoading
              ? require("lucide-react-native").Loader2
              : require("lucide-react-native").ChevronUp
          }
          className={cn(
            "text-muted-foreground size-4",
            isLoading ? "animate-spin" : "animate-none",
          )}
        />
      </Button>

      <AppModal open={open} onOpenChange={handleOpenChange}>
        <AppModalContent>
          <AppModalHandle />
          <AppModalHeader title="Selecionar modelo" />

          <ScrollView className="max-h-80 px-4">
            <View className="gap-2 pb-4">
              {models.map((model) => {
                const isSelected = model.id === selectedModelId;

                return (
                  <Pressable
                    key={model.id}
                    onPress={() => handleSelect(model.id)}
                    className={cn(
                      "flex-row items-center gap-3 rounded-2xl border px-4 py-3",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card",
                    )}
                    accessibilityRole="button"
                    accessibilityLabel={model.displayName}
                  >
                    <View className="flex-1 flex-row gap-2 items-center">
                      <Text
                        className="text-foreground font-medium"
                        numberOfLines={1}
                      >
                        {model.displayName}
                      </Text>
                      <Text
                        className="text-muted-foreground text-xs"
                        numberOfLines={1}
                      >
                        ({model.bytes})
                      </Text>
                    </View>

                    <View></View>

                    {isSelected && (
                      <Icon
                        as={require("lucide-react-native").Check}
                        className="text-primary size-4"
                      />
                    )}
                  </Pressable>
                );
              })}

              {!!error && (
                <Text className="px-1 pt-1 text-sm text-destructive">
                  {error}
                </Text>
              )}
            </View>
          </ScrollView>
        </AppModalContent>
      </AppModal>
    </>
  );
}
