/**
 * T041: Period review screen UI
 *
 * Displays period selection, review generation status, and synthesized results
 * Theme: Shadow Jung (dark purple/gold)
 */

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import React from "react";
import { ScrollView, TextInput, View } from "react-native";
import { usePeriodReviewViewModel } from "../view-model/use-period-review-vm";

export const PeriodReviewScreen: React.FC = () => {
  const { state, actions } = usePeriodReviewViewModel();
  const [periodStartInput, setPeriodStartInput] = React.useState("");
  const [periodEndInput, setPeriodEndInput] = React.useState("");

  const handleSelectPeriod = async () => {
    if (periodStartInput && periodEndInput) {
      await actions.selectPeriod(periodStartInput, periodEndInput);
    }
  };

  const handleGenerateReview = async () => {
    await actions.generateReview();
  };

  return (
    <ScrollView className="flex-1 bg-background">
      {/* Error Display */}
      {state.error && (
        <View className="mx-4 mt-4 mb-2 p-4 bg-destructive/10 border-l-4 border-destructive rounded-r-lg">
          <Text className="text-destructive font-semibold">
            {state.error.code}
          </Text>
          <Text className="text-destructive/80 text-sm mt-1">
            {state.error.message}
          </Text>
          <Button
            variant="destructive"
            size="sm"
            onPress={actions.clearError}
            className="mt-3 self-start"
          >
            <Text className="text-destructive-foreground text-sm">
              Descartar
            </Text>
          </Button>
        </View>
      )}

      {/* Period Selection Section */}
      <View className="p-4 bg-card border-b border-border">
        <Text variant="h3" className="text-accent mb-3">
          Análise de Período
        </Text>

        <Text className="text-muted-foreground text-sm mb-2">Data Inicial</Text>
        <TextInput
          value={periodStartInput}
          onChangeText={setPeriodStartInput}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="hsl(240 5% 50%)"
          className="bg-secondary border border-border rounded-lg p-3 mb-3 text-foreground"
          selectionColor="hsl(277 65% 50%)"
        />

        <Text className="text-muted-foreground text-sm mb-2">Data Final</Text>
        <TextInput
          value={periodEndInput}
          onChangeText={setPeriodEndInput}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="hsl(240 5% 50%)"
          className="bg-secondary border border-border rounded-lg p-3 mb-3 text-foreground"
          selectionColor="hsl(277 65% 50%)"
        />

        <Button
          onPress={handleSelectPeriod}
          disabled={state.isLoading}
          className="w-full"
        >
          <Text className="text-primary-foreground font-semibold">
            {state.isLoading ? "Carregando..." : "Selecionar Período"}
          </Text>
        </Button>
      </View>

      {/* Review Generation Section */}
      {state.periodStart && (
        <View className="p-4 bg-card border-b border-border">
          <Text variant="h3" className="text-accent mb-3">
            Período Selecionado
          </Text>
          <Text className="text-foreground/80 mb-3">
            De {state.periodStart} a {state.periodEnd}
          </Text>
          <Text className="text-muted-foreground text-sm mb-3">
            {state.reflectionCount} reflexões encontradas
          </Text>

          <Button
            onPress={handleGenerateReview}
            disabled={state.isGenerating}
            variant="secondary"
            className="w-full"
          >
            <Text className="text-accent-foreground font-semibold">
              {state.isGenerating ? "Gerando..." : "Gerar Análise"}
            </Text>
          </Button>
        </View>
      )}

      {/* Review Display */}
      {state.review && (
        <View className="p-4">
          <Text variant="h2" className="text-accent mb-4">
            Análise do Período
          </Text>

          <View className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground mb-2">
              Síntese
            </Text>
            <Text className="text-foreground/90 leading-6">
              {state.review.summary}
            </Text>
          </View>

          {state.review.patterns.length > 0 && (
            <View className="mb-6">
              <Text className="text-sm font-semibold text-muted-foreground mb-2">
                Padrões Recorrentes
              </Text>
              {state.review.patterns.map((pattern, idx) => (
                <Text key={idx} className="text-foreground/80 mb-1">
                  • {pattern}
                </Text>
              ))}
            </View>
          )}

          <View className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground mb-2">
              Gatilhos Emocionais
            </Text>
            {state.review.triggers.map((trigger, idx) => (
              <Text key={idx} className="text-foreground/80 mb-1">
                • {trigger}
              </Text>
            ))}
          </View>

          <View className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground mb-2">
              Próximas Investigações
            </Text>
            {state.review.prompts.map((prompt, idx) => (
              <Text key={idx} className="text-foreground/80 mb-2">
                {idx + 1}. {prompt}
              </Text>
            ))}
          </View>

          <Button
            onPress={actions.clearReview}
            variant="outline"
            className="mt-2"
          >
            <Text className="text-foreground font-semibold">Nova Análise</Text>
          </Button>
        </View>
      )}
    </ScrollView>
  );
};
