import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { VoiceInputStatus } from "@/features/chat/view-model/hooks/useVoiceInput";
import { Mic } from "lucide-react-native";

const ACCESSIBILITY_LABELS: Record<VoiceInputStatus, string> = {
  idle: "Gravar mensagem de voz",
  recording: "Parar gravação",
  processing: "Processando gravação",
};

interface VoiceInputButtonProps {
  status: VoiceInputStatus;
  isCancelPreview: boolean;
  onTap: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceInputButton({
  status,
  isCancelPreview,
  onTap,
}: VoiceInputButtonProps) {
  const isDisabled = status === "processing";
  const isRecording = status === "recording";

  return (
    <Button
      onPress={onTap}
      disabled={isDisabled}
      accessibilityLabel={ACCESSIBILITY_LABELS[status]}
      variant={isRecording ? "default" : "ghost"}
      size="icon"
      className={`${isCancelPreview ? "opacity-50" : ""}`}
    >
      <Icon
        as={Mic}
        size={22}
        className={isRecording ? "text-primary-foreground" : "text-foreground"}
      />
    </Button>
  );
}
