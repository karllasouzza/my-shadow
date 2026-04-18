import {
    AppModal,
    AppModalContent,
    AppModalFooter,
    AppModalHandle,
    AppModalHeader,
} from "@/components/molecules/app-modal";
import { Input } from "@/components/ui/input";
import { ChatConversation } from "@/database/chat/types";
import React from "react";
import { View } from "react-native";

interface RenameConversationModalProps {
  open: boolean;
  conversation: ChatConversation | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function RenameConversationModal({
  open,
  conversation,
  renameValue,
  onRenameValueChange,
  onOpenChange,
  onConfirm,
}: RenameConversationModalProps) {
  return (
    <AppModal open={open} onOpenChange={onOpenChange}>
      <AppModalContent>
        <AppModalHandle />
        <AppModalHeader
          title={
            conversation?.title
              ? `Renomear: ${conversation.title}`
              : "Renomear Conversa"
          }
        />
        <View className="px-6 gap-4">
          <Input
            value={renameValue}
            onChangeText={onRenameValueChange}
            placeholder="Digite o novo título"
            editable={open}
            autoFocus
          />
        </View>
        <AppModalFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Cancelar"
          onConfirm={() => {
            onConfirm();
            onOpenChange(false);
          }}
          confirmLabel="Salvar"
        />
      </AppModalContent>
    </AppModal>
  );
}
