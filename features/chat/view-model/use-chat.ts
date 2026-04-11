import {
  getThinkingEnabled,
  setThinkingEnabled,
} from "@/database/actions/chat-actions";
import * as DatabaseChat from "@/database/chat";
import { autoGenerateTitle } from "@/features/chat/model/chat-conversation";
import {
  createChatMessage,
  validateChatMessage,
  type ChatMessage,
} from "@/features/chat/model/chat-message";
import { getAIRuntime, getAllModels } from "@/shared/ai";
import { useCallback, useMemo, useRef, useState } from "react";

interface StreamingMessage extends ChatMessage {
  _isStreaming: true;
}

export function useChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingMessage, setStreamingMessage] =
    useState<StreamingMessage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCancelOption, setShowCancelOption] = useState(false);
  const [thinkingEnabled, setThinkingEnabledState] = useState(() =>
    getThinkingEnabled(),
  );
  const [modelSupportsReasoning, setModelSupportsReasoning] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // ==========================================================================
  // Actions
  // ==========================================================================

  /** Inicializa o chat com conversation ID da rota */
  const initChat = useCallback((id: string | null) => {
    setConversationId(id);
    setErrorMessage(null);
    setStreamingMessage(null);
    setIsGenerating(false);
    setShowCancelOption(false);
    setThinkingEnabledState(getThinkingEnabled());

    const model = getAIRuntime().getCurrentModel();
    const catalog = getAllModels();
    const entry = catalog.find((m) => m.id === model?.id);
    const supports =
      entry?.tags.some(
        (t) =>
          t.includes("reasoning") ||
          t.includes("thinking") ||
          t.includes("chain"),
      ) ?? false;
    setModelSupportsReasoning(supports);
  }, []);

  /** Sync status do modelo */
  const syncModelStatus = useCallback(async () => {
    const loaded = getAIRuntime().isModelLoaded();
    setIsModelReady(loaded);

    const model = getAIRuntime().getCurrentModel();
    const catalog = getAllModels();
    const entry = catalog.find((m) => m.id === model?.id);
    const supports =
      entry?.tags.some(
        (t) =>
          t.includes("reasoning") ||
          t.includes("thinking") ||
          t.includes("chain"),
      ) ?? false;
    setModelSupportsReasoning(supports);
  }, []);

  /** Envia mensagem — aparece IMEDIATAMENTE */
  const sendMessage = useCallback(
    async (content: string) => {
      setErrorMessage(null);

      const validation = validateChatMessage(content);
      if (!validation.isValid) {
        setErrorMessage(validation.error ?? "Mensagem inválida.");
        return;
      }

      if (!isModelReady) {
        setErrorMessage(
          "Nenhum modelo carregado. Vá para Modelos para carregar um.",
        );
        return;
      }

      // Obtém ou cria conversa
      let convId = conversationId;
      if (!convId) {
        const modelId = getAIRuntime().getCurrentModel()?.id ?? "unknown";
        const newConv = DatabaseChat.createConversation(modelId);
        convId = newConv.id;
        DatabaseChat.saveConversation(newConv);
        setConversationId(convId);
      }

      // Carrega conversa
      const loadResult = DatabaseChat.loadConversation(convId);
      if (!loadResult.success || !loadResult.data) {
        setErrorMessage("Falha ao carregar conversa.");
        return;
      }
      const conv = loadResult.data;

      // Adiciona mensagem do usuário — aparece IMEDIATAMENTE!
      conv.messages.push(createChatMessage("user", content));
      conv.updatedAt = new Date().toISOString();

      if (conv.messages.filter((m) => m.role === "user").length === 1) {
        conv.title = autoGenerateTitle(content);
      }

      DatabaseChat.saveConversation(conv);

      // Prepara streaming
      setIsGenerating(true);
      setStreamingMessage({
        role: "assistant",
        content: "",
        thinking: "",
        timestamp: new Date().toISOString(),
        _isStreaming: true,
      });
      setShowCancelOption(false);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Stream da IA
      const runtime = getAIRuntime();
      const messages = conv.messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));

      if (thinkingEnabled) {
        messages.unshift({
          role: "system",
          content:
            "First, think step by step in a <thinking> tag about how to solve the user's request. Then provide your final answer after the closing </thinking> tag.",
        });
      }

      let fullResponse = "";
      let thinkingText = "";
      let outputText = "";
      let inThinking = false;

      await runtime.streamCompletion(messages, {
        onToken: (token: string) => {
          if (controller.signal.aborted) return;

          fullResponse += token;

          if (thinkingEnabled) {
            if (fullResponse.includes("<thinking>")) {
              inThinking = true;
            }
            if (inThinking && fullResponse.includes("</thinking>")) {
              inThinking = false;
              thinkingText =
                fullResponse
                  .split("<thinking>")[1]
                  ?.split("</thinking>")[0]
                  ?.trim() ?? "";
              outputText = fullResponse.split("</thinking>")[1]?.trim() ?? "";
            } else if (inThinking) {
              thinkingText = fullResponse.split("<thinking>")[1] ?? "";
            } else if (thinkingText && !inThinking) {
              outputText =
                fullResponse.split("</thinking>")[1]?.trim() ?? outputText;
            }
          } else {
            outputText = fullResponse;
          }

          setStreamingMessage({
            role: "assistant",
            content: outputText,
            thinking: thinkingText || undefined,
            timestamp: new Date().toISOString(),
            _isStreaming: true,
          });
          setShowCancelOption(true);
        },
        abortSignal: controller.signal,
      });

      // Finaliza
      setIsGenerating(false);
      setShowCancelOption(false);

      if (controller.signal.aborted) {
        if (
          streamingMessage &&
          (streamingMessage.thinking || streamingMessage.content)
        ) {
          const conv2 = DatabaseChat.loadConversation(convId!);
          if (conv2.success && conv2.data) {
            conv2.data.messages.push(
              createChatMessage(
                "assistant",
                streamingMessage.content + " [cancelado]",
                streamingMessage.thinking,
              ),
            );
            conv2.data.updatedAt = new Date().toISOString();
            DatabaseChat.saveConversation(conv2.data);
          }
        }
        setStreamingMessage(null);
        abortControllerRef.current = null;
        return;
      }

      // Salva resposta completa
      const conv3 = DatabaseChat.loadConversation(convId!);
      if (conv3.success && conv3.data) {
        conv3.data.messages.push(
          createChatMessage("assistant", outputText, thinkingText || undefined),
        );
        conv3.data.updatedAt = new Date().toISOString();
        DatabaseChat.saveConversation(conv3.data);
      }

      setStreamingMessage(null);
      abortControllerRef.current = null;
    },
    [conversationId, isModelReady, thinkingEnabled, streamingMessage],
  );

  /** Cancela geração */
  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsGenerating(false);
    setShowCancelOption(false);
    setStreamingMessage(null);
  }, []);

  /** Toggle thinking — persiste no database */
  const toggleThinking = useCallback(() => {
    setThinkingEnabledState((prev) => {
      const newVal = !prev;
      setThinkingEnabled(newVal);
      return newVal;
    });
  }, []);

  /** Reseta estado para nova conversa */
  const resetChatState = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setConversationId(null);
    setErrorMessage(null);
    setIsGenerating(false);
    setStreamingMessage(null);
    setShowCancelOption(false);
  }, []);

  // ==========================================================================
  // Derived state
  // ==========================================================================

  const displayMessages = useMemo(() => {
    if (!conversationId) {
      return streamingMessage ? [streamingMessage] : [];
    }
    const result = DatabaseChat.loadConversation(conversationId);
    const messages = result.success && result.data ? result.data.messages : [];
    return streamingMessage ? [...messages, streamingMessage] : messages;
  }, [conversationId, streamingMessage]);

  const hasContent = useMemo(() => {
    if (!conversationId) return !!streamingMessage;
    const result = DatabaseChat.loadConversation(conversationId);
    const msgCount =
      result.success && result.data ? result.data.messages.length : 0;
    const hasStreaming =
      !!streamingMessage &&
      !!(streamingMessage.thinking || streamingMessage.content);
    return msgCount > 0 || hasStreaming;
  }, [conversationId, streamingMessage]);

  const activeModelName = useMemo(
    () => getAIRuntime().getCurrentModel()?.id ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isModelReady],
  );

  return useMemo(
    () => ({
      // State
      conversationId,
      isModelReady,
      isGenerating,
      streamingMessage,
      errorMessage,
      showCancelOption: showCancelOption && isGenerating,
      thinkingEnabled,
      modelSupportsReasoning,
      displayMessages,
      hasContent,
      activeModelName,

      // Actions
      initChat,
      syncModelStatus,
      sendMessage,
      cancelGeneration,
      toggleThinking,
      resetChatState,
    }),
    [
      conversationId,
      isModelReady,
      isGenerating,
      streamingMessage,
      errorMessage,
      showCancelOption,
      thinkingEnabled,
      modelSupportsReasoning,
      displayMessages,
      hasContent,
      activeModelName,
      initChat,
      syncModelStatus,
      sendMessage,
      cancelGeneration,
      toggleThinking,
      resetChatState,
    ],
  );
}
