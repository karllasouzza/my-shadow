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
import {
  autoLoadLastModel as aiAutoLoadLastModel,
  loadModel as aiLoadModel,
  unloadModel as aiUnloadModel,
  getAIRuntime,
  getAvailableModels,
  getSelectedModelId,
} from "@/shared/ai";
import { useCallback, useMemo, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

interface StreamingMessage extends ChatMessage {
  _isStreaming: true;
  _key: string; // Unique key for LegendList
}

// ============================================================================
// Hook
// ============================================================================

export function useChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingMessage, setStreamingMessage] =
    useState<StreamingMessage | null>(null);
  const [showCancelOption, setShowCancelOption] = useState(false);
  const [thinkingEnabled, setThinkingEnabledState] = useState(() =>
    getThinkingEnabled(),
  );
  const [modelSupportsReasoning, setModelSupportsReasoning] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // Global conversation error (shown as overlay, not in chat)
  const [conversationError, setConversationError] = useState<string | null>(
    null,
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  // Refs to avoid stale closures in async callbacks (onToken, abort)
  const streamingMessageRef = useRef<StreamingMessage | null>(null);
  const streamingKeyRef = useRef<string>("");

  // Ref to store last user message for retry functionality
  const lastUserMessageRef = useRef<string>("");

  // Unique key generator for LegendList — guarantees no duplicates
  const keyCounterRef = useRef(0);
  const makeKey = useCallback(() => {
    return `msg-${Date.now()}-${++keyCounterRef.current}`;
  }, []);

  // Refresh available models when model state changes
  const [modelsRefresh, setModelsRefresh] = useState(0);
  const availableModels = useMemo(
    () => getAvailableModels(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modelsRefresh],
  );

  const selectedModelId = useMemo(
    () => getSelectedModelId(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isModelReady, modelsRefresh],
  );

  const loadModel = useCallback(async (modelId: string) => {
    setIsModelLoading(true);
    setModelError(null);
    const result = await aiLoadModel(modelId);
    setIsModelLoading(false);

    if (!result.success) {
      setModelError(result.error ?? "Falha ao carregar modelo.");
      return;
    }

    setIsModelReady(true);
    setModelsRefresh((v) => v + 1);

    // Check reasoning support
    const models = getAvailableModels();
    const entry = models.find((m) => m.id === modelId);
    setModelSupportsReasoning(entry?.supportsReasoning ?? false);
  }, []);

  const unloadModel = useCallback(async () => {
    setIsModelLoading(true);
    const result = await aiUnloadModel();
    setIsModelLoading(false);

    if (!result.success) {
      setModelError(result.error ?? "Falha ao descarregar modelo.");
      return;
    }

    setIsModelReady(false);
    setModelError(null);
    setModelsRefresh((v) => v + 1);
  }, []);

  /** Auto-load last used model on init */
  const autoLoadLastModel = useCallback(async () => {
    const runtime = getAIRuntime();
    if (runtime.isModelLoaded()) return;

    const result = await aiAutoLoadLastModel();
    if (!result) return; // No models downloaded, skip loading entirely

    setIsModelLoading(true);
    if (result.success) {
      setIsModelReady(true);
      setModelsRefresh((v) => v + 1);
      const models = getAvailableModels();
      const selected = getSelectedModelId();
      const entry = models.find((m) => m.id === selected);
      setModelSupportsReasoning(entry?.supportsReasoning ?? false);
      setModelError(null);
    } else {
      setModelError(result.error ?? "Falha ao carregar modelo.");
    }
    setIsModelLoading(false);
  }, []);

  // ==========================================================================
  // Chat Actions
  // ==========================================================================

  const initChat = useCallback(async (id: string | null) => {
    setStreamingMessage(null);
    setIsGenerating(false);
    setShowCancelOption(false);
    setThinkingEnabledState(getThinkingEnabled());
    setConversationError(null);

    const model = getAIRuntime().getCurrentModel();
    const catalog = getAvailableModels();
    const entry = catalog.find((m) => m.id === model?.id);
    const supports = entry?.supportsReasoning ?? false;
    setModelSupportsReasoning(supports);

    // If no ID, just reset and return
    if (!id) {
      setConversationId(null);
      return;
    }

    // Validate conversation exists in storage
    const loadResult = DatabaseChat.loadConversation(id);
    if (!loadResult.success || !loadResult.data) {
      setConversationId(null);
      setConversationError("Conversa não encontrada");
      return;
    }

    // Conversation exists, set it
    setConversationId(id);
  }, []);

  /** Helper to add error message to conversation */
  const addErrorMessageToConversation = useCallback(
    (convId: string, errorMessage: string, errorCode?: string) => {
      const result = DatabaseChat.loadConversation(convId);
      if (!result.success || !result.data) return;

      result.data.messages.push(
        createChatMessage(
          "error",
          errorMessage,
          undefined,
          undefined,
          errorCode,
        ),
      );
      result.data.updatedAt = new Date().toISOString();
      DatabaseChat.saveConversation(result.data);
    },
    [],
  );

  const syncModelStatus = useCallback(() => {
    const loaded = getAIRuntime().isModelLoaded();
    setIsModelReady(loaded);

    const model = getAIRuntime().getCurrentModel();
    const models = getAvailableModels();
    const entry = models.find((m) => m.id === model?.id);
    const supports = entry?.supportsReasoning ?? false;
    setModelSupportsReasoning(supports);
    setModelsRefresh((v) => v + 1);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      // Store for retry functionality
      lastUserMessageRef.current = content;

      const validation = validateChatMessage(content);
      if (!validation.isValid) {
        if (conversationId) {
          addErrorMessageToConversation(
            conversationId,
            validation.error ?? "Mensagem inválida.",
            "VALIDATION_ERROR",
          );
        }
        return;
      }

      if (!isModelReady) {
        if (conversationId) {
          addErrorMessageToConversation(
            conversationId,
            "Nenhum modelo carregado. Selecione um modelo no seletor acima.",
            "MODEL_NOT_LOADED",
          );
        }
        return;
      }

      let convId = conversationId;
      if (!convId) {
        const modelId = getAIRuntime().getCurrentModel()?.id ?? "unknown";
        const newConv = DatabaseChat.createConversation(modelId);
        convId = newConv.id;
        DatabaseChat.saveConversation(newConv);
        setConversationId(convId);
      }

      const loadResult = DatabaseChat.loadConversation(convId);
      if (!loadResult.success || !loadResult.data) {
        addErrorMessageToConversation(
          convId,
          "Falha ao carregar conversa.",
          "CONVERSATION_LOAD_FAILED",
        );
        return;
      }
      const conv = loadResult.data;

      conv.messages.push(createChatMessage("user", content));
      conv.updatedAt = new Date().toISOString();

      if (conv.messages.filter((m) => m.role === "user").length === 1) {
        conv.title = autoGenerateTitle(content);
      }

      DatabaseChat.saveConversation(conv);

      // Current model ID for this message
      const currentModelId = getAIRuntime().getCurrentModel()?.id ?? "unknown";

      setIsGenerating(true);
      const stableKey = makeKey();
      streamingKeyRef.current = stableKey;

      const initialMsg: StreamingMessage = {
        role: "assistant",
        content: "",
        thinking: "",
        modelId: currentModelId,
        timestamp: new Date().toISOString(),
        _isStreaming: true,
        _key: stableKey,
      };

      streamingMessageRef.current = initialMsg;
      setStreamingMessage(initialMsg);
      setShowCancelOption(false);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const runtime = getAIRuntime();
      const messages = conv.messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));

      const thinking = thinkingEnabled;
      if (thinking) {
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

      const streamResult = await runtime.streamCompletion(messages, {
        onToken: (token: string) => {
          if (controller.signal.aborted) return;

          fullResponse += token;

          if (thinking) {
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

          const updatedMsg: StreamingMessage = {
            role: "assistant",
            content: outputText,
            thinking: thinkingText || undefined,
            modelId: currentModelId,
            timestamp: new Date().toISOString(),
            _isStreaming: true,
            _key: streamingKeyRef.current, // Use stable key from ref
          };

          streamingMessageRef.current = updatedMsg;
          setStreamingMessage(updatedMsg);
          setShowCancelOption(true);
        },
        abortSignal: controller.signal,
      });

      setIsGenerating(false);
      setShowCancelOption(false);

      // Handle cancellation (user-initiated)
      if (controller.signal.aborted) {
        const partial = streamingMessageRef.current;
        if (partial && (partial.thinking || partial.content)) {
          const conv2 = DatabaseChat.loadConversation(convId!);
          if (conv2.success && conv2.data) {
            conv2.data.messages.push(
              createChatMessage(
                "assistant",
                partial.content + " [cancelado]",
                partial.thinking,
                currentModelId,
              ),
            );
            conv2.data.updatedAt = new Date().toISOString();
            DatabaseChat.saveConversation(conv2.data);
          }
        }
        streamingMessageRef.current = null;
        setStreamingMessage(null);
        abortControllerRef.current = null;
        return;
      }

      // Handle streaming errors (runtime failures, empty response, etc.)
      if (!streamResult.success) {
        streamingMessageRef.current = null;
        setStreamingMessage(null);
        abortControllerRef.current = null;

        const errorCode = streamResult.error?.code ?? "GENERATION_FAILED";
        const errorMsg =
          streamResult.error?.message ?? "Falha ao gerar resposta.";

        // Only add error message if there's no user-visible content
        if (!outputText.trim() && !thinkingText.trim()) {
          addErrorMessageToConversation(convId!, errorMsg, errorCode);
          return;
        }

        // If we have partial content, persist it despite the error
        const conv3 = DatabaseChat.loadConversation(convId!);
        if (conv3.success && conv3.data) {
          conv3.data.messages.push(
            createChatMessage(
              "assistant",
              outputText + " [erro na geração]",
              thinkingText || undefined,
              currentModelId,
            ),
          );
          conv3.data.updatedAt = new Date().toISOString();
          DatabaseChat.saveConversation(conv3.data);
        }
        return;
      }

      // Success: persist the assistant message
      const conv3 = DatabaseChat.loadConversation(convId!);
      if (conv3.success && conv3.data) {
        conv3.data.messages.push(
          createChatMessage(
            "assistant",
            outputText,
            thinkingText || undefined,
            currentModelId,
          ),
        );
        conv3.data.updatedAt = new Date().toISOString();
        DatabaseChat.saveConversation(conv3.data);
      }

      setStreamingMessage(null);
      streamingMessageRef.current = null;
      abortControllerRef.current = null;
    },
    [conversationId, isModelReady, thinkingEnabled, makeKey],
  );

  /** Retry last message by re-sending the last user message */
  const retryLastMessage = useCallback(async () => {
    const lastMessage = lastUserMessageRef.current;
    if (!lastMessage) return;

    // Remove the last error message before retrying
    if (conversationId) {
      const result = DatabaseChat.loadConversation(conversationId);
      if (result.success && result.data) {
        const lastMsg = result.data.messages[result.data.messages.length - 1];
        if (lastMsg?.role === "error") {
          result.data.messages.pop();
          result.data.updatedAt = new Date().toISOString();
          DatabaseChat.saveConversation(result.data);
        }
      }
    }

    await sendMessage(lastMessage);
  }, [conversationId, sendMessage]);

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    streamingMessageRef.current = null;
    setIsGenerating(false);
    setShowCancelOption(false);
    setStreamingMessage(null);
  }, []);

  const toggleThinking = useCallback(() => {
    setThinkingEnabledState((prev) => {
      const newVal = !prev;
      setThinkingEnabled(newVal);
      return newVal;
    });
  }, []);

  const resetChatState = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setConversationId(null);
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
    () => getSelectedModelId(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isModelReady, modelsRefresh],
  );

  return useMemo(
    () => ({
      // State
      conversationId,
      isModelReady,
      isGenerating,
      streamingMessage,
      modelError,
      conversationError,
      showCancelOption: showCancelOption && isGenerating,
      thinkingEnabled,
      modelSupportsReasoning,
      displayMessages,
      hasContent,
      activeModelName,
      selectedModelId,
      availableModels,
      isModelLoading,

      // Chat Actions
      initChat,
      syncModelStatus,
      sendMessage,
      cancelGeneration,
      toggleThinking,
      resetChatState,
      retryLastMessage,
      clearConversationError: () => setConversationError(null),

      // Model Actions
      loadModel,
      unloadModel,
      autoLoadLastModel,
    }),
    [
      conversationId,
      isModelReady,
      isGenerating,
      streamingMessage,
      modelError,
      conversationError,
      showCancelOption,
      thinkingEnabled,
      modelSupportsReasoning,
      displayMessages,
      hasContent,
      activeModelName,
      selectedModelId,
      availableModels,
      isModelLoading,
      initChat,
      syncModelStatus,
      sendMessage,
      cancelGeneration,
      toggleThinking,
      resetChatState,
      loadModel,
      unloadModel,
      autoLoadLastModel,
    ],
  );
}
