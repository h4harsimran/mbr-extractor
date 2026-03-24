import { useRef, useState, useCallback } from "react";

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  isDisabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({
  onFileSelected,
  isDisabled,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file.type !== "application/pdf") {
        alert("Please upload a PDF file.");
        return;
      }
      setSelectedFile(file);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const startExtraction = useCallback(() => {
    if (selectedFile) {
      onFileSelected(selectedFile);
    }
  }, [selectedFile, onFileSelected]);

  return (
    <div className="card card-lg fade-in">
      <div
        className={`upload-zone ${dragOver ? "drag-over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📄</div>
        <div className="upload-title">
          Drop your MBR PDF here, or click to browse
        </div>
        <div className="upload-hint">
          Supports scanned Master Batch Record PDFs up to 100+ pages
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="upload-input"
          onChange={handleChange}
          id="pdf-upload-input"
        />
      </div>

      {selectedFile && (
        <div className="file-selected fade-in">
          <span className="file-icon">📑</span>
          <div className="file-info">
            <div className="file-name">{selectedFile.name}</div>
            <div className="file-size">
              {formatFileSize(selectedFile.size)}
            </div>
          </div>
          <button
            className="file-remove"
            onClick={(e) => {
              e.stopPropagation();
              clearFile();
            }}
            title="Remove file"
          >
            ✕
          </button>
        </div>
      )}

      <button
        className="btn btn-primary btn-lg"
        disabled={!selectedFile || isDisabled}
        onClick={startExtraction}
        id="start-extraction-btn"
      >
        {isDisabled ? (
          <>
            <span className="spinner" /> Processing…
          </>
        ) : (
          "🚀 Extract Data"
        )}
      </button>
    </div>
  );
}
