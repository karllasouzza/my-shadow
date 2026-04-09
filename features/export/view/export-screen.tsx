/**
 * T052: Export Screen
 * T059: UI for markdown export feature with date range selection, artifact filtering,
 * and explicit empty/loading/success/error states
 * Theme: Shadow Jung (dark purple/gold)
 */

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    TextInput,
    View,
} from "react-native";
import { useExportViewModel } from "../view-model/use-export-vm";

export function ExportScreen() {
  const {
    state,
    selectPeriod,
    toggleReflectionId,
    toggleQuestionSetId,
    toggleReviewId,
    generateExport,
    clearError,
    clearExport,
  } = useExportViewModel();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleSelectPeriod = () => {
    if (startDate && endDate) {
      selectPeriod(startDate, endDate);
    }
  };

  const isPeriodSelected = !!state.periodStart && !!state.periodEnd;
  const hasNoSelections =
    state.selectedReflectionIds.length === 0 &&
    state.selectedQuestionSetIds.length === 0 &&
    state.selectedReviewIds.length === 0;

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-6 gap-6">
        {/* Header */}
        <View className="gap-2">
          <Text variant="h2" className="text-accent">
            Exportar Reflexões
          </Text>
          <Text className="text-base text-muted-foreground">
            Gere um arquivo Markdown com suas reflexões e análises
          </Text>
        </View>

        {/* Loading State - T059 */}
        {state.isExporting && (
          <View className="bg-secondary/50 border border-border/30 rounded-lg p-6 gap-3 items-center">
            <ActivityIndicator size="large" color="hsl(277 65% 50%)" />
            <Text variant="h4" className="text-foreground">
              Gerando exportação...
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              Coletando reflexões, questões e análises do período selecionado.
            </Text>
          </View>
        )}

        {/* Error Banner - T059 */}
        {state.error && !state.isExporting && (
          <View className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 gap-2">
            <Text className="text-destructive font-semibold">
              Erro na Exportação
            </Text>
            <Text className="text-sm text-destructive/80">{state.error}</Text>
            <Button
              variant="destructive"
              size="sm"
              onPress={clearError}
              className="self-start"
            >
              <Text className="text-destructive-foreground text-sm font-medium">
                Fechar
              </Text>
            </Button>
          </View>
        )}

        {/* Empty State - T059: When period selected but no content types chosen */}
        {isPeriodSelected &&
          hasNoSelections &&
          !state.isExporting &&
          !state.bundle &&
          !state.error && (
            <View className="bg-secondary/50 border border-border/30 rounded-lg p-6 gap-3 items-center">
              <Text variant="h4" className="text-muted-foreground">
                Nenhum conteúdo selecionado
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                Selecione reflexões, questões ou análises para incluir na
                exportação.
              </Text>
            </View>
          )}

        {/* Successful Export Display - T059 */}
        {state.bundle && !state.isExporting && (
          <View className="bg-success/10 border border-success/30 rounded-lg p-4 gap-3">
            <Text variant="h3" className="text-success">
              ✓ Exportação Concluída
            </Text>
            <View className="gap-2">
              <View className="gap-1">
                <Text className="text-sm text-muted-foreground">Arquivo:</Text>
                <Text className="font-mono text-sm text-foreground">
                  {state.bundle.fileName}
                </Text>
              </View>
              <View className="gap-1">
                <Text className="text-sm text-muted-foreground">Tamanho:</Text>
                <Text className="text-sm text-foreground">
                  {(state.bundle.getFileSize() / 1024).toFixed(2)} KB
                </Text>
              </View>
              <View className="gap-1">
                <Text className="text-sm text-muted-foreground">Seções:</Text>
                <Text className="text-sm text-foreground">
                  {state.bundle.getSectionCount()} seções
                </Text>
              </View>
            </View>
            <Button onPress={clearExport} variant="default" className="mt-3">
              <Text className="text-primary-foreground text-center font-medium">
                Nova Exportação
              </Text>
            </Button>
          </View>
        )}

        {/* Period Selection */}
        <View className="gap-4">
          <Text variant="h4" className="text-foreground">
            Período
          </Text>

          <View className="gap-3">
            <View>
              <Text className="text-sm font-medium text-muted-foreground mb-2">
                Data de Início
              </Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="hsl(240 5% 50%)"
                className="bg-secondary border border-border rounded-lg p-3 text-foreground"
                selectionColor="hsl(277 65% 50%)"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-muted-foreground mb-2">
                Data de Fim
              </Text>
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="hsl(240 5% 50%)"
                className="bg-secondary border border-border rounded-lg p-3 text-foreground"
                selectionColor="hsl(277 65% 50%)"
              />
            </View>

            <Button
              onPress={handleSelectPeriod}
              disabled={!startDate || !endDate}
              className="w-full"
            >
              <Text className="text-primary-foreground font-semibold">
                Confirmar Período
              </Text>
            </Button>
          </View>
        </View>

        {/* Artifact Selection */}
        {isPeriodSelected && (
          <View className="gap-4">
            <Text variant="h4" className="text-foreground">
              O Que Incluir
            </Text>

            <View className="gap-3">
              <Pressable
                onPress={() => toggleReflectionId("sample-1")}
                className={`flex-row items-center gap-3 p-3 rounded-lg border ${
                  state.selectedReflectionIds.includes("sample-1")
                    ? "bg-primary/10 border-primary/30"
                    : "border-border"
                }`}
              >
                <View
                  className={`w-6 h-6 rounded border-2 items-center justify-center ${
                    state.selectedReflectionIds.includes("sample-1")
                      ? "bg-primary border-primary"
                      : "border-muted-foreground"
                  }`}
                >
                  {state.selectedReflectionIds.includes("sample-1") && (
                    <Text className="text-primary-foreground text-sm font-bold">
                      ✓
                    </Text>
                  )}
                </View>
                <Text className="flex-1 text-base text-foreground">
                  Reflexões
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {state.selectedReflectionIds.length}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => toggleQuestionSetId("sample-1")}
                className={`flex-row items-center gap-3 p-3 rounded-lg border ${
                  state.selectedQuestionSetIds.includes("sample-1")
                    ? "bg-primary/10 border-primary/30"
                    : "border-border"
                }`}
              >
                <View
                  className={`w-6 h-6 rounded border-2 items-center justify-center ${
                    state.selectedQuestionSetIds.includes("sample-1")
                      ? "bg-primary border-primary"
                      : "border-muted-foreground"
                  }`}
                >
                  {state.selectedQuestionSetIds.includes("sample-1") && (
                    <Text className="text-primary-foreground text-sm font-bold">
                      ✓
                    </Text>
                  )}
                </View>
                <Text className="flex-1 text-base text-foreground">
                  Conjuntos de Questões
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {state.selectedQuestionSetIds.length}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => toggleReviewId("sample-1")}
                className={`flex-row items-center gap-3 p-3 rounded-lg border ${
                  state.selectedReviewIds.includes("sample-1")
                    ? "bg-primary/10 border-primary/30"
                    : "border-border"
                }`}
              >
                <View
                  className={`w-6 h-6 rounded border-2 items-center justify-center ${
                    state.selectedReviewIds.includes("sample-1")
                      ? "bg-primary border-primary"
                      : "border-muted-foreground"
                  }`}
                >
                  {state.selectedReviewIds.includes("sample-1") && (
                    <Text className="text-primary-foreground text-sm font-bold">
                      ✓
                    </Text>
                  )}
                </View>
                <Text className="flex-1 text-base text-foreground">
                  Análises Periódicas
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {state.selectedReviewIds.length}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Generate Button - T059: Disabled when loading */}
        {isPeriodSelected && !state.bundle && (
          <Button
            onPress={generateExport}
            disabled={state.isExporting}
            variant="secondary"
            className="w-full py-4"
          >
            <Text className="text-accent-foreground text-lg font-semibold">
              {state.isExporting ? "Gerando..." : "Gerar Exportação"}
            </Text>
          </Button>
        )}
      </View>
    </ScrollView>
  );
}
