import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ScrollView } from "react-native-gesture-handler";

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

const defaultQuickActions: QuickAction[] = [
  {
    id: "explain",
    title: "Explicação",
    subtitle: "Me explique como calcular...",
    onPress: () => {},
  },
  {
    id: "plan",
    title: "Planejamento",
    subtitle: "Crie um plano para...",
    onPress: () => {},
  },
  {
    id: "brainstorm",
    title: "Criatividade",
    subtitle: "Me ajude dê ideias criativas para...",
    onPress: () => {},
  },
];

function QuickActions() {
  return (
    defaultQuickActions.length > 0 && (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-4 pt-3 gap-2"
      >
        {defaultQuickActions.map((action) => (
          <Button
            variant="outline"
            key={action.id}
            onPress={action.onPress}
            className="flex flex-col items-start gap-2 h-16"
            accessibilityRole="button"
            accessibilityLabel={action.title}
          >
            <Text className="text-sm text-foreground font-medium">
              {action.title}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {action.subtitle}
            </Text>
          </Button>
        ))}
      </ScrollView>
    )
  );
}

export default QuickActions;
