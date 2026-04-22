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
  selectedWhisperModelId: string | null;
  isLoading: boolean;
  error: string | null;
  onSelectLlm: (modelId: string) => void;
  onSelectWhisper: (modelId: string) => void;
}

export function ModelSelector({
  models,
  selectedModelId,
  selectedWhisperModelId,
  isLoading,
  error,
  onSelectLlm,
  onSelectWhisper,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const isKeyboardVisibleRef = useRef(false);
  const pendingOpenRef = useRef(false);

  const llmModels = useMemo(
    () => models.filter((m) => m.modelType === "gguf"),
    [models],
  );
  const whisperModels = useMemo(
    () => models.filter((m) => m.modelType === "bin"),
    [models],
  );

  const selectedLlm = useMemo(
    () => llmModels.find((m) => m.id === selectedModelId),
    [llmModels, selectedModelId],
  );
  const selectedWhisper = useMemo(
    () => whisperModels.find((m) => m.id === selectedWhisperModelId),
    [whisperModels, selectedWhisperModelId],
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

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    pendingOpenRef.current = false;
    setOpen(nextOpen);
  }, []);

  const displayText = selectedLlm?.displayName ?? "Selecionar modelo";

  if (models.length === 0) return null;

  return (
    <>
      <Button
        onPress={handleOpen}
        disabled={isLoading}
        className="!bg-transparent max-w-48 truncate"
        variant="outline"
        accessibilityRole="button"
        accessibilityLabel="Selecionar modelo"
        id="mode-selector"
      >
        <Text className="font-medium text-foreground text-sm" numberOfLines={1}>
          {isLoading ? "Carregando modelo" : displayText}
        </Text>
        {selectedLlm && !isLoading && (
          <Text
            className="ml-1 text-muted-foreground text-xs"
            numberOfLines={1}
          >
            ({selectedLlm.bytes})
          </Text>
        )}
        {selectedWhisper && !isLoading && (
          <Text
            className="ml-1 text-muted-foreground text-xs"
            numberOfLines={1}
          >
            · {selectedWhisper.displayName}
          </Text>
        )}
        <Icon
          as={
            isLoading
              ? require("lucide-react-native").Loader2
              : require("lucide-react-native").ChevronUp
          }
          className={cn(
            "size-4 text-muted-foreground",
            isLoading ? "animate-spin" : "animate-none",
          )}
        />
      </Button>

      <AppModal open={open} onOpenChange={handleOpenChange}>
        <AppModalContent>
          <AppModalHandle />
          <AppModalHeader title="Selecionar modelos" />

          <ScrollView className="px-4 max-h-[70vh]">
            <View className="gap-2 pb-4">
              {/* LLM section */}
              {llmModels.length > 0 && (
                <>
                  <Text className="px-1 pt-2 pb-1 text-muted-foreground text-xs uppercase tracking-wide">
                    Modelo de Linguagem
                  </Text>
                  {llmModels.map((model) => {
                    const isSelected = model.id === selectedModelId;
                    return (
                      <Pressable
                        key={model.id}
                        onPress={() => {
                          onSelectLlm(model.id);
                        }}
                        className={cn(
                          "flex-row items-center gap-3 px-4 py-3 border rounded-2xl",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card",
                        )}
                        accessibilityRole="button"
                        accessibilityLabel={model.displayName}
                      >
                        <View className="flex-row flex-1 items-center gap-2">
                          <Text
                            className="font-medium text-foreground"
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
                        {isSelected && (
                          <Icon
                            as={require("lucide-react-native").Check}
                            className="size-4 text-primary"
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </>
              )}

              {/* Whisper section */}
              {whisperModels.length > 0 && (
                <>
                  <Text className="px-1 pt-4 pb-1 text-muted-foreground text-xs uppercase tracking-wide">
                    Modelo de Voz (Whisper)
                  </Text>
                  {whisperModels.map((model) => {
                    const isSelected = model.id === selectedWhisperModelId;
                    return (
                      <Pressable
                        key={model.id}
                        onPress={() => {
                          onSelectWhisper(model.id);
                        }}
                        className={cn(
                          "flex-row items-center gap-3 px-4 py-3 border rounded-2xl",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card",
                        )}
                        accessibilityRole="button"
                        accessibilityLabel={model.displayName}
                      >
                        <View className="flex-row flex-1 items-center gap-2">
                          <Icon
                            as={require("lucide-react-native").Mic}
                            className="size-4 text-muted-foreground"
                          />
                          <Text
                            className="font-medium text-foreground"
                            numberOfLines={1}
                          >
                            {model.displayName}
                          </Text>
                        </View>
                        {isSelected && (
                          <Icon
                            as={require("lucide-react-native").Check}
                            className="size-4 text-primary"
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </>
              )}

              {!!error && (
                <Text className="px-1 pt-1 text-destructive text-sm">
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
