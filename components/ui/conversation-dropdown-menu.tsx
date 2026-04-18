import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { ChatConversation } from "@/database/chat/types";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react-native";
import React from "react";
import { Text } from "./text";

interface ConversationDropdownMenuProps {
  conversation: ChatConversation;
  onRename: (conv: ChatConversation) => void;
  onDelete: (conv: ChatConversation) => void;
  className?: string;
}

export function ConversationDropdownMenu({
  conversation,
  onRename,
  onDelete,
  className,
}: ConversationDropdownMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("p-0", className)}>
          <Icon as={MoreHorizontal} className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuItem onPress={() => onRename(conversation)}>
          <Text>Renomear</Text>
        </DropdownMenuItem>
        <DropdownMenuItem
          onPress={() => onDelete(conversation)}
          variant="destructive"
        >
          <Text>Excluir</Text>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ConversationDropdownMenu;
