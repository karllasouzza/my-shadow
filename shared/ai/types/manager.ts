export type ModelType = "gguf" | "bin";

export interface DownloadProgressInfo {
  modelId: string;
  progress: number;
}

export type OnDownloadProgress = (info: DownloadProgressInfo) => void;

export interface DownloadedModelInfo {
  modelId: string;
  localPath: string;
  modelType: ModelType;
}
