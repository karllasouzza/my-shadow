import {
  getThinkingEnabled,
  setThinkingEnabled,
} from "@/database/actions/chat/think-mode";
import * as DatabaseChat from "@/database/chat";
import { autoGenerateTitle } from "@/features/chat/model/chat-conversation";
import {
  createChatMessage,
  validateChatMessage,
  type ChatMessage,
} from "@/features/chat/model/chat-message";
import {
  autoLoadLastModel,
  getAvailableModels,
  getSelectedModelId,
  isModelDownloaded,
  loadModel,
  unloadModel,
} from "@/shared/ai/model-loader";
import { getAIRuntime } from "@/shared/ai/runtime";
import type { AvailableModel } from "@/shared/ai/types/model-loader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface StreamingMessage extends ChatMessage {
  _isStreaming: true;
  _key: string;
}

export function useChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("Nova conversa");
  const [isModelReady, setIsModelReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingMessage, setStreamingMessage] =
    useState<StreamingMessage | null>(null);
  const [showCancelOption, setShowCancelOption] = useState(false);
  const [thinkingEnabled, setThinkingEnabledState] = useState(() =>
    getThinkingEnabled(),
  );
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [currentLoadedModelId, setCurrentLoadedModelId] = useState<
    string | null
  >(null);

  // Global conversation error (shown as overlay, not in chat)
  const [conversationError, setConversationError] = useState<string | null>(
    null,
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  // Refs to avoid stale closures in async callbacks (stream updates, abort)
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
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);

  const reloadAvailableModels = useCallback(async () => {
    const models = await getAvailableModels();
    setAvailableModels(models);
    return models;
  }, []);

  useEffect(() => {
    void reloadAvailableModels();
  }, [modelsRefresh, reloadAvailableModels]);

  /** Call this when screen gains focus to refresh model list */
  const refreshModelsOnFocus = useCallback(() => {
    setModelsRefresh((v) => v + 1);
  }, []);

  const selectedModelId = useMemo(
    () => currentLoadedModelId ?? getSelectedModelId(),
    [isModelReady, modelsRefresh, currentLoadedModelId],
  );

  const handleLoadModel = useCallback(
    async (modelId: string) => {
      setIsModelLoading(true);
      setModelError(null);
      const result = await loadModel(modelId);
      setIsModelLoading(false);

      if (!result.success) {
        setModelError(result.error ?? "Falha ao carregar modelo.");
        return;
      }

      setCurrentLoadedModelId(modelId);
      setIsModelReady(true);
      setModelsRefresh((v) => v + 1);
    },
    [reloadAvailableModels],
  );

  const handleUnloadModel = useCallback(async () => {
    setIsModelLoading(true);
    const result = await unloadModel();
    setIsModelLoading(false);

    if (!result.success) {
      setModelError(result.error ?? "Falha ao descarregar modelo.");
      return;
    }

    setCurrentLoadedModelId(null);
    setIsModelReady(false);
    setModelError(null);
    setModelsRefresh((v) => v + 1);
  }, []);

  /** Auto-load last used model on init */
  const handleAutoLoadLastModel = useCallback(async () => {
    const runtime = getAIRuntime();
    if (runtime.isModelLoaded()) return;

    setIsModelLoading(true);
    const result = await autoLoadLastModel();
    setIsModelLoading(false);
    if (!result) return;

    if (result.success) {
      setModelsRefresh((v) => v + 1);
      setModelError(null);
      setIsModelReady(true);
      setModelsRefresh((v) => v + 1);
      return;
    } else {
      setModelError(result.error ?? "Falha ao carregar modelo.");
    }
  }, [reloadAvailableModels]);

  // ==========================================================================
  // Chat Actions
  // ==========================================================================

  const initChat = useCallback(
    async (id: string | null) => {
      setStreamingMessage(null);
      setIsGenerating(false);
      setShowCancelOption(false);
      setThinkingEnabledState(getThinkingEnabled());
      setConversationError(null);

      // If no ID, just reset and return
      if (!id) {
        setConversationId(null);
        setConversationTitle("Nova conversa");
        return;
      }

      // Validate conversation exists in storage
      const loadResult = DatabaseChat.loadConversation(id);
      if (!loadResult.success || !loadResult.data) {
        setConversationId(null);
        setConversationTitle("Nova conversa");
        setConversationError("Conversa não encontrada");
        return;
      }

      // Conversation exists, set it
      setConversationId(id);
      setConversationTitle(loadResult.data.title || "Nova conversa");
    },
    [availableModels],
  );

  /** Helper to add error message to conversation */
  const attachErrorToUserMessage = useCallback(
    (convId: string, userMessageIndex: number, errorCode?: string) => {
      const result = DatabaseChat.loadConversation(convId);
      if (!result.success || !result.data) return;

      const msg = result.data.messages[userMessageIndex];
      if (msg && msg.role === "user") {
        msg.errorCode = errorCode;
        result.data.updatedAt = new Date().toISOString();
        DatabaseChat.saveConversation(result.data);
      }
    },
    [],
  );

  const syncModelStatus = useCallback(() => {
    const runtime = getAIRuntime();
    const loaded = runtime.isModelLoaded();
    const model = runtime.getCurrentModel();

    // If runtime says loaded but file was deleted, unload it
    if (loaded && model && !isModelDownloaded(model.id)) {
      runtime.unloadModel();
      setIsModelReady(false);
      setModelError("Modelo removido do dispositivo.");
      setModelsRefresh((v) => v + 1);
      return;
    }

    setIsModelReady(loaded);
    setModelsRefresh((v) => v + 1);
  }, [availableModels]);

  // Internal: generate response for a user message (by index in conversation)
  // Handles streaming, error attachment, and success persistence
  const _performGeneration = useCallback(
    async (convId: string, userMessageIndex: number) => {
      const loadResult = DatabaseChat.loadConversation(convId);
      if (!loadResult.success || !loadResult.data) return;
      const conv = loadResult.data;

      // Clear any previous error on this user message
      if (conv.messages[userMessageIndex]) {
        conv.messages[userMessageIndex].errorCode = undefined;
        DatabaseChat.saveConversation(conv);
      }

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
      let fullResponse = "";
      let localReasoning = "";
      let rawAccumulated = "";

      const streamResult = await runtime.streamCompletion(messages, {
        enableThinking: thinking,
        onStreamChunk: (data) => {
          if (controller.signal.aborted) return;

          const runtimeReasoning = (data as any).reasoning;

          if (thinking) {
            if (runtimeReasoning) {
              rawAccumulated += data.token;
              fullResponse = rawAccumulated;
              localReasoning = String(runtimeReasoning).trim();
            } else {
              rawAccumulated += data.token;

              const thinkStartMatch = rawAccumulated.match(
                /<think>([\s\S]*?)<\/think>/,
              );
              if (thinkStartMatch) {
                localReasoning = thinkStartMatch[1].trim();
                fullResponse = rawAccumulated
                  .replace(/<think>[\s\S]*?<\/think>/, "")
                  .trim();
              } else if (rawAccumulated.includes("<think>")) {
                const partial = rawAccumulated.split("<think>")[1];
                if (partial) localReasoning = partial;
                fullResponse = "";
              } else {
                fullResponse = rawAccumulated;
              }
            }
          } else {
            if (data.token) fullResponse += data.token;
          }

          const updatedMsg: StreamingMessage = {
            role: "assistant",
            content: fullResponse,
            thinking: localReasoning || undefined,
            modelId: currentModelId,
            timestamp: new Date().toISOString(),
            _isStreaming: true,
            _key: streamingKeyRef.current,
          };

          streamingMessageRef.current = updatedMsg;
          setStreamingMessage(updatedMsg);
          setShowCancelOption(true);
        },
        abortSignal: controller.signal,
      });

      setIsGenerating(false);
      setShowCancelOption(false);

      if (controller.signal.aborted) {
        const partial = streamingMessageRef.current;
        if (partial && (partial.thinking || partial.content)) {
          const conv2 = DatabaseChat.loadConversation(convId);
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

      if (!streamResult.success) {
        const partial = streamingMessageRef.current;
        streamingMessageRef.current = null;
        setStreamingMessage(null);
        abortControllerRef.current = null;

        const errorCode = streamResult.error?.code ?? "GENERATION_FAILED";

        if (!partial?.content?.trim() && !partial?.thinking?.trim()) {
          attachErrorToUserMessage(convId, userMessageIndex, errorCode);
          return;
        }

        const conv3 = DatabaseChat.loadConversation(convId);
        if (conv3.success && conv3.data) {
          conv3.data.messages.push(
            createChatMessage(
              "assistant",
              (partial.content ?? "") + " [erro na geração]",
              partial.thinking || undefined,
              currentModelId,
            ),
          );
          conv3.data.updatedAt = new Date().toISOString();
          DatabaseChat.saveConversation(conv3.data);
        }
        return;
      }

      // Extract final values at top level for access in metrics update
      const finalText =
        streamResult.data?.text ??
        streamingMessageRef.current?.content ??
        fullResponse;
      const finalThinking =
        (streamResult.data?.reasoning ??
          streamingMessageRef.current?.thinking ??
          localReasoning) ||
        undefined;

      const conv3 = DatabaseChat.loadConversation(convId);
      if (conv3.success && conv3.data) {
        const finalMsg = createChatMessage(
          "assistant",
          finalText,
          finalThinking,
          currentModelId,
        );

        // Attach generation metrics if available
        if (streamResult.data?.metrics) {
          (finalMsg as any).generationMetrics = streamResult.data.metrics;
        }

        conv3.data.messages.push(finalMsg);
        conv3.data.updatedAt = new Date().toISOString();
        DatabaseChat.saveConversation(conv3.data);
      }

      // Clear streaming message immediately so displayMessages reloads from DB
      // The message now has metrics in persistent storage
      setStreamingMessage(null);
      streamingMessageRef.current = null;
      abortControllerRef.current = null;
    },
    [thinkingEnabled, makeKey, attachErrorToUserMessage],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      lastUserMessageRef.current = content;

      const validation = validateChatMessage(content);
      if (!validation.isValid) {
        return;
      }

      if (!isModelReady) {
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
        return;
      }
      const conv = loadResult.data;

      conv.messages.push(createChatMessage("user", content));
      const userMessageIndex = conv.messages.length - 1;
      conv.updatedAt = new Date().toISOString();

      if (conv.messages.filter((m) => m.role === "user").length === 1) {
        conv.title = autoGenerateTitle(content);
        setConversationTitle(conv.title);
      }

      DatabaseChat.saveConversation(conv);

      await _performGeneration(convId, userMessageIndex);
    },
    [conversationId, isModelReady, _performGeneration],
  );

  /** Retry last user message by regenerating assistant response without duplicating user message */
  const retryLastUserMessage = useCallback(async () => {
    if (!conversationId) return;

    const result = DatabaseChat.loadConversation(conversationId);
    if (!result.success || !result.data) return;

    const messages = result.data.messages;
    const lastUserIdx = messages.findLastIndex((m) => m.role === "user");
    if (lastUserIdx < 0) return;

    // Delete any assistant messages after the last user message
    const lastAssistantAfterUserIdx = messages.findLastIndex(
      (m, i) => m.role === "assistant" && i > lastUserIdx,
    );
    if (lastAssistantAfterUserIdx > lastUserIdx) {
      result.data.messages.splice(lastAssistantAfterUserIdx, 1);
      result.data.updatedAt = new Date().toISOString();
      DatabaseChat.saveConversation(result.data);
    }

    // Regenerate (errorCode will be cleared by _performGeneration)
    await _performGeneration(conversationId, lastUserIdx);
  }, [conversationId, _performGeneration]);

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
    setConversationTitle("Nova conversa");
    setIsGenerating(false);
    setStreamingMessage(null);
    setShowCancelOption(false);
  }, []);

  // ==========================================================================
  // Derived state
  // ==========================================================================

  // Centralize conversation loading and error handling to avoid duplicate DB calls
  const getConversationData = useCallback((id: string | null) => {
    if (!id) return null;
    const result = DatabaseChat.loadConversation(id);
    if (!result.success) {
      // Log failure — keep UI resilient and return null
      // Avoid throwing or setting state from render path
      console.error("Failed to load conversation:", result.error);
      return null;
    }
    return result.data;
  }, []);

  const displayMessages = useMemo(() => {
    if (!conversationId) {
      return streamingMessage ? [streamingMessage] : [];
    }

    const conv = getConversationData(conversationId);
    const messages = conv?.messages ?? [];

    return streamingMessage ? [...messages, streamingMessage] : messages;
  }, [conversationId, streamingMessage, getConversationData]);

  const hasContent = useMemo(() => {
    if (!conversationId) return !!streamingMessage;

    // Reuse already-computed displayMessages to avoid extra DB calls
    const messages = displayMessages;
    const msgCount = messages.length;

    const hasStreaming =
      !!streamingMessage &&
      !!(streamingMessage.thinking || streamingMessage.content);

    return msgCount > 0 || hasStreaming;
  }, [conversationId, streamingMessage, displayMessages]);

  const activeModelName = useMemo(
    () => currentLoadedModelId ?? getSelectedModelId(),
    [isModelReady, modelsRefresh, currentLoadedModelId],
  );

  return useMemo(
    () => ({
      // State
      conversationId,
      conversationTitle,
      isModelReady,
      isGenerating,
      streamingMessage,
      modelError,
      conversationError,
      showCancelOption: showCancelOption && isGenerating,
      thinkingEnabled,
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
      retryLastUserMessage,
      clearConversationError: () => setConversationError(null),

      // Model Actions
      handleLoadModel,
      handleUnloadModel,
      handleAutoLoadLastModel,
      refreshModelsOnFocus,
    }),
    [
      conversationId,
      conversationTitle,
      isModelReady,
      isGenerating,
      streamingMessage,
      modelError,
      conversationError,
      showCancelOption,
      thinkingEnabled,
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
      retryLastUserMessage,
      handleLoadModel,
      handleUnloadModel,
      handleAutoLoadLastModel,
      refreshModelsOnFocus,
    ],
  );
}
