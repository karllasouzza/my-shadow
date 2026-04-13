export interface DownloadProgressInfo {
  modelId: string;
  progress: number;
}

export type OnDownloadProgress = (info: DownloadProgressInfo) => void;
