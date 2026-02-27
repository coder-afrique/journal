import { JournalState } from "@/lib/types";

const JOURNAL_KEY = "progressive_journal_state_v1";
const THEME_KEY = "progressive_journal_theme_v1";

export const defaultState: JournalState = { folders: [] };

export function getState(): JournalState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = window.localStorage.getItem(JOURNAL_KEY);
    if (!raw) return defaultState;
    return JSON.parse(raw) as JournalState;
  } catch {
    return defaultState;
  }
}

export function setState(state: JournalState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(state));
}

export function getTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(THEME_KEY);
  return saved === "dark" ? "dark" : "light";
}

export function setTheme(theme: "light" | "dark") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, theme);
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function bytesToReadable(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(input: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(input));
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export function secondsToClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}