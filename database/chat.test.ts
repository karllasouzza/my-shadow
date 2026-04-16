type MockStoreState = Map<string, string>;

const stores = new Map<string, MockStoreState>();

class MockMMKV {
  private readonly state: MockStoreState;

  constructor(id: string) {
    if (!stores.has(id)) {
      stores.set(id, new Map());
    }

    this.state = stores.get(id)!;
  }

  set(key: string, value: string) {
    this.state.set(key, value);
  }

  getString(key: string) {
    return this.state.get(key);
  }

  getAllKeys() {
    return [...this.state.keys()];
  }
}

function mockNativeModules() {
  jest.doMock("react-native-mmkv", () => ({
    createMMKV: ({ id }: { id: string }) => new MockMMKV(id),
  }));

  jest.doMock("expo-crypto", () => ({
    randomUUID: () => "mocked-conversation-id",
  }));
}

function loadChatDatabase() {
  return require("./chat") as typeof import("./chat");
}

function getChatStore() {
  const store = stores.get("chat_conversations");
  if (!store) {
    throw new Error("Expected chat_conversations store to be initialized");
  }

  return store;
}

describe("chat history persistence", () => {
  beforeEach(() => {
    jest.resetModules();
    stores.clear();
    mockNativeModules();
  });

  it("creates history snippets from persisted message content only", () => {
    const chatDb = loadChatDatabase();

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

  it("rebuilds stale index entries from persisted conversations", () => {
    mockNativeModules();
    const store = new MockMMKV("chat_conversations");

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

    const chatDb = loadChatDatabase();
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

  it("returns an empty preview when the latest persisted message has no content", () => {
    const chatDb = loadChatDatabase();

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
