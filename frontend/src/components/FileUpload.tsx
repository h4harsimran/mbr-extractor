import { useRef, useState } from "react";

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  error?: string | null;
}

export default function FileUpload({ onFileSelected, error }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (file) onFileSelected(file);
  };

  return (
    <div className="card card-lg fade-in">
      <div
        className={`upload-zone ${isDragging ? "drag-over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFile(event.dataTransfer.files[0]);
        }}
      >
        <div className="upload-icon">📄</div>
        <h2 className="upload-title">Upload an MBR PDF</h2>
        <p className="upload-hint">Select a PDF to review extraction cost before any page image is sent to the API.</p>
        <input
          ref={inputRef}
          className="upload-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>
      {error && <div className="error-banner upload-error">{error}</div>}
      <p className="upload-hint upload-privacy-note">
        Privacy note: uploaded PDFs stay in your browser, but rendered page images are sent to the Worker and Gemini during extraction.
      </p>
    </div>
  );
}
