/**
 * NoModelPrompt component
 *
 * Displays an AlertDialog when no Whisper model is loaded, prompting the user
 * to download one. All strings are in Brazilian Portuguese.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Text } from "@/components/ui/text";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NoModelPromptProps {
  visible: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NoModelPrompt({
  visible,
  onConfirm,
  onDismiss,
}: NoModelPromptProps) {
  return (
    <AlertDialog
      open={visible}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Modelo de voz não encontrado</AlertDialogTitle>
          <AlertDialogDescription>
            Nenhum modelo de voz carregado. Deseja baixar um agora?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onPress={onDismiss}>
            <Text>Cancelar</Text>
          </AlertDialogCancel>
          <AlertDialogAction onPress={onConfirm}>
            <Text>Baixar</Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
