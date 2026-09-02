import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadMeme } from "../api/memes";
import { apiErrorMessage } from "../api/axiosClient";
import { useObjectUrl } from "../hooks/useObjectUrl";

export function UploadForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const preview = useObjectUrl(file);
  const isVideo = file?.type.startsWith("video/");

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <h2 className="mb-3 text-lg font-semibold">New meme</h2>

        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => {
            setError(null);
            setFile(e.target.files?.[0] ?? null);
          }}
          className="mb-3 block w-full text-sm"
        />

        {preview &&
          (isVideo ? (
            <video src={preview} controls className="mb-3 max-h-60 w-full rounded" />
          ) : (
            <img src={preview} alt="preview" className="mb-3 max-h-60 w-full rounded object-contain" />
          ))}

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          maxLength={140}
          className="mb-2 w-full rounded-md border px-3 py-2 text-sm"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          maxLength={1000}
          className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
        />

        {upload.isPending && (
          <div className="mb-3 h-2 w-full overflow-hidden rounded bg-gray-200">
            <div className="h-full bg-indigo-600" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onDone} className="rounded-md px-4 py-2 text-sm text-gray-600">
            Cancel
          </button>
          <button
            onClick={() => upload.mutate()}
            disabled={!file || upload.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {upload.isPending ? "Uploading…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
