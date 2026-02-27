export type NavSection = "journals" | "timeline" | "settings";

export type JournalAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  kind: "image" | "file";
};

export type VoiceMemo = {
  id: string;
  name: string;
  dataUrl: string;
  durationSec: number;
  createdAt: string;
};

export type JournalEntry = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  attachments: JournalAttachment[];
  voiceMemos: VoiceMemo[];
};

export type JournalFolder = {
  id: string;
  name: string;
  createdAt: string;
  entries: JournalEntry[];
};

export type JournalState = {
  folders: JournalFolder[];
};
