/**
 * T052: Export Screen
 * UI for markdown export feature with date range selection and artifact filtering
 */

import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "../../../components/ui/text";
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

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-6 gap-6">
        {/* Header */}
        <View className="gap-2">
          <Text className="text-2xl font-bold text-gray-900">
            Exportar Reflexões
          </Text>
          <Text className="text-base text-gray-600">
            Gere um arquivo Markdown com suas reflexões e análises
          </Text>
        </View>

        {/* Error Banner */}
        {state.error && (
          <View className="bg-red-100 border border-red-300 rounded-lg p-4 gap-2">
            <Text className="text-base font-semibold text-red-900">
              Erro na Exportação
            </Text>
            <Text className="text-sm text-red-800">{state.error}</Text>
            <Pressable
              onPress={clearError}
              className="self-start mt-2 px-4 py-2 bg-red-500 rounded-lg"
            >
              <Text className="text-white text-sm font-medium">Fechar</Text>
            </Pressable>
          </View>
        )}

        {/* Successful Export Display */}
        {state.bundle && !state.isExporting && (
          <View className="bg-green-100 border border-green-300 rounded-lg p-4 gap-3">
            <Text className="text-lg font-bold text-green-900">
              ✓ Exportação Concluída
            </Text>
            <View className="gap-2">
              <View className="gap-1">
                <Text className="text-sm text-gray-700">Arquivo:</Text>
                <Text className="font-mono text-sm text-gray-900">
                  {state.bundle.fileName}
                </Text>
              </View>
              <View className="gap-1">
                <Text className="text-sm text-gray-700">Tamanho:</Text>
                <Text className="text-sm text-gray-900">
                  {(state.bundle.getFileSize() / 1024).toFixed(2)} KB
                </Text>
              </View>
              <View className="gap-1">
                <Text className="text-sm text-gray-700">Seções:</Text>
                <Text className="text-sm text-gray-900">
                  {state.bundle.getSectionCount()} seções
                </Text>
              </View>
            </View>
            <Pressable
              onPress={clearExport}
              className="mt-3 px-4 py-3 bg-green-600 rounded-lg"
            >
              <Text className="text-white text-center font-medium">
                Nova Exportação
              </Text>
            </Pressable>
          </View>
        )}

        {/* Period Selection */}
        <View className="gap-4">
          <Text className="text-lg font-semibold text-gray-900">Período</Text>

          <View className="gap-3">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Data de Início
              </Text>
              <View className="border border-gray-300 rounded-lg p-3">
                <Text
                  className="text-base text-gray-900"
                  onPress={() => setStartDate("2026-03-01")}
                >
                  {startDate || "Selecionar data"}
                </Text>
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Data de Fim
              </Text>
              <View className="border border-gray-300 rounded-lg p-3">
                <Text
                  className="text-base text-gray-900"
                  onPress={() => setEndDate("2026-03-31")}
                >
                  {endDate || "Selecionar data"}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleSelectPeriod}
              className={`py-3 px-4 rounded-lg ${
                startDate && endDate ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  startDate && endDate ? "text-white" : "text-gray-600"
                }`}
              >
                Confirmar Período
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Artifact Selection */}
        {isPeriodSelected && (
          <View className="gap-4">
            <Text className="text-lg font-semibold text-gray-900">
              O Que Incluir
            </Text>

            <View className="gap-3">
              <Pressable
                onPress={() => toggleReflectionId("sample-1")}
                className={`flex-row items-center gap-3 p-3 rounded-lg border ${
                  state.selectedReflectionIds.includes("sample-1")
                    ? "bg-blue-50 border-blue-300"
                    : "border-gray-300"
                }`}
              >
                <View
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                    state.selectedReflectionIds.includes("sample-1")
                      ? "bg-blue-600 border-blue-600"
                      : "border-gray-400"
                  }`}
                >
                  {state.selectedReflectionIds.includes("sample-1") && (
                    <Text className="text-white text-sm font-bold">✓</Text>
                  )}
                </View>
                <Text className="flex-1 text-base text-gray-900">
                  Reflexões
                </Text>
                <Text className="text-sm text-gray-600">
                  {state.selectedReflectionIds.length}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => toggleQuestionSetId("sample-1")}
                className={`flex-row items-center gap-3 p-3 rounded-lg border ${
                  state.selectedQuestionSetIds.includes("sample-1")
                    ? "bg-blue-50 border-blue-300"
                    : "border-gray-300"
                }`}
              >
                <View
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                    state.selectedQuestionSetIds.includes("sample-1")
                      ? "bg-blue-600 border-blue-600"
                      : "border-gray-400"
                  }`}
                >
                  {state.selectedQuestionSetIds.includes("sample-1") && (
                    <Text className="text-white text-sm font-bold">✓</Text>
                  )}
                </View>
                <Text className="flex-1 text-base text-gray-900">
                  Conjuntos de Questões
                </Text>
                <Text className="text-sm text-gray-600">
                  {state.selectedQuestionSetIds.length}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => toggleReviewId("sample-1")}
                className={`flex-row items-center gap-3 p-3 rounded-lg border ${
                  state.selectedReviewIds.includes("sample-1")
                    ? "bg-blue-50 border-blue-300"
                    : "border-gray-300"
                }`}
              >
                <View
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                    state.selectedReviewIds.includes("sample-1")
                      ? "bg-blue-600 border-blue-600"
                      : "border-gray-400"
                  }`}
                >
                  {state.selectedReviewIds.includes("sample-1") && (
                    <Text className="text-white text-sm font-bold">✓</Text>
                  )}
                </View>
                <Text className="flex-1 text-base text-gray-900">
                  Análises Periódicas
                </Text>
                <Text className="text-sm text-gray-600">
                  {state.selectedReviewIds.length}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Generate Button */}
        {isPeriodSelected && !state.bundle && (
          <Pressable
            onPress={generateExport}
            disabled={state.isExporting}
            className={`py-3 px-6 rounded-lg flex items-center justify-center ${
              state.isExporting ? "bg-gray-400" : "bg-green-600"
            }`}
          >
            {state.isExporting ? (
              <View className="flex-row items-center gap-2">
                <Text className="text-white font-semibold">Gerando...</Text>
              </View>
            ) : (
              <Text className="text-white text-lg font-semibold">
                Gerar Exportação
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}
