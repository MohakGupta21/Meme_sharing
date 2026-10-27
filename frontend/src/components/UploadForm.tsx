import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadMeme } from "../api/memes";
import { apiErrorMessage } from "../api/axiosClient";
import { useObjectUrl } from "../hooks/useObjectUrl";
import { PlusIcon, SparkleIcon } from "./icons";

export function UploadForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const preview = useObjectUrl(file);
  const isVideo = file?.type.startsWith("video/");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  // Keep the feed behind the sheet from scrolling while it is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Pick a file");
      return uploadMeme(file, { title, description }, setProgress);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      onDone();
    },
    onError: (e) => setError(apiErrorMessage(e, "Upload failed")),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onDone}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New meme"
        className="flex max-h-[92dvh] w-full max-w-lg animate-sheet-up flex-col rounded-t-3xl bg-white shadow-2xl sm:max-h-[90vh] sm:animate-fade-in sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" />
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-3 sm:pt-5">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <SparkleIcon className="text-gradient text-xl" />
            New meme
          </h2>
          <button
            onClick={onDone}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-1">
          {preview ? (
            <div className="relative mb-3 overflow-hidden rounded-2xl bg-slate-950">
              {isVideo ? (
                <video
                  src={preview}
                  controls
                  playsInline
                  className="max-h-[40dvh] w-full sm:max-h-72"
                />
              ) : (
                <img
                  src={preview}
                  alt="preview"
                  className="max-h-[40dvh] w-full object-contain sm:max-h-72"
                />
              )}
              <button
                onClick={() => setFile(null)}
                className="absolute right-2 top-2 rounded-full bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-slate-900"
              >
                Replace
              </button>
            </div>
          ) : (
            <label className="mb-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center transition active:bg-brand-50/60 sm:py-10 hover:border-brand-300 hover:bg-brand-50/40">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-brand-500 shadow-sm">
                <PlusIcon className="text-xl" />
              </span>
              <span className="text-sm font-semibold text-slate-700">
                <span className="sm:hidden">Tap to pick a photo or video</span>
                <span className="hidden sm:inline">Choose an image or video</span>
              </span>
              <span className="text-xs text-slate-400">JPG, PNG, GIF, WebP, MP4, WebM, MOV</span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => {
                  setError(null);
                  setFile(e.target.files?.[0] ?? null);
                }}
                className="hidden"
              />
            </label>
          )}

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            maxLength={140}
            className="input mb-2"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            maxLength={1000}
            rows={3}
            className="input mb-3 resize-none"
          />

          {upload.isPending && (
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {error && (
            <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-end sm:border-0 sm:pb-5">
          <button onClick={onDone} className="btn btn-ghost flex-1 sm:flex-none">
            Cancel
          </button>
          <button
            onClick={() => upload.mutate()}
            disabled={!file || upload.isPending}
            className="btn btn-primary flex-[2] sm:flex-none"
          >
            {upload.isPending ? "Posting…" : "Post meme"}
          </button>
        </div>
      </div>
    </div>
  );
}
