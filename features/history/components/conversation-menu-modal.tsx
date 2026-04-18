import {
    AppModal,
    AppModalFooter,
    AppModalHandle,
    AppModalHeader,
} from "@/components/molecules/app-modal";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ChatConversation } from "@/database/chat/types";
import React from "react";
import { View } from "react-native";

interface ConversationMenuModalProps {
  open: boolean;
  conversation: ChatConversation | null;
  onOpenChange: (open: boolean) => void;
  onRename: (conversation: ChatConversation) => void;
  onDelete: (conversation: ChatConversation) => void;
}

export function ConversationMenuModal({
  open,
  conversation,
  onOpenChange,
  onRename,
  onDelete,
}: ConversationMenuModalProps) {
  return (
    <AppModal open={open} onOpenChange={onOpenChange}>
      <AppModalHandle />
      <AppModalHeader
        title={conversation?.title || ""}
        titleClassName="text-lg"
      />
      <View className="px-6">
        <View className="gap-3 flex-col">
          <Button
            variant="outline"
            onPress={() => {
              if (conversation) {
                onRename(conversation);
                onOpenChange(false);
              }
            }}
          >
            <Text>Renomear</Text>
          </Button>
          <Button
            variant="destructive"
            onPress={() => {
              if (conversation) {
                onDelete(conversation);
                onOpenChange(false);
              }
            }}
          >
            <Text>Excluir</Text>
          </Button>
        </View>
      </View>
      <AppModalFooter
        onCancel={() => onOpenChange(false)}
        cancelLabel="Cancelar"
        onConfirm={() => onOpenChange(false)}
        confirmLabel="Fechar"
      />
    </AppModal>
  );
}
