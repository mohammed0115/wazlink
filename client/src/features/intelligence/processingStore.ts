import { useSyncExternalStore } from "react";
import type { ProcessingState } from "./simulation";

let snapshot: ProcessingState | null = null;
const listeners = new Set<() => void>();

export function subscribeProcessing(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProcessingSnapshot(): ProcessingState | null {
  return snapshot;
}

export function setProcessingSnapshot(value: ProcessingState | null): void {
  snapshot = value;
  listeners.forEach((listener) => listener());
}

export function useIntelligenceProcessing(): ProcessingState | null {
  return useSyncExternalStore(subscribeProcessing, getProcessingSnapshot, () => null);
}
