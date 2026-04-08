/**
 * T041: Period review screen UI
 *
 * Displays period selection, review generation status, and synthesized results
 */

import React from "react";
import {
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
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
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1">
        {/* Error Display */}
        {state.error && (
          <View className="bg-red-50 border-l-4 border-red-500 p-4 m-4">
            <Text className="text-red-800 font-semibold">
              {state.error.code}
            </Text>
            <Text className="text-red-700 text-sm mt-1">
              {state.error.message}
            </Text>
            <TouchableOpacity
              onPress={actions.clearError}
              className="mt-2 bg-red-200 px-3 py-1 rounded"
            >
              <Text className="text-red-800 text-xs">Descartar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Period Selection Section */}
        <View className="p-4 bg-blue-50 border-b border-blue-200">
          <Text className="text-lg font-bold text-blue-900 mb-3">
            Análise de Período
          </Text>

          <Text className="text-sm text-gray-600 mb-2">Data Inicial</Text>
          <TextInput
            value={periodStartInput}
            onChangeText={setPeriodStartInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
            className="bg-white border border-blue-300 rounded-lg p-2 mb-3 text-gray-700"
          />

          <Text className="text-sm text-gray-600 mb-2">Data Final</Text>
          <TextInput
            value={periodEndInput}
            onChangeText={setPeriodEndInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
            className="bg-white border border-blue-300 rounded-lg p-2 mb-3 text-gray-700"
          />

          <TouchableOpacity
            onPress={handleSelectPeriod}
            disabled={state.isLoading}
            className={`rounded-lg p-3 ${
              state.isLoading ? "bg-gray-300" : "bg-blue-500"
            }`}
          >
            <Text className="text-white font-bold text-center">
              Selecionar Período
            </Text>
          </TouchableOpacity>
        </View>

        {/* Review Generation Section */}
        {state.periodStart && (
          <View className="p-4 bg-purple-50 border-b border-purple-200">
            <Text className="text-lg font-bold text-purple-900 mb-3">
              Período Selecionado
            </Text>
            <Text className="text-gray-700 mb-3">
              De {state.periodStart} a {state.periodEnd}
            </Text>

            <TouchableOpacity
              onPress={handleGenerateReview}
              disabled={state.isGenerating}
              className={`rounded-lg p-3 ${
                state.isGenerating ? "bg-gray-300" : "bg-purple-500"
              }`}
            >
              <Text className="text-white font-bold text-center">
                {state.isGenerating ? "Gerando..." : "Gerar Análise"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Review Display */}
        {state.review && (
          <View className="p-4">
            <Text className="text-xl font-bold text-gray-800 mb-4">
              Análise do Período
            </Text>

            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">
                Síntese
              </Text>
              <Text className="text-gray-700 leading-6">
                {state.review.summary}
              </Text>
            </View>

            {state.review.patterns.length > 0 && (
              <View className="mb-6">
                <Text className="text-sm font-semibold text-gray-600 mb-2">
                  Padrões Recorrentes
                </Text>
                {state.review.patterns.map((pattern, idx) => (
                  <Text key={idx} className="text-gray-700 mb-1">
                    • {pattern}
                  </Text>
                ))}
              </View>
            )}

            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">
                Gatilhos Emocionais
              </Text>
              {state.review.triggers.map((trigger, idx) => (
                <Text key={idx} className="text-gray-700 mb-1">
                  • {trigger}
                </Text>
              ))}
            </View>

            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">
                Próximas Investigações
              </Text>
              {state.review.prompts.map((prompt, idx) => (
                <Text key={idx} className="text-gray-700 mb-2">
                  {idx + 1}. {prompt}
                </Text>
              ))}
            </View>

            <TouchableOpacity
              onPress={actions.clearReview}
              className="bg-gray-200 rounded-lg p-3 mt-4"
            >
              <Text className="text-gray-800 font-semibold text-center">
                Nova Análise
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
