"use client";

import { useCallback, useRef, useState } from "react";

interface UploadDropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

/** Drag-and-drop (or click) image picker for the visual search query. */
export function UploadDropzone({ onFile, disabled }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = useCallback(
    (file: File | undefined) => {
      if (file && file.type.startsWith("image/")) onFile(file);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) accept(e.dataTransfer.files[0]);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={
        "cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition " +
        (disabled
          ? "cursor-not-allowed border-ink-700 opacity-50"
          : dragging
            ? "border-gold bg-gold/10"
            : "border-ink-600 hover:border-gold/60 hover:bg-ink-800")
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => accept(e.target.files?.[0])}
      />
      <p className="font-mono text-sm text-bone-200">Drop a photo here</p>
      <p className="mt-1 text-xs text-bone-400">
        or click to browse — find places that look like it
      </p>
    </div>
  );
}
