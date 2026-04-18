import {
  AppModal,
  AppModalFooter,
  AppModalHandle,
  AppModalHeader,
} from "@/components/molecules/app-modal";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { ChatConversation } from "@/database/chat/types";
import { ConversationList } from "@/features/history/components/conversation-list";
import { EmptyHistory } from "@/features/history/components/empty-history";
import { useHistory } from "@/features/history/view-model/use-history";
import { observer } from "@legendapp/state/react";
import { Link, router } from "expo-router";
import { Plus } from "lucide-react-native";
import React, { memo, useCallback, useState } from "react";
import { View } from "react-native";

type DialogState = {
  type: "delete" | "rename" | null;
  conversation: ChatConversation | null;
  renameValue: string;
};

const HistoryScreenInner = observer(function HistoryScreenInner() {
  const { conversations, deleteConversation, renameConversation } =
    useHistory();

  const [dialogState, setDialogState] = useState<DialogState>({
    type: null,
    conversation: null,
    renameValue: "",
  });

  const [menuOpen, setMenuOpen] = useState<{
    open: boolean;
    conversation: ChatConversation | null;
  }>({
    open: false,
    conversation: null,
  });

  const handleConversationPress = useCallback((id: string) => {
    router.push({
      pathname: "/",
      params: { conversationId: id },
    });
  }, []);

  const openRenameDialog = useCallback((conv: ChatConversation) => {
    setMenuOpen({ open: false, conversation: null });
    setDialogState({
      type: "rename",
      conversation: conv,
      renameValue: conv.title,
    });
  }, []);

  const openDeleteDialog = useCallback((conv: ChatConversation) => {
    setMenuOpen({ open: false, conversation: null });
    setDialogState({
      type: "delete",
      conversation: conv,
      renameValue: "",
    });
  }, []);

  const handleRenameConfirm = useCallback(() => {
    if (!dialogState.conversation) return;

    const hasRenamed = renameConversation(
      dialogState.conversation.id,
      dialogState.renameValue,
    );

    if (hasRenamed) {
      setDialogState({
        type: null,
        conversation: null,
        renameValue: "",
      });
    }
  }, [dialogState, renameConversation]);

  const handleDeleteConfirm = useCallback(() => {
    if (!dialogState.conversation) return;

    const hasDeleted = deleteConversation(dialogState.conversation.id);

    if (hasDeleted) {
      setDialogState({
        type: null,
        conversation: null,
        renameValue: "",
      });
    }
  }, [dialogState, deleteConversation]);

  const closeDialogs = useCallback(() => {
    setDialogState({
      type: null,
      conversation: null,
      renameValue: "",
    });
    setMenuOpen({ open: false, conversation: null });
  }, []);

  return (
    <View className="flex-1 bg-background">
      <TopBar
        title="Histórico"
        rightAction={
          <Link href="/?new=1" asChild>
            <Button variant="outline" className="!border-primary">
              <Text className="text-primary">Nova Conversa</Text>
              <Icon as={Plus} className="size-5 text-primary p-0 stroke-2" />
            </Button>
          </Link>
        }
      />

      {conversations.length === 0 ? (
        <EmptyHistory />
      ) : (
        <ConversationList
          conversations={conversations}
          onPress={handleConversationPress}
          onLongPress={(conv) => {
            setMenuOpen({ open: true, conversation: conv });
          }}
        />
      )}

      {/* Menu Options Modal */}
      <AppModal
        open={menuOpen.open}
        onOpenChange={(open) => {
          if (!open) {
            setMenuOpen({ open: false, conversation: null });
          }
        }}
      >
        <AppModalHandle />
        <AppModalHeader
          title={menuOpen.conversation?.title || ""}
          titleClassName="text-lg"
        />
        <View className="px-6">
          <View className="gap-3 flex-col">
            <Button
              variant="outline"
              onPress={() => {
                if (menuOpen.conversation) {
                  openRenameDialog(menuOpen.conversation);
                }
              }}
            >
              <Text>Renomear</Text>
            </Button>
            <Button
              variant="destructive"
              onPress={() => {
                if (menuOpen.conversation) {
                  openDeleteDialog(menuOpen.conversation);
                }
              }}
            >
              <Text>Excluir</Text>
            </Button>
          </View>
        </View>
        <AppModalFooter
          onCancel={closeDialogs}
          cancelLabel="Cancelar"
          onConfirm={closeDialogs}
          confirmLabel="Fechar"
        />
      </AppModal>

      {/* Rename Modal */}
      <AppModal
        open={dialogState.type === "rename"}
        onOpenChange={(open) => {
          if (!open) closeDialogs();
        }}
      >
        <AppModalHandle />
        <AppModalHeader title="Renomear Conversa" />
        <View className="px-6 gap-4">
          <Input
            value={dialogState.renameValue}
            onChangeText={(text) =>
              setDialogState((prev) => ({
                ...prev,
                renameValue: text,
              }))
            }
            placeholder="Digite o novo título"
            editable={dialogState.type === "rename"}
          />
        </View>
        <AppModalFooter
          onCancel={closeDialogs}
          cancelLabel="Cancelar"
          onConfirm={handleRenameConfirm}
          confirmLabel="Salvar"
        />
      </AppModal>

      {/* Delete Confirmation Modal */}
      <AppModal
        open={dialogState.type === "delete"}
        onOpenChange={(open) => {
          if (!open) closeDialogs();
        }}
      >
        <AppModalHandle />
        <AppModalHeader title="Excluir Conversa" />
        <View className="px-6 gap-4">
          <Text className="text-muted-foreground">
            Tem certeza que deseja excluir "{dialogState.conversation?.title}"?
            Esta ação não pode ser desfeita.
          </Text>
        </View>
        <AppModalFooter
          onCancel={closeDialogs}
          cancelLabel="Cancelar"
          onConfirm={handleDeleteConfirm}
          confirmLabel="Excluir"
          confirmVariant="destructive"
        />
      </AppModal>
    </View>
  );
});

export const HistoryScreen = memo(function HistoryScreen() {
  return <HistoryScreenInner />;
});
