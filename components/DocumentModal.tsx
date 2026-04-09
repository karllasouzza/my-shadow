import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

interface DocumentModalProps {
  visible: boolean;
  onClose: () => void;
  ids: string[];
  document: string;
  onDocumentChange: (text: string) => void;
  onModifyDocument: () => void;
  onDelete?: (ids: string[]) => void;
}

/**
 * T031: DocumentModal with delete confirmation and action flow
 *
 * Controls reflection/review document editing with support for:
 * - Create/edit document content
 * - Delete with confirmation dialog
 * - Cascade deletion of linked artifacts
 */
export const DocumentModal = ({
  visible,
  onClose,
  ids,
  document,
  onDocumentChange,
  onModifyDocument,
  onDelete,
}: DocumentModalProps) => {
  const [showDeleteConfirmation, setShowDeleteConfirmation] =
    useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleDeletePress = () => {
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirmation(false);
    setIsDeleting(true);

    try {
      if (onDelete && ids.length > 0) {
        await onDelete(ids);
        onClose(); // Close modal after successful deletion
      }
    } catch {
      Alert.alert(
        "Erro ao Deletar",
        "Não foi possível deletar os documentos. Por favor, tente novamente.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView className="flex-1">
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View className="flex-1 p-4">
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-2xl font-bold">Editor de Documento</Text>
                <TouchableOpacity
                  onPress={onClose}
                  disabled={isDeleting}
                  className="p-2"
                >
                  <Ionicons name="close-outline" size={32} color="black" />
                </TouchableOpacity>
              </View>

              {/* Text Input */}
              <TextInput
                value={document}
                onChangeText={onDocumentChange}
                placeholder="Cole seu documento aqui"
                placeholderTextColor="#999"
                multiline
                className="flex-1 border border-gray-300 bg-white rounded-xl p-3 mb-4 text-base"
                editable={!isDeleting}
              />

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                {/* Edit/Add Button */}
                <TouchableOpacity
                  onPress={onModifyDocument}
                  disabled={isDeleting}
                  className="flex-1 bg-blue-500 rounded-lg p-4"
                >
                  <Text className="text-white font-bold text-center">
                    {ids.length > 0 ? "Atualizar" : "Adicionar"} Documento
                  </Text>
                </TouchableOpacity>

                {/* Delete Button (only if documents exist) */}
                {ids.length > 0 && (
                  <TouchableOpacity
                    onPress={handleDeletePress}
                    disabled={isDeleting}
                    className="bg-red-500 rounded-lg px-4"
                  >
                    <Text className="text-white font-bold text-center py-4">
                      <Ionicons name="trash" size={20} color="white" />
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Delete Confirmation Modal */}
              <Modal
                visible={showDeleteConfirmation}
                transparent
                animationType="fade"
                onRequestClose={handleCancelDelete}
              >
                <View className="flex-1 bg-black/50 items-center justify-center">
                  <View className="bg-white rounded-2xl p-6 w-5/6 max-w-sm">
                    <Text className="text-xl font-bold text-gray-800 mb-3">
                      Confirmar Exclusão
                    </Text>
                    <Text className="text-gray-600 mb-6">
                      Esta ação irá deletar permanentemente {ids.length}{" "}
                      documento(s) e todos os artefatos vinculados. Esta ação
                      não pode ser desfeita.
                    </Text>

                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        onPress={handleCancelDelete}
                        disabled={isDeleting}
                        className="flex-1 bg-gray-200 rounded-lg p-3"
                      >
                        <Text className="text-gray-800 font-semibold text-center">
                          Cancelar
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleConfirmDelete}
                        disabled={isDeleting}
                        className={
                          isDeleting
                            ? "flex-1 rounded-lg p-3 bg-red-300"
                            : "flex-1 rounded-lg p-3 bg-red-500"
                        }
                      >
                        <Text className="text-white font-semibold text-center">
                          {isDeleting ? "Deletando..." : "Deletar"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
};
