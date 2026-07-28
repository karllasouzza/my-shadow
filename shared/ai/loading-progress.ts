export type LoadingStage =
  | "validating"
  | "checking-memory"
  | "initializing"
  | "loading-weights"
  | "warming-up"
  | "ready"
  | "error";

export interface LoadingProgress {
  stage: LoadingStage;
  percent: number;
  message: string;
}

export class LoadingProgressTracker {
  private listeners: ((progress: LoadingProgress) => void)[] = [];
  private current: LoadingProgress = {
    stage: "validating",
    percent: 0,
    message: "Validando modelo...",
  };

  subscribe(listener: (progress: LoadingProgress) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  update(stage: LoadingStage, percent: number, message: string): void {
    this.current = { stage, percent, message };
    this.listeners.forEach((l) => l(this.current));
  }

  getProgress(): LoadingProgress {
    return this.current;
  }
}
