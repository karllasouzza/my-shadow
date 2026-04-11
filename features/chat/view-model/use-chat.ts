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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCancelOption, setShowCancelOption] = useState(false);
  const [thinkingEnabled, setThinkingEnabledState] = useState(() =>
    getThinkingEnabled(),
  );
  const [modelSupportsReasoning, setModelSupportsReasoning] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Unique key generator for LegendList — guarantees no duplicates
  const keyCounterRef = useRef(0);
  const makeKey = useCallback(() => {
    return `msg-${Date.now()}-${++keyCounterRef.current}`;
  }, []);

  // ==========================================================================
  // Available models (delegated to shared/ai)
  // ==========================================================================

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

  // ==========================================================================
  // Model Actions (delegated to shared/ai/model-loader)
  // ==========================================================================

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

    setIsModelLoading(true);
    const result = await aiAutoLoadLastModel();
    if (result?.success) {
      setIsModelReady(true);
      setModelsRefresh((v) => v + 1);
      const models = getAvailableModels();
      const selected = getSelectedModelId();
      const entry = models.find((m) => m.id === selected);
      setModelSupportsReasoning(entry?.supportsReasoning ?? false);
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

    const model = getAIRuntime().getCurrentModel();
    const catalog = getAvailableModels();
    const entry = catalog.find((m) => m.id === model?.id);
    const supports = entry?.supportsReasoning ?? false;
    setModelSupportsReasoning(supports);

    // If no ID, just reset and return
    if (!id) {
      setConversationId(null);
      setErrorMessage(null);
      return;
    }

    // Validate conversation exists in storage
    const loadResult = DatabaseChat.loadConversation(id);
    if (!loadResult.success || !loadResult.data) {
      setConversationId(null);
      setErrorMessage(
        "Conversa não encontrada. Ela pode ter sido removida ou corrompida.",
      );
      return;
    }

    // Conversation exists, set it
    setConversationId(id);
    setErrorMessage(null);
  }, []);

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
      setErrorMessage(null);

      const validation = validateChatMessage(content);
      if (!validation.isValid) {
        setErrorMessage(validation.error ?? "Mensagem inválida.");
        return;
      }

      if (!isModelReady) {
        setErrorMessage(
          "Nenhum modelo carregado. Selecione um modelo no seletor acima.",
        );
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
        setErrorMessage("Falha ao carregar conversa.");
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
      setStreamingMessage({
        role: "assistant",
        content: "",
        thinking: "",
        modelId: currentModelId,
        timestamp: new Date().toISOString(),
        _isStreaming: true,
        _key: makeKey(),
      });
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

      await runtime.streamCompletion(messages, {
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

          const current = streamingMessage;
          setStreamingMessage({
            role: "assistant",
            content: outputText,
            thinking: thinkingText || undefined,
            modelId: currentModelId,
            timestamp: new Date().toISOString(),
            _isStreaming: true,
            _key: current?._key ?? makeKey(),
          });
          setShowCancelOption(true);
        },
        abortSignal: controller.signal,
      });

      setIsGenerating(false);
      setShowCancelOption(false);

      if (controller.signal.aborted) {
        const current = streamingMessage;
        if (current && (current.thinking || current.content)) {
          const conv2 = DatabaseChat.loadConversation(convId!);
          if (conv2.success && conv2.data) {
            conv2.data.messages.push(
              createChatMessage(
                "assistant",
                current.content + " [cancelado]",
                current.thinking,
                currentModelId,
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
      abortControllerRef.current = null;
    },
    [conversationId, isModelReady, thinkingEnabled, streamingMessage, makeKey],
  );

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
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
      errorMessage,
      modelError,
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
      errorMessage,
      modelError,
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
