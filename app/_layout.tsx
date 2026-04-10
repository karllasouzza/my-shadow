import { ThemeProvider } from "@/context/themes";
import { PortalHost } from "@rn-primitives/portal";
import { Tabs } from "expo-router";
import { Clock, Cpu, MessageSquare } from "lucide-react-native";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import "../global.css";

export default function RootLayout() {
  // const [isReady, setIsReady] = useState(false);

  // // T046: Auto-load active model on app launch
  // useEffect(() => {
  //   async function init() {
  //     try {
  //       const manager = getModelManager();
  //       const activeModelId = manager.getActiveModel();
  //       if (activeModelId) {
  //         const model = findModelById(activeModelId);
  //         if (model) {
  //           // Attempt to load the active model
  //           await manager.loadModel(
  //             activeModelId,
  //             `file://${model.filePath}.gguf`,
  //           );
  //         }
  //       }
  //     } catch {
  //       // Auto-load failed — app continues without model
  //     } finally {
  //       setIsReady(true);
  //     }
  //   }
  //   init();
  // }, []);

  // if (!isReady) {
  //   return (
  //     <View className="flex-1 bg-background items-center justify-center">
  //       <Loader2 size={24} color="#3b82f6" />
  //     </View>
  //   );
  // }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
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
                tabBarIcon: ({ color, size }) => (
                  <Cpu size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="history/index"
              options={{
                title: "Histórico",
                tabBarIcon: ({ color, size }) => (
                  <Clock size={size} color={color} />
                ),
              }}
            />
          </Tabs>
          <PortalHost />
          <Toaster />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
