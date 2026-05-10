import { TextEngine } from "./engine";

let instance: TextEngine | null = null;

export function getTextEngine(): TextEngine {
  return (instance ??= new TextEngine());
}
