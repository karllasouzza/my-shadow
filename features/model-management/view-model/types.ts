export interface ModelItemStatus {
  status:
    | "not-downloaded"
    | "downloading"
    | "downloaded"
    | "loading"
    | "loaded"
    | "failed";
  progress: number;
  isLowRam: boolean;
}
