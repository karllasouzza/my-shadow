import {
    AppModal,
    AppModalFooter,
    AppModalHandle,
    AppModalHeader,
} from "@/components/molecules/app-modal";
import { Text } from "@/components/ui/text";
import { ChatConversation } from "@/database/chat/types";
import React from "react";
import { View } from "react-native";

interface DeleteConversationModalProps {
  open: boolean;
  conversation: ChatConversation | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteConversationModal({
  open,
  conversation,
  onOpenChange,
  onConfirm,
}: DeleteConversationModalProps) {
  return (
    <AppModal open={open} onOpenChange={onOpenChange}>
      <AppModalHandle />
      <AppModalHeader title="Excluir Conversa" />
      <View className="px-6 gap-4">
        <Text className="text-muted-foreground">
          Tem certeza que deseja excluir "{conversation?.title}"? Esta ação não
          pode ser desfeita.
        </Text>
      </View>
      <AppModalFooter
        onCancel={() => onOpenChange(false)}
        cancelLabel="Cancelar"
        onConfirm={() => {
          onConfirm();
          onOpenChange(false);
        }}
        confirmLabel="Excluir"
        confirmVariant="destructive"
      />
    </AppModal>
  );
}
