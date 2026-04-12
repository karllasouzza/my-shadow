import {
  AppModal,
  AppModalContent,
  AppModalHandle,
  AppModalHeader,
} from "@/components/molecules/app-modal";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { AvailableModel } from "@/shared/ai/types/model-loader";
import { Check, ChevronUp, Cpu } from "lucide-react-native";
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

  if (isLoading) {
    return (
      <View className="flex-row items-center justify-center px-3">
        <Icon
          as={require("lucide-react-native").Loader2}
          className="text-muted-foreground animate-spin"
        />
      </View>
    );
  }

  if (models.length === 0) return null;

  return (
    <>
      <Pressable
        onPress={handleOpen}
        className="flex-row items-center gap-1 px-2 py-1"
        accessibilityRole="button"
        accessibilityLabel="Selecionar modelo"
      >
        <Text className="text-foreground text-sm font-medium" numberOfLines={1}>
          {displayText}
        </Text>
        <Icon as={ChevronUp} className="text-muted-foreground size-4" />
      </Pressable>

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
                    className={[
                      "flex-row items-center gap-3 rounded-2xl border px-4 py-3",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card",
                    ].join(" ")}
                    accessibilityRole="button"
                    accessibilityLabel={model.displayName}
                  >
                    <View className="size-8 items-center justify-center rounded-full bg-muted">
                      <Icon
                        as={Cpu}
                        className={
                          isSelected
                            ? "text-primary size-4"
                            : "text-muted-foreground size-4"
                        }
                      />
                    </View>

                    <View className="flex-1">
                      <Text
                        className="text-foreground font-medium"
                        numberOfLines={1}
                      >
                        {model.displayName}
                      </Text>
                      {model.isLoaded && (
                        <Text className="text-xs text-muted-foreground">
                          Modelo carregado
                        </Text>
                      )}
                    </View>

                    {isSelected && (
                      <Icon as={Check} className="text-primary size-4" />
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
