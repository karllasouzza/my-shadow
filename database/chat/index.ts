import { Observable, observable } from "@legendapp/state";
import { ObservablePersistMMKV } from "@legendapp/state/persist-plugins/mmkv";
import { synced } from "@legendapp/state/sync";

import { ChatConversation } from "./types";

interface IChatState {
  conversations: Map<string, ChatConversation>;
  lastModelId: string | null;
  isReasoningEnabled?: boolean;
}

const chatState$: Observable<IChatState> = observable(
  synced({
    initial: {
      conversations: new Map<string, ChatConversation>(),
      lastModelId: null,
      isReasoningEnabled: false,
    },
    persist: {
      name: "chat_conversations",
      plugin: ObservablePersistMMKV,
      retrySync: true,
    },
  }),
) as Observable<IChatState>;

export default chatState$;
