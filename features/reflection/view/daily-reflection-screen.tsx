/**
 * T029: Daily reflection screen UI component
 *
 * Displays reflection list, allows creating new reflections, generating questions,
 * and managing reflection lifecycle.
 */

import React from "react";
import {
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View
} from "react-native";
import { StateView } from "../../../shared/components/state-view";
import { REFLECTION_THEME } from "../../../shared/theme/reflection-theme";
import { useDailyReflectionViewModel } from "../view-model/use-daily-reflection-vm";

export const DailyReflectionScreen: React.FC = () => {
  const { state, actions } = useDailyReflectionViewModel();
  const [newContent, setNewContent] = React.useState("");

  const handleCreateReflection = async () => {
    if (newContent.trim()) {
      await actions.createReflection(newContent);
      setNewContent("");
    }
  };

  const handleGenerateQuestions = async () => {
    if (state.currentReflection) {
      await actions.generateQuestions(state.currentReflection.id);
    }
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
            <Pressable
              onPress={actions.clearError}
              className="mt-2 bg-red-200 px-3 py-1 rounded"
            >
              <Text className="text-red-800 text-xs">Descartar</Text>
            </Pressable>
          </View>
        )}

        {/* Create New Reflection Section */}
        <View className="p-4 bg-blue-50 border-b border-blue-200">
          <Text className="text-lg font-bold text-blue-900 mb-3">
            Nova Reflexão
          </Text>
          <TextInput
            value={newContent}
            onChangeText={setNewContent}
            placeholder="Escreva sua reflexão aqui..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            className="bg-white border border-blue-300 rounded-lg p-3 text-gray-700"
            editable={!state.isSaving}
          />
          <Pressable
            onPress={handleCreateReflection}
            disabled={state.isSaving || !newContent.trim()}
            className={`mt-3 rounded-lg p-3 ${
              state.isSaving || !newContent.trim()
                ? "bg-gray-300"
                : "bg-blue-500"
            }`}
          >
            <Text className="text-white font-bold text-center">
              {state.isSaving ? "Salvando..." : "Salvar Reflexão"}
            </Text>
          </Pressable>
        </View>

        {/* Reflections List */}
        <StateView
          state={
            state.isLoading
              ? "loading"
              : state.reflections.length === 0
                ? "empty"
                : "success"
          }
          className="px-4 py-3"
        >
          <View className="w-full">
            {state.reflections.map((reflection) => (
              <Pressable
                key={reflection.id}
                onPress={() => actions.selectReflection(reflection.id)}
                className={`rounded-lg p-4 mb-3 border-l-4 ${
                  state.currentReflection?.id === reflection.id
                    ? "bg-purple-50 border-purple-400"
                    : "bg-white border-gray-300"
                }`}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <Text className="text-gray-600 text-sm flex-1">
                    {new Date(reflection.entryDate).toLocaleDateString("pt-BR")}
                  </Text>
                </View>
                <Text
                  className="text-gray-700 text-sm line-clamp-2"
                  numberOfLines={2}
                >
                  {reflection.content}
                </Text>
                {reflection.moodTags.length > 0 && (
                  <View className="flex-row flex-wrap gap-2 mt-2">
                    {reflection.moodTags.map((tag, idx) => (
                      <View
                        key={idx}
                        className="bg-purple-100 px-2 py-1 rounded"
                      >
                        <Text className="text-purple-800 text-xs">{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </StateView>

        {/* Current Reflection Detail */}
        {state.currentReflection && (
          <View
            className={`m-4 p-4 rounded-lg ${REFLECTION_THEME.containers.reflection}`}
          >
            <Text className="text-lg font-bold text-gray-800 mb-2">
              Reflexão Selecionada
            </Text>
            <Text className="text-gray-600 text-sm mb-3">
              {state.currentReflection.content}
            </Text>

            {/* Generate Questions Button */}
            <Pressable
              onPress={handleGenerateQuestions}
              disabled={state.isGenerating}
              className={`rounded-lg p-3 mb-3 ${
                state.isGenerating ? "bg-gray-300" : "bg-blue-500"
              }`}
            >
              <Text className="text-white font-bold text-center">
                {state.isGenerating ? "Gerando..." : "Gerar Perguntas Guiadas"}
              </Text>
            </Pressable>

            {/* Guided Questions Display */}
            {state.currentQuestions && (
              <View
                className={`p-3 rounded-lg mb-3 ${REFLECTION_THEME.containers.questionSet}`}
              >
                <Text className="font-bold text-blue-800 mb-2">
                  Perguntas Guiadas
                </Text>
                {state.currentQuestions.questions.map((question, idx) => (
                  <Text key={idx} className="text-blue-700 text-sm mb-2 italic">
                    • {question}
                  </Text>
                ))}
                <Text className="text-xs text-blue-600 mt-2">
                  Modo: {state.currentQuestions.generationMode}
                </Text>
              </View>
            )}

            {/* Delete Button */}
            <Pressable
              onPress={actions.initiateDelete}
              disabled={state.isSaving}
              className="rounded-lg p-3 bg-red-500"
            >
              <Text className="text-white font-bold text-center">
                Deletar Reflexão
              </Text>
            </Pressable>
          </View>
        )}

        {/* Delete Confirmation Dialog */}
        {state.showDeleteConfirm && (
          <View className="m-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
            <Text className="text-red-800 font-bold mb-2">
              Confirmar Exclusão
            </Text>
            <Text className="text-red-700 text-sm mb-4">
              Esta reflexão e todas as suas perguntas guiadas serão deletadas
              permanentemente. Esta ação não pode ser desfeita.
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={actions.cancelDelete}
                className="flex-1 bg-gray-400 rounded-lg p-3"
              >
                <Text className="text-white text-center font-bold">
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                onPress={actions.confirmDelete}
                disabled={state.isSaving}
                className={`flex-1 rounded-lg p-3 ${
                  state.isSaving ? "bg-red-400" : "bg-red-600"
                }`}
              >
                <Text className="text-white text-center font-bold">
                  {state.isSaving ? "Deletando..." : "Deletar Permanentemente"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default DailyReflectionScreen;
