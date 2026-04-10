import * as FileSystem from "expo-file-system/legacy";

export interface DownloadState {
  active: boolean;
  progress: number;
  cancelled: boolean;
}

export interface DownloadedFile {
  uri: string;
  sizeBytes: number;
}

export interface ResumableRef {
  current: FileSystem.DownloadResumable | null;
}
