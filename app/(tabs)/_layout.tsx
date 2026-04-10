/**
 * T008: Bottom tab navigator layout
 *
 * 3 tabs: Chat (root), Models (Model Management), History (Chat History)
 */
import { findModelById } from "@/shared/ai/model-catalog";
import { getModelManager } from "@/shared/ai/model-manager";
import { Tabs } from "expo-router";
import { Clock, Cpu, Loader2, MessageSquare, View } from "lucide-react-native";
import { useEffect, useState } from "react";

export default function TabsLayout() {
  const [isReady, setIsReady] = useState(false);

  // T046: Auto-load active model on app launch
  useEffect(() => {
    async function init() {
      try {
        const manager = getModelManager();
        const activeModelId = manager.getActiveModel();
        if (activeModelId) {
          const model = findModelById(activeModelId);
          if (model) {
            // Attempt to load the active model
            await manager.loadModel(
              activeModelId,
              `file://${activeModelId}.gguf`,
            );
          }
        }
      } catch {
        // Auto-load failed — app continues without model
      } finally {
        setIsReady(true);
      }
    }
    init();
  }, []);

  if (!isReady) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Loader2 size={24} color="#3b82f6" />
      </View>
    );
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: {
          backgroundColor: "#111827",
          borderTopColor: "#374151",
        },
      }}
      initialRouteName="chat/index"
    >
      <Tabs.Screen
        name="chat/index"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }) => (
            <MessageSquare size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="models/index"
        options={{
          title: "Modelos",
          tabBarIcon: ({ color, size }) => <Cpu size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history/index"
        options={{
          title: "Histórico",
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
