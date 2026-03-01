export type NavSection = "journals" | "timeline" | "settings";

export type LinkPreview = {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

export type JournalAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  kind: "image" | "file" | "link";
  url?: string;
  preview?: LinkPreview;
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
