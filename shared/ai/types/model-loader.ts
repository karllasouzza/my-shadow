import type { AppErrorCode } from "@/shared/utils/app-error";

export interface ModelLoadResult {
  success: boolean;
  error?: string;
  code?: AppErrorCode;
}

export interface AvailableModel {
  id: string;
  displayName: string;
  bytes: string;
  isLoaded: boolean;
  supportsReasoning: boolean;
}
