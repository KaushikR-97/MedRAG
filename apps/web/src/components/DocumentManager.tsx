import React, { useState, useEffect } from "react";
import { UploadCloud, FileText, CheckCircle, AlertTriangle, Eye, Boxes } from "lucide-react";
import { api, DocumentRecord } from "../api/client";

type DocumentManagerProps = {
  token: string;
  activePatientId?: string;
  userRole: string;
};

export const DocumentManager: React.FC<DocumentManagerProps> = ({ token, activePatientId, userRole }) => {
  const [documentsList, setDocumentsList] = useState<DocumentRecord[]>([]);
  const [documentJobs, setDocumentJobs] = useState<Record<string, any[]>>({});
  const [pdfViewUrl, setPdfViewUrl] = useState("");
  const [pdfViewName, setPdfViewName] = useState("");
  const [documentType, setDocumentType] = useState("past_record");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Spellchecker states
  const [activeSpellcheckDoc, setActiveSpellcheckDoc] = useState<DocumentRecord | null>(null);
  const [spellcheckResult, setSpellcheckResult] = useState<any[]>([]);
  const [spellcheckLoading, setSpellcheckLoading] = useState(false);

  // Similar cases states
  const [activeSimilarDoc, setActiveSimilarDoc] = useState<DocumentRecord | null>(null);
  const [similarCasesList, setSimilarCasesList] = useState<any[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDocuments = async () => {
    try {
      const res = await api.listDocuments(token, activePatientId || undefined);
      setDocumentsList(res);
      const pairs = await Promise.all(
        res.map(async (doc) => {
          try {
            return [doc.id, await api.listDocumentJobs(token, doc.id)] as const;
          } catch {
            return [doc.id, []] as const;
          }
        }),
      );
      setDocumentJobs(Object.fromEntries(pairs));
    } catch (err: any) {
      console.error("Failed to load documents", err);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [token, activePatientId]);

  useEffect(() => {
    return () => {
      if (pdfViewUrl) URL.revokeObjectURL(pdfViewUrl);
    };
  }, [pdfViewUrl]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      await api.uploadDocument(token, selectedFile, documentType, activePatientId || undefined);
      setSuccess("Document uploaded successfully. Processing ingestion in background...");
      setSelectedFile(null);
      loadDocuments();
    } catch (err: any) {
      setError(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleSpellcheck = async (doc: DocumentRecord) => {
    setActiveSpellcheckDoc(doc);
    setSpellcheckLoading(true);
    setSpellcheckResult([]);
    try {
      const res = await api.ocrSpellcheck(token, { text: doc.ocr_text || "" });
      setSpellcheckResult(res);
    } catch (err: any) {
      setError("Spellcheck failed: " + err.message);
    } finally {
      setSpellcheckLoading(false);
    }
  };

  const handleSimilarCases = async (doc: DocumentRecord) => {
    setActiveSimilarDoc(doc);
    setSimilarLoading(true);
    setSimilarCasesList([]);
    try {
      const res = await api.getSimilarCases(token, doc.id);
      setSimilarCasesList(res.similar_cases || []);
    } catch (err: any) {
      setError("Similar cases fetch failed: " + err.message);
    } finally {
      setSimilarLoading(false);
    }
  };

  const handleDeleteDocument = async (doc: DocumentRecord) => {
    setError("");
    setSuccess("");
    try {
      await api.deleteDocument(token, doc.id);
      setSuccess("Record deleted from your patient vault.");
      loadDocuments();
    } catch (err: any) {
      setError(err.message || "Could not delete document");
    }
  };

  const handleRetryIngestion = async (doc: DocumentRecord) => {
    setError("");
    setSuccess("");
    try {
      await api.retryDocumentIngestion(token, doc.id);
      setSuccess("Document ingestion restarted. Watch the job status below for progress.");
      loadDocuments();
    } catch (err: any) {
      setError(err.message || "Could not retry ingestion");
    }
  };

  const handleViewDocument = async (doc: DocumentRecord) => {
    setError("");
    try {
      const blob = await api.viewDocument(token, doc.id);
      if (pdfViewUrl) URL.revokeObjectURL(pdfViewUrl);
      setPdfViewUrl(URL.createObjectURL(blob));
      setPdfViewName(doc.original_filename);
    } catch (err: any) {
      setError(err.message || "Could not open document");
    }
  };

  const closePdfViewer = () => {
    if (pdfViewUrl) URL.revokeObjectURL(pdfViewUrl);
    setPdfViewUrl("");
    setPdfViewName("");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
      {/* Upload card */}
      <div className="card" style={{ height: "fit-content" }}>
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <UploadCloud size={18} style={{ color: "var(--primary)" }} />
          Ingest & Process Documents
        </h3>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
          Upload PDFs, clinical reports, or imagery. paddleocr will automatically extract and index content.
        </p>

        {error && <div className="toast toast-error" style={{ marginBottom: "12px" }}>{error}</div>}
        {success && <div className="toast toast-success" style={{ marginBottom: "12px" }}>{success}</div>}

        <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label className="label">Select File</label>
            <input 
              type="file" 
              onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} 
              className="input" 
              required 
            />
          </div>
          <div>
            <label className="label">Document Classification</label>
            <select value={documentType} onChange={e => setDocumentType(e.target.value)} className="input">
              <option value="past_record">Past Patient Record</option>
              <option value="lab_report">Lab Report</option>
              <option value="discharge_summary">Discharge Summary</option>
              <option value="imagery">Diagnostic Imagery</option>
              <option value="prescription">Prescription</option>
            </select>
          </div>
          <button type="submit" className="button" disabled={uploading || !selectedFile}>
            {uploading ? "Processing..." : "Start Ingestion"}
          </button>
        </form>
      </div>

      {/* List card */}
      <div className="card">
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <FileText size={18} style={{ color: "var(--primary)" }} />
          Document Registry ({documentsList.length})
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflowY: "auto" }}>
          {documentsList.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", textAlign: "center", padding: "20px" }}>No documents found.</p>
          ) : (
            documentsList.map((doc) => (
              <div key={doc.id} style={{ padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{doc.original_filename}</span>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                      Type: {doc.document_type} | Status: {doc.status} | Verified: {doc.verified_by_patient ? "Yes" : "No"} | RAG: {doc.ingested_to_rag ? "Ingested" : "Not ingested"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {userRole === "patient" && (
                      <button
                        onClick={() => handleViewDocument(doc)}
                        className="button-sec"
                        style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                        title="View uploaded PDF"
                      >
                        View PDF
                      </button>
                    )}
                    <button 
                      onClick={() => handleSpellcheck(doc)} 
                      className="button-sec" 
                      style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                      title="Run Spellcheck"
                    >
                      Spellcheck
                    </button>
                    {doc.document_type === "imagery" && (
                      <button 
                        onClick={() => handleSimilarCases(doc)} 
                        className="button-sec" 
                        style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                        title="Find Similar Clinical Cases"
                      >
                        Find Similar
                      </button>
                    )}
                    {(doc.status === "blocked" || doc.status === "ocr_failed" || doc.status === "ingestion_failed" || doc.malware_status === "error") && (
                      <button
                        onClick={() => handleRetryIngestion(doc)}
                        className="button-sec"
                        style={{ padding: "4px 8px", fontSize: "0.7rem", borderColor: "rgba(0,176,255,0.45)", color: "var(--primary)" }}
                        title="Restart OCR and RAG ingestion"
                      >
                        Retry Ingestion
                      </button>
                    )}
                    {userRole === "patient" && (
                      <button
                        onClick={() => handleDeleteDocument(doc)}
                        className="button-sec"
                        style={{ padding: "4px 8px", fontSize: "0.7rem", borderColor: "rgba(231,76,60,0.35)", color: "#e74c3c" }}
                        title="Delete record"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {doc.ocr_text && (
                  <details style={{ marginTop: "8px" }}>
                    <summary style={{ fontSize: "0.75rem", color: "var(--primary)", cursor: "pointer" }}>View Extracted OCR Text</summary>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", whiteSpace: "pre-wrap", marginTop: "6px", background: "black", padding: "8px", borderRadius: "4px" }}>
                      {doc.ocr_text}
                    </p>
                  </details>
                )}
                {(documentJobs[doc.id] || []).length > 0 && (
                  <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {(documentJobs[doc.id] || []).map((job) => (
                      <div key={job.id} style={{ fontSize: "0.72rem", color: job.status === "failed" ? "#e74c3c" : "var(--muted)" }}>
                        Job: {job.job_type} | {job.status.toUpperCase()}{job.error ? ` | ${job.error}` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {pdfViewUrl && (
        <div className="card" style={{ gridColumn: "span 2", marginTop: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4 style={{ fontSize: "0.95rem" }}>Viewing: {pdfViewName}</h4>
            <button onClick={closePdfViewer} className="button-sec" style={{ padding: "4px 8px" }}>Close PDF</button>
          </div>
          <iframe
            src={pdfViewUrl}
            title={pdfViewName}
            style={{
              width: "100%",
              height: "70vh",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              background: "#fff",
            }}
          />
        </div>
      )}

      {/* Spellcheck Results Modal/Section */}
      {activeSpellcheckDoc && (
        <div className="card" style={{ gridColumn: "span 2", marginTop: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4 style={{ fontSize: "0.95rem" }}>OCR Spelling Checker Results for: {activeSpellcheckDoc.original_filename}</h4>
            <button onClick={() => setActiveSpellcheckDoc(null)} className="button-sec" style={{ padding: "4px 8px" }}>Close Checker</button>
          </div>
          {spellcheckLoading ? (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Checking spellings against clinical vocabulary...</p>
          ) : spellcheckResult.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "green" }}>No typos detected! All words match medical dictionaries.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <th style={{ textAlign: "left", padding: "8px" }}>Original Word</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Correction</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Suggestions</th>
                </tr>
              </thead>
              <tbody>
                {spellcheckResult.map((res, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                    <td style={{ padding: "8px", color: "var(--accent)" }}>{res.original}</td>
                    <td style={{ padding: "8px", color: "green" }}>{res.correction}</td>
                    <td style={{ padding: "8px" }}>{res.is_typo ? "Typo Correction" : "Correct"}</td>
                    <td style={{ padding: "8px" }}>{res.suggestions.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Similar Cases Results Section */}
      {activeSimilarDoc && (
        <div className="card" style={{ gridColumn: "span 2", marginTop: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4 style={{ fontSize: "0.95rem" }}>Similar Historical Diagnostic Cases for: {activeSimilarDoc.original_filename}</h4>
            <button onClick={() => setActiveSimilarDoc(null)} className="button-sec" style={{ padding: "4px 8px" }}>Close Cases</button>
          </div>
          {similarLoading ? (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Running vector search query on historical clinical archives...</p>
          ) : similarCasesList.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>No matching clinical cases found.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {similarCasesList.map((c, i) => (
                <div key={i} style={{ padding: "12px", background: "rgba(255,255,255,0.01)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 600, color: "var(--primary)", marginBottom: "6px" }}>
                    <span>Case #{c.case_id}</span>
                    <span>Similarity: {(c.similarity_score * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    <div style={{ marginBottom: "4px" }}><strong>Observations:</strong> {c.observations}</div>
                    <div style={{ marginBottom: "4px" }}><strong>Treatment:</strong> {c.treatment_plan}</div>
                    <div><strong>Outcome:</strong> {c.outcome}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
