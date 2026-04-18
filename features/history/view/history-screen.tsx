import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ChatConversation } from "@/database/chat/types";
import { ConversationList } from "@/features/history/components/conversation-list";
import { DeleteConversationModal } from "@/features/history/components/delete-conversation-modal";
import { EmptyHistory } from "@/features/history/components/empty-history";
import { RenameConversationModal } from "@/features/history/components/rename-conversation-modal";
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

  // per-item dropdown menu will be used; no global menuOpen state required

  const handleConversationPress = useCallback((id: string) => {
    router.push({
      pathname: "/",
      params: { conversationId: id },
    });
  }, []);

  const openRenameDialog = useCallback((conv: ChatConversation) => {
    setDialogState({
      type: "rename",
      conversation: conv,
      renameValue: conv.title,
    });
  }, []);

  const openDeleteDialog = useCallback((conv: ChatConversation) => {
    setDialogState({
      type: "delete",
      conversation: conv,
      renameValue: "",
    });
  }, []);

  const handleRenameConfirm = useCallback(() => {
    if (!dialogState.conversation) return;

    renameConversation(dialogState.conversation.id, dialogState.renameValue);

    setDialogState({
      type: null,
      conversation: null,
      renameValue: "",
    });
  }, [dialogState, renameConversation]);

  const handleDeleteConfirm = useCallback(() => {
    if (!dialogState.conversation) return;

    deleteConversation(dialogState.conversation.id);

    setDialogState({
      type: null,
      conversation: null,
      renameValue: "",
    });
  }, [dialogState, deleteConversation]);

  // no global closeMenuModal needed when using per-item dropdown

  const closeRenameModal = useCallback(() => {
    setDialogState({
      type: null,
      conversation: null,
      renameValue: "",
    });
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDialogState({
      type: null,
      conversation: null,
      renameValue: "",
    });
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
          onRename={openRenameDialog}
          onDelete={openDeleteDialog}
        />
      )}
      {/* per-item dropdown menu is used; ConversationMenuModal removed */}

      <RenameConversationModal
        open={dialogState.type === "rename"}
        conversation={dialogState.conversation}
        renameValue={dialogState.renameValue}
        onRenameValueChange={(value) =>
          setDialogState((prev: DialogState) => ({
            ...prev,
            renameValue: value,
          }))
        }
        onOpenChange={closeRenameModal}
        onConfirm={handleRenameConfirm}
      />

      <DeleteConversationModal
        open={dialogState.type === "delete"}
        conversation={dialogState.conversation}
        onOpenChange={closeDeleteModal}
        onConfirm={handleDeleteConfirm}
      />
    </View>
  );
});

export const HistoryScreen = memo(function HistoryScreen() {
  return <HistoryScreenInner />;
});
