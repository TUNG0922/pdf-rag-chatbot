
import { useState } from "react";
import api from "../services/api";
import "./PdfUpload.css";

// Define the response structure from FastAPI
interface UploadResponse {
  message: string;
  document_id: string;
  filename: string;
  total_pages: number;
  total_characters: number;
  total_chunks: number;
  saved_chunks: number;
}

function PdfUpload() {
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [result, setResult] = useState<UploadResponse | null>(null);

  // Handle file selection
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];

    setError("");
    setResult(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Only allow PDF files
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.");
      setFile(null);
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
  };

  // Upload PDF to FastAPI
  const handleUpload = async () => {
    if (!file) {
      setError("Please select a PDF file first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();

      formData.append("file", file);

      const response = await api.post<UploadResponse>(
        "/pdf/upload",
        formData
      );

      setResult(response.data);

      console.log("Upload successful:", response.data);

    } catch (err: unknown) {
      console.error("Upload failed:", err);

      if (typeof err === "object" && err !== null && "response" in err) {
        const axiosError = err as {
          response?: {
            data?: {
              detail?: string;
            };
          };
          message?: string;
        };

        setError(
          axiosError.response?.data?.detail ||
          axiosError.message ||
          "Upload failed. Please try again."
        );
      } else {
        setError("Unable to connect to the backend.");
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">

      <div className="upload-header">
        <h2>Upload Your PDF</h2>
        <p>Upload a document to start asking questions.</p>
      </div>

      <div className="upload-box">

        <div className="upload-icon">
          📄
        </div>

        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          disabled={loading}
        />

        {file && (
          <div className="selected-file">
            <span>Selected file:</span>
            <strong>{file.name}</strong>
            <small>
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </small>
          </div>
        )}

        <button
          className="upload-button"
          onClick={handleUpload}
          disabled={!file || loading}
        >
          {loading ? "Processing PDF..." : "Upload PDF"}
        </button>

      </div>

      {loading && (
        <div className="loading-message">
          Please wait while we process your PDF...
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {result && (
        <div className="success-result">

          <h3>PDF Uploaded Successfully!</h3>

          <p><strong>Filename:</strong> {result.filename}</p>

          <p><strong>Document ID:</strong> {result.document_id}</p>

          <p><strong>Total Pages:</strong> {result.total_pages}</p>

          <p><strong>Total Characters:</strong> {result.total_characters}</p>

          <p><strong>Total Chunks:</strong> {result.total_chunks}</p>

          <p><strong>Saved Chunks:</strong> {result.saved_chunks}</p>

        </div>
      )}

    </div>
  );
}

export default PdfUpload;
