import { beforeEach, describe, expect, it } from "bun:test";

async function mockNativeModules() {
  // Preloaded setup.ts registers Bun.mock.module for these modules. If Bun.mock
  // isn't available, attempt a best-effort fallback by stubbing required
  // module exports before loading the tested module.
  if (
    typeof Bun !== "undefined" &&
    (Bun as any).mock &&
    (Bun as any).mock.module
  ) {
    // Bun.mock.module was likely registered in preload; nothing else to do.
    return;
  }

  try {
    const mmkv = await import("react-native-mmkv");
    (mmkv as any).createMMKV = ({ id }: { id: string }) => {
      const stores = (globalThis as any).__MMKV_STORES__ as Map<
        string,
        Map<string, string>
      >;
      if (!stores.has(id)) stores.set(id, new Map());
      const state = stores.get(id)!;
      return {
        set: (k: string, v: string) => state.set(k, v),
        getString: (k: string) => state.get(k),
        getAllKeys: () => [...state.keys()],
      };
    };
  } catch {
    // ignore
  }

  try {
    const expoCrypto = await import("expo-crypto");
    (expoCrypto as any).randomUUID = () => "mocked-conversation-id";
  } catch {
    // ignore
  }
}

async function loadChatDatabase() {
  return (await import("../../database/chat")) as typeof import("../../database/chat");
}

function getChatStore() {
  const stores = (globalThis as any).__MMKV_STORES__ as
    | Map<string, Map<string, string>>
    | undefined;
  const store = stores?.get("chat_conversations");
  if (!store) {
    throw new Error("Expected chat_conversations store to be initialized");
  }

  return store;
}

describe("chat history persistence", () => {
  beforeEach(async () => {
    // Clear test-internal stores
    const globalStores = (globalThis as any).__MMKV_STORES__ as
      | Map<string, Map<string, string>>
      | undefined;
    if (globalStores) globalStores.clear();

    // Ensure mocks are registered (setup.ts preloads Bun.mock.module). If Bun.mock isn't
    // available, mockNativeModules() will attempt a fallback.
    await mockNativeModules();
  });

  it("creates history snippets from persisted message content only", async () => {
    const chatDb = await loadChatDatabase();

    const saveResult = chatDb.saveConversation({
      id: "conversation-1",
      title: "Conversa 1",
      createdAt: "2026-04-15T00:00:00.000Z",
      updatedAt: "2026-04-15T00:05:00.000Z",
      modelId: "model-1",
      messages: [
        {
          role: "assistant",
          content: "Resposta final [cancelado]",
          reasoning_content: "raciocinio privado",
        },
      ],
    });

    expect(saveResult.success).toBe(true);

    const listResult = chatDb.listConversations();

    expect(listResult).toEqual({
      success: true,
      data: [
        {
          id: "conversation-1",
          title: "Conversa 1",
          updatedAt: "2026-04-15T00:05:00.000Z",
          lastMessageSnippet: "Resposta final",
        },
      ],
    });
  });

  it("rebuilds stale index entries from persisted conversations", async () => {
    mockNativeModules();
    const stores = (globalThis as any).__MMKV_STORES__ as
      | Map<string, Map<string, string>>
      | undefined;
    if (!stores) throw new Error("MMKV stores not initialized");
    if (!stores.has("chat_conversations"))
      stores.set("chat_conversations", new Map());
    const store = stores.get("chat_conversations")!;

    store.set(
      "chat:conversation-2",
      JSON.stringify({
        id: "conversation-2",
        title: "Conversa 2",
        createdAt: "2026-04-15T00:00:00.000Z",
        updatedAt: "2026-04-15T00:10:00.000Z",
        modelId: "model-1",
        messages: [
          {
            role: "assistant",
            content: "Somente o conteudo visivel",
            reasoning_content: "segredo antigo",
          },
        ],
      }),
    );
    store.set(
      "chat:index",
      JSON.stringify([
        {
          id: "conversation-2",
          title: "Conversa 2",
          updatedAt: "2026-04-15T00:10:00.000Z",
          lastMessageSnippet: "segredo antigo",
        },
      ]),
    );

    const chatDb = await loadChatDatabase();
    const listResult = chatDb.listConversations();

    expect(listResult).toEqual({
      success: true,
      data: [
        {
          id: "conversation-2",
          title: "Conversa 2",
          updatedAt: "2026-04-15T00:10:00.000Z",
          lastMessageSnippet: "Somente o conteudo visivel",
        },
      ],
    });
    expect(JSON.parse(getChatStore().get("chat:index") ?? "[]")).toEqual([
      {
        id: "conversation-2",
        title: "Conversa 2",
        updatedAt: "2026-04-15T00:10:00.000Z",
        lastMessageSnippet: "Somente o conteudo visivel",
      },
    ]);
  });

  it("returns an empty preview when the latest persisted message has no content", async () => {
    const chatDb = await loadChatDatabase();

    const saveResult = chatDb.saveConversation({
      id: "conversation-3",
      title: "Conversa 3",
      createdAt: "2026-04-15T00:00:00.000Z",
      updatedAt: "2026-04-15T00:15:00.000Z",
      modelId: "model-1",
      messages: [
        {
          role: "assistant",
          content: "",
          reasoning_content: "apenas reasoning",
        },
      ],
    });

    expect(saveResult.success).toBe(true);
    expect(chatDb.listConversations()).toEqual({
      success: true,
      data: [
        {
          id: "conversation-3",
          title: "Conversa 3",
          updatedAt: "2026-04-15T00:15:00.000Z",
          lastMessageSnippet: "",
        },
      ],
    });
  });
});
