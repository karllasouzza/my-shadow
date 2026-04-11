/**
 * Streaming Bubble
 *
 * Mensagem da IA enquanto está sendo gerada em tempo real.
 * Usa ThinkingSection + AI Bubble com indicador de streaming.
 */

import { AIBubble } from "@/features/chat/components/ai-bubble";
import type { ChatMessage } from "@/features/chat/model/chat-message";
import { observer } from "@legendapp/state/react";
import React from "react";

interface StreamingBubbleProps {
  message: ChatMessage;
}

export const StreamingBubble = observer(function StreamingBubble({
  message,
}: StreamingBubbleProps) {
  return <AIBubble message={message} isStreaming />;
});
