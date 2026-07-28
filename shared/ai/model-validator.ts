import { DeviceProfile } from "@/shared/device";
import { Result, ok } from "@/shared/utils/app-error";
import * as FileSystem from "expo-file-system/legacy";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export async function validateModel(
  _modelId: string,
  path: string,
  fileSizeBytes: number,
  device: DeviceProfile,
): Promise<Result<ValidationResult>> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    errors.push("Arquivo do modelo não encontrado");
  }

  if (fileSizeBytes <= 0) {
    errors.push("Tamanho do modelo inválido");
  }

  const requiredGB = (fileSizeBytes * 1.5) / 1024 ** 3;
  if (requiredGB > device.availableRAM * 0.75) {
    errors.push(
      `Modelo precisa de ~${requiredGB.toFixed(1)}GB. Disponível: ${device.availableRAM.toFixed(1)}GB.`,
    );
  }

  if (fileSizeBytes > device.recommended.maxModelSize) {
    warnings.push("Modelo maior que o recomendado para este dispositivo");
  }

  if (device.tier === "low" && fileSizeBytes > 1024 ** 3) {
    warnings.push("Modelo pode ser lento em dispositivos modestos");
  }

  return ok({
    valid: errors.length === 0,
    errors,
    warnings,
  });
}
