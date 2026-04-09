/**
 * T005: Chat stack navigator layout
 *
 * Provides stack navigation within the chat route group:
 * - index.tsx (Chat screen) — root
 * - history.tsx (History screen) — pushed from header button
 */
import { Stack } from "expo-router";

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
      }}
    />
  );
}
