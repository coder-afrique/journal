"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  bytesToReadable,
  fileToDataUrl,
  formatDate,
  getState,
  getTheme,
  secondsToClock,
  setState,
  setTheme,
  uid,
} from "@/lib/storage";
import {
  JournalAttachment,
  JournalEntry,
  JournalFolder,
  NavSection,
  VoiceMemo,
} from "@/lib/types";

type ComposerState = {
  title: string;
  content: string;
  files: File[];
  voiceMemos: VoiceMemo[];
};

type JournalsScreen = "home" | "folder" | "compose";

type TimelineEntry = JournalEntry & { folderId: string; folderName: string };

const emptyComposer: ComposerState = {
  title: "",
  content: "",
  files: [],
  voiceMemos: [],
};

export default function Page() {
  const [activeSection, setActiveSection] = useState<NavSection>("journals");
  const [journalsScreen, setJournalsScreen] = useState<JournalsScreen>("home");
  const [folders, setFolders] = useState<JournalFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [composer, setComposer] = useState<ComposerState>(emptyComposer);
  const [error, setError] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const [timelineDetail, setTimelineDetail] = useState<TimelineEntry | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const initial = getState();
    setFolders(initial.folders);
    setSelectedFolderId(initial.folders[0]?.id ?? null);

    const initialTheme = getTheme();
    setThemeState(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  useEffect(() => {
    setState({ folders });
  }, [folders]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  );

  const allEntries = useMemo<TimelineEntry[]>(() => {
    const list = folders.flatMap((folder) =>
      folder.entries.map((entry) => ({
        ...entry,
        folderId: folder.id,
        folderName: folder.name,
      })),
    );
    return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [folders]);

  const folderEntryCount = useMemo(
    () => folders.reduce((sum, folder) => sum + folder.entries.length, 0),
    [folders],
  );

  function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;

    const newFolder: JournalFolder = {
      id: uid(),
      name,
      createdAt: new Date().toISOString(),
      entries: [],
    };

    setFolders((current) => [newFolder, ...current]);
    setSelectedFolderId(newFolder.id);
    setNewFolderName("");
  }

  async function saveEntry() {
    if (!selectedFolder) {
      setError("Create and select a journal folder first.");
      return;
    }

    const title = composer.title.trim();
    const content = composer.content.trim();
    if (!title && !content && composer.files.length === 0 && composer.voiceMemos.length === 0) {
      setError("Add at least text, a file, or a voice memo.");
      return;
    }

    setError("");
    setIsSavingEntry(true);

    try {
      const attachments: JournalAttachment[] = await Promise.all(
        composer.files.map(async (file) => ({
          id: uid(),
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: await fileToDataUrl(file),
          kind: file.type.startsWith("image/") ? "image" : "file",
        })),
      );

      const entry: JournalEntry = {
        id: uid(),
        title: title || "Untitled",
        content,
        createdAt: new Date().toISOString(),
        attachments,
        voiceMemos: composer.voiceMemos,
      };

      setFolders((current) =>
        current.map((folder) =>
          folder.id === selectedFolder.id
            ? { ...folder, entries: [entry, ...folder.entries] }
            : folder,
        ),
      );

      setComposer(emptyComposer);
      setJournalsScreen("folder");
    } catch {
      setError("Could not save this entry.");
    } finally {
      setIsSavingEntry(false);
    }
  }

  async function startRecording() {
    if (isRecording) return;
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], `memo-${Date.now()}.webm`, { type: "audio/webm" });
        const dataUrl = await fileToDataUrl(file);
        const durationSec = (Date.now() - startTimeRef.current) / 1000;

        setComposer((current) => ({
          ...current,
          voiceMemos: [
            {
              id: uid(),
              name: `Voice memo ${current.voiceMemos.length + 1}`,
              dataUrl,
              durationSec,
              createdAt: new Date().toISOString(),
            },
            ...current.voiceMemos,
          ],
        }));

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setError("Microphone access denied or unavailable.");
      setIsRecording(false);
    }
  }

  function stopRecording() {
    if (!recorderRef.current || recorderRef.current.state !== "recording") return;
    recorderRef.current.stop();
    setIsRecording(false);
  }

  function openFolder(folderId: string) {
    setSelectedFolderId(folderId);
    setJournalsScreen("folder");
  }

  function startNewEntry(folderId?: string) {
    if (folderId) setSelectedFolderId(folderId);
    setComposer(emptyComposer);
    setError("");
    setJournalsScreen("compose");
  }

  function appendSelectedFiles(fileList: FileList | null) {
    const nextFiles = Array.from(fileList ?? []);
    if (nextFiles.length === 0) return;
    setComposer((current) => ({ ...current, files: [...current.files, ...nextFiles] }));
  }

  function toggleThemeEnabled(enabled: boolean) {
    const next = enabled ? "dark" : "light";
    setThemeState(next);
    setTheme(next);
    document.documentElement.classList.toggle("dark", enabled);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 pb-36 pt-6 sm:px-6 sm:pt-8 lg:px-10">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Progressive Journal</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Capture your life, softly
          </h1>
        </div>
        <div className="w-fit rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-muted)]">
          {folderEntryCount} notes
        </div>
      </header>

      {activeSection === "journals" && (
        <section className="space-y-6">
          {journalsScreen === "home" && (
            <>
              <div className="gradient-card relative overflow-hidden rounded-[30px] p-5 text-white shadow-[0_18px_44px_rgba(19,93,206,0.34)] sm:p-7">
                <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/25 blur-2xl" />
                <div className="absolute -bottom-14 right-10 h-40 w-40 rounded-full bg-[#8ff0cd]/40 blur-3xl" />
                <div className="absolute left-10 top-10 h-20 w-20 rounded-full bg-[#ffc977]/35 blur-2xl" />
                <div className="relative z-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/80">Today</p>
                    <h2 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
                      Build momentum with one reflective entry
                    </h2>
                    <p className="mt-2 text-sm text-white/85">Keep it private. Everything stays on this device.</p>
                    <button
                      type="button"
                      onClick={() => startNewEntry(selectedFolderId ?? folders[0]?.id)}
                      className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0c2f68]"
                    >
                      Start New Entry
                    </button>
                  </div>
                  <HeroIllustration />
                </div>
              </div>

              <div className="glass rounded-3xl border p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Create Journal Folder</h3>
                  <p className="text-xs text-[var(--text-muted)]">Organize by themes</p>
                </div>
                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    className="w-full rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 outline-none ring-[var(--accent)] transition focus:ring-2"
                    placeholder="e.g. Growth, Travel, Ideas"
                    value={newFolderName}
                    onChange={(event) => setNewFolderName(event.target.value)}
                  />
                  <button
                    className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-medium text-white transition hover:opacity-90"
                    onClick={createFolder}
                    type="button"
                  >
                    Add Folder
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {folders.map((folder, index) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => openFolder(folder.id)}
                    className="group rounded-3xl border bg-[var(--surface)] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent-soft)]"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <FolderMark />
                      <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">Folder {index + 1}</p>
                    </div>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight">{folder.name}</h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{folder.entries.length} entries</p>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="rounded-xl bg-[var(--surface-pop)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                        Open
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">{formatDate(folder.createdAt)}</span>
                    </div>
                  </button>
                ))}

                {folders.length === 0 && (
                  <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-[var(--text-muted)]">
                    No folders yet. Create one to start journaling.
                  </div>
                )}
              </div>
            </>
          )}

          {journalsScreen === "folder" && selectedFolder && (
            <div className="space-y-4">
              <div className="glass rounded-3xl border p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      className="text-sm text-[var(--text-muted)]"
                      onClick={() => setJournalsScreen("home")}
                    >
                      Back to folders
                    </button>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight">{selectedFolder.name}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => startNewEntry(selectedFolder.id)}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                  >
                    New Entry
                  </button>
                </div>
              </div>

              <div className="grid gap-4">
                {selectedFolder.entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="glass rounded-3xl border p-5 text-left"
                    onClick={() => {
                      setActiveSection("timeline");
                      setTimelineDetail({ ...entry, folderId: selectedFolder.id, folderName: selectedFolder.name });
                    }}
                  >
                    <h3 className="text-lg font-semibold">{entry.title}</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(entry.createdAt)}</p>
                    <p className="mt-3 line-clamp-2 text-sm text-[var(--text-muted)]">
                      {entry.content || "No text in this note."}
                    </p>
                  </button>
                ))}
                {selectedFolder.entries.length === 0 && (
                  <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-[var(--text-muted)]">
                    Empty folder. Add your first note.
                  </div>
                )}
              </div>
            </div>
          )}

          {journalsScreen === "compose" && (
            <div className="glass mx-auto w-full max-w-4xl rounded-3xl border p-5 md:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <button
                    type="button"
                    className="text-sm text-[var(--text-muted)]"
                    onClick={() => setJournalsScreen(selectedFolder ? "folder" : "home")}
                  >
                    Back
                  </button>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">New Entry</h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    {selectedFolder ? `Saving in ${selectedFolder.name}` : "Choose a folder first"}
                  </p>
                </div>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
                    isRecording ? "bg-red-500" : "bg-[var(--accent)]"
                  }`}
                >
                  {isRecording ? "Stop Voice Memo" : "Record Voice Memo"}
                </button>
              </div>

              <div className="space-y-3">
                <input
                  className="w-full rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 outline-none ring-[var(--accent)] transition focus:ring-2"
                  placeholder="Entry title"
                  value={composer.title}
                  onChange={(event) => setComposer((current) => ({ ...current, title: event.target.value }))}
                />
                <textarea
                  className="h-36 w-full resize-none rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 outline-none ring-[var(--accent)] transition focus:ring-2"
                  placeholder="What happened today?"
                  value={composer.content}
                  onChange={(event) => setComposer((current) => ({ ...current, content: event.target.value }))}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--surface-pop)] px-4 py-3 text-left"
                  >
                    <p className="font-medium text-[var(--accent)]">Take Photo</p>
                    <p className="text-sm text-[var(--text-muted)]">Use your device camera instantly</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-left"
                  >
                    <p className="font-medium">Add Files & Images</p>
                    <p className="text-sm text-[var(--text-muted)]">Attach documents, images, and media</p>
                  </button>
                </div>

                <input
                  ref={cameraInputRef}
                  className="hidden"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    appendSelectedFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />

                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  multiple
                  onChange={(event) => {
                    appendSelectedFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </div>

              {(composer.files.length > 0 || composer.voiceMemos.length > 0) && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {composer.files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="rounded-2xl border bg-[var(--surface)] p-3 text-sm">
                      <p className="truncate font-medium">{file.name}</p>
                      <p className="text-[var(--text-muted)]">{bytesToReadable(file.size)}</p>
                    </div>
                  ))}

                  {composer.voiceMemos.map((memo) => (
                    <div key={memo.id} className="rounded-2xl border bg-[var(--surface)] p-3 text-sm">
                      <p className="font-medium">{memo.name}</p>
                      <p className="text-[var(--text-muted)]">{secondsToClock(memo.durationSec)}</p>
                      <audio className="mt-2 w-full" controls src={memo.dataUrl} />
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

              <button
                type="button"
                onClick={saveEntry}
                disabled={isSavingEntry}
                className="mt-4 w-full rounded-2xl bg-[var(--text)] px-5 py-3 font-medium text-[var(--bg)] transition hover:opacity-90 disabled:opacity-50"
              >
                {isSavingEntry ? "Saving..." : "Save Entry"}
              </button>
            </div>
          )}
        </section>
      )}

      {activeSection === "timeline" && (
        <section className="space-y-4">
          <div className="glass rounded-3xl border p-5">
            <h2 className="text-2xl font-semibold tracking-tight">Timeline</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Quick snapshots. Tap any note to open full details.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {allEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTimelineDetail(entry)}
                className="glass rounded-3xl border p-5 text-left transition hover:border-[var(--accent-soft)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">{entry.folderName}</p>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight">{entry.title}</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(entry.createdAt)}</p>
                  </div>
                  <span className="rounded-full bg-[var(--surface-pop)] px-2 py-1 text-xs text-[var(--accent)]">
                    Open
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-[var(--text-muted)]">{summary(entry.content)}</p>
                <p className="mt-3 text-xs text-[var(--text-muted)]">{entry.attachments.length} files | {entry.voiceMemos.length} memos</p>
              </button>
            ))}

            {allEntries.length === 0 && (
              <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-[var(--text-muted)]">
                Your timeline will appear here once you add entries.
              </div>
            )}
          </div>
        </section>
      )}

      {activeSection === "settings" && (
        <section className="space-y-4">
          <div className="glass relative overflow-hidden rounded-3xl border p-6">
            <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-[color-mix(in_srgb,var(--accent)_28%,transparent)] blur-2xl" />
            <div className="absolute -bottom-10 right-14 h-20 w-20 rounded-full bg-[color-mix(in_srgb,var(--mint)_28%,transparent)] blur-2xl" />
            <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Personalize your journaling experience.</p>
          </div>

          <div className="glass rounded-3xl border p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">Dark Appearance</p>
                <p className="text-sm text-[var(--text-muted)]">Toggle instantly between light and dark styles</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={theme === "dark"}
                onClick={() => toggleThemeEnabled(theme !== "dark")}
                className={`relative h-8 w-14 rounded-full transition ${
                  theme === "dark" ? "bg-[var(--accent)]" : "bg-[var(--surface-soft)]"
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
                    theme === "dark" ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface-pop)] p-5">
            <p className="text-sm font-medium text-[var(--accent)]">Privacy</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Your journals are stored only in this browser via localStorage. No cloud sync is active.
            </p>
          </div>
        </section>
      )}

      {timelineDetail && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 p-0 sm:p-3 md:items-center" onClick={() => setTimelineDetail(null)}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">{timelineDetail.folderName}</p>
                <h3 className="mt-1 text-xl font-semibold">{timelineDetail.title}</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(timelineDetail.createdAt)}</p>
              </div>
              <button type="button" className="text-sm text-[var(--text-muted)]" onClick={() => setTimelineDetail(null)}>
                Close
              </button>
            </div>
            <EntryDetails entry={timelineDetail} />
          </div>
        </div>
      )}

      <nav className="fixed bottom-[max(0.85rem,var(--safe-bottom))] left-1/2 z-50 w-[min(95%,640px)] -translate-x-1/2 rounded-3xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
        <ul className="grid grid-cols-3 gap-2">
          <NavButton
            active={activeSection === "journals"}
            label="Journals"
            onClick={() => {
              setActiveSection("journals");
              setJournalsScreen("home");
            }}
          />
          <NavButton active={activeSection === "timeline"} label="Timeline" onClick={() => setActiveSection("timeline")} />
          <NavButton active={activeSection === "settings"} label="Settings" onClick={() => setActiveSection("settings")} />
        </ul>
      </nav>
    </main>
  );
}

function NavButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full rounded-2xl px-4 py-3 text-sm font-medium transition ${
          active
            ? "bg-[var(--text)] text-[var(--bg)]"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
        }`}
      >
        {label}
      </button>
    </li>
  );
}

function HeroIllustration() {
  return (
    <svg viewBox="0 0 330 220" className="h-40 w-full max-w-[320px] justify-self-end" aria-hidden="true">
      <defs>
        <linearGradient id="sheet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="100%" stopColor="rgba(240,248,255,0.9)" />
        </linearGradient>
      </defs>
      <circle cx="248" cy="54" r="42" fill="rgba(255,255,255,0.22)" />
      <circle cx="76" cy="184" r="30" fill="rgba(255,199,95,0.32)" />
      <rect x="62" y="36" width="206" height="146" rx="28" fill="url(#sheet)" />
      <rect x="88" y="76" width="118" height="10" rx="5" fill="#4FA2FF" />
      <rect x="88" y="98" width="150" height="10" rx="5" fill="#8AC4FF" />
      <rect x="88" y="120" width="94" height="10" rx="5" fill="#56D9A4" />
      <circle cx="230" cy="140" r="22" fill="#0A84FF" />
      <path d="M220 140l8 8 14-16" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FolderMark() {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--accent)_18%,white)]">
      <span className="h-3 w-4 rounded-sm border border-[color-mix(in_srgb,var(--accent)_60%,white)]" />
    </span>
  );
}

function EntryDetails({ entry }: { entry: JournalEntry }) {
  return (
    <article>
      {entry.content && <p className="whitespace-pre-wrap text-sm leading-relaxed">{entry.content}</p>}

      {entry.attachments.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {entry.attachments.map((file) =>
            file.kind === "image" ? (
              <a
                key={file.id}
                className="block overflow-hidden rounded-2xl border"
                href={file.dataUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Image
                  src={file.dataUrl}
                  alt={file.name}
                  width={640}
                  height={320}
                  unoptimized
                  className="h-40 w-full object-cover"
                />
              </a>
            ) : (
              <a
                key={file.id}
                className="rounded-2xl border bg-[var(--surface)] p-3 text-sm"
                href={file.dataUrl}
                download={file.name}
              >
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-[var(--text-muted)]">{bytesToReadable(file.size)}</p>
              </a>
            ),
          )}
        </div>
      )}

      {entry.voiceMemos.length > 0 && (
        <div className="mt-4 space-y-3">
          {entry.voiceMemos.map((memo) => (
            <div key={memo.id} className="rounded-2xl border bg-[var(--surface)] p-3">
              <p className="mb-1 text-sm font-medium">{memo.name}</p>
              <p className="mb-2 text-xs text-[var(--text-muted)]">{secondsToClock(memo.durationSec)}</p>
              <audio controls className="w-full" src={memo.dataUrl} />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function summary(content: string) {
  if (!content.trim()) return "Attachment-only entry";
  return content.length > 140 ? `${content.slice(0, 140)}...` : content;
}
