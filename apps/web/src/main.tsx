import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Ambulance,
  Building2,
  CalendarCheck,
  FileText,
  History,
  KeyRound,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import {
  api,
  API_BASE,
  AuthResponse,
  ClinicalAnswer,
  ClinicalHistoryItem,
  CareAgentResponse,
  ConsultationSlotRecord,
  DocumentRecord,
  HospitalDepartmentRecord,
  HospitalDoctorRecord,
  HospitalRecord,
  PatientIntakeResponse,
} from "./api/client";
import "./styles.css";

function newConversationId() {
  const id = crypto.randomUUID();
  sessionStorage.setItem("medrag_conversation_id", id);
  return id;
}

function App() {
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("patient@example.com");
  const [password, setPassword] = useState("StrongPass123");
  const [fullName, setFullName] = useState("Demo Patient");
  const [role, setRole] = useState("patient");
  const [bloodGroup, setBloodGroup] = useState("B+");
  const [allergies, setAllergies] = useState("No known drug allergy");
  const [chronicConditions, setChronicConditions] = useState("Diabetes follow-up");
  const [currentMedications, setCurrentMedications] = useState("Metformin as prescribed");
  const [intakeFiles, setIntakeFiles] = useState<File[]>([]);
  const [question, setQuestion] = useState("What should I know about diabetes follow up?");
  const [answer, setAnswer] = useState<ClinicalAnswer | null>(null);
  const [conversationId, setConversationId] = useState(
    () => sessionStorage.getItem("medrag_conversation_id") ?? newConversationId(),
  );
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [documentType, setDocumentType] = useState("past_record");
  const [verifiedFindings, setVerifiedFindings] = useState("Clinician verified: image reviewed; findings should be summarized here.");
  const [history, setHistory] = useState<ClinicalHistoryItem[]>([]);
  const [previousChat, setPreviousChat] = useState(
    "Patient: I have diabetes follow up next week.\nAssistant: Please keep your reports ready and ask your doctor about your HbA1c trend.",
  );
  const [symptoms, setSymptoms] = useState("High fever and severe weakness");
  const [severity, setSeverity] = useState(7);
  const [agentResult, setAgentResult] = useState<CareAgentResponse | null>(null);
  const [hospitalCity, setHospitalCity] = useState("Bengaluru");
  const [speciality, setSpeciality] = useState("General Medicine");
  const [hospitals, setHospitals] = useState<HospitalRecord[]>([]);
  const [slots, setSlots] = useState<ConsultationSlotRecord[]>([]);
  const [bookingReason, setBookingReason] = useState("Consultation for follow-up and report review");
  const [bookingResult, setBookingResult] = useState<Record<string, unknown> | null>(null);
  const [hospitalName, setHospitalName] = useState("Demo Care Hospital");
  const [hospitalPhone, setHospitalPhone] = useState("+91-80-4000-0000");
  const [departmentName, setDepartmentName] = useState("General Medicine");
  const [doctorIdForSlot, setDoctorIdForSlot] = useState("");
  const [slotDate, setSlotDate] = useState(new Date().toISOString().slice(0, 10));
  const [hospitalAdminResult, setHospitalAdminResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const token = session?.access_token ?? "";
  const userId = session?.user_id ?? "";
  const status = useMemo(() => (session ? `${session.role} session active` : "Not signed in"), [session]);

  async function handleAuth(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result: AuthResponse | PatientIntakeResponse =
        mode === "register" && role === "patient"
          ? await api.registerPatientIntake({
              email,
              password,
              full_name: fullName,
              blood_group: bloodGroup,
              allergies,
              chronic_conditions: chronicConditions,
              current_medications: currentMedications,
              documents: intakeFiles.map((file) => ({
                file,
                document_type: file.type.startsWith("image/") ? "health_scan" : "past_record",
              })),
            })
          : mode === "register"
            ? await api.register({
                email,
                password,
                full_name: fullName,
                role,
                registration_number: role === "patient" ? "" : "NMC-DEMO-001",
              })
            : await api.login({ email, password });
      setSession(result);
      setConversationId(newConversationId());
      setAnswer(null);
      if ("documents" in result && result.documents[0]) {
        setDocument(result.documents[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function refreshHistory(activeToken = token) {
    if (!activeToken) return;
    setHistory(await api.history(activeToken));
  }

  async function handleAsk() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.ask(token, question, conversationId);
      sessionStorage.setItem("medrag_conversation_id", result.conversation_id);
      setConversationId(result.conversation_id);
      setAnswer(result);
      await refreshHistory(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clinical query failed");
    } finally {
      setBusy(false);
    }
  }

  function handleNewConversation() {
    setConversationId(newConversationId());
    setAnswer(null);
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !token) return;
    setBusy(true);
    setError("");
    try {
      setDocument(await api.uploadDocument(token, file, documentType));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyImageFindings() {
    if (!token || !document) return;
    setBusy(true);
    setError("");
    try {
      setDocument(await api.verifyImageFindings(token, document.id, verifiedFindings));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleImportHistory() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const messages = previousChat
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf(":");
          const label = separator >= 0 ? line.slice(0, separator).toLowerCase() : "patient";
          const role = label.includes("assistant") ? "assistant" : label.includes("doctor") ? "doctor" : "patient";
          return { role, content: separator >= 0 ? line.slice(separator + 1).trim() : line };
        });
      await api.importHistory(token, { source_label: "presentation_import", messages });
      await refreshHistory(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "History import failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleYearlyScan() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setAgentResult(
        await api.scheduleYearlyScan(token, {
          preferred_date: nextYear.toISOString().slice(0, 10),
          preferred_time_slot: "09:00-11:00",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yearly scan scheduling failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSymptomAgent() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      setAgentResult(
        await api.symptomAction(token, {
          symptoms,
          severity,
          location_text: "Patient home location shared in registered profile",
          preferred_time_slot: "next_available",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Symptom agent failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleFindHospitals() {
    setBusy(true);
    setError("");
    try {
      const found = await api.listHospitals({ city: hospitalCity, speciality });
      setHospitals(found);
      const available = await api.listConsultationSlots({ speciality });
      setSlots(available);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hospital search failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleBookConsultation(slotId: string) {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      setBookingResult(
        await api.bookConsultation(token, {
          slot_id: slotId,
          reason: bookingReason,
          urgency: severity >= 7 ? "high" : "routine",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Consultation booking failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateHospitalFlow() {
    if (!token) return;
    if (!doctorIdForSlot.trim()) {
      setError("Enter a doctor user id before creating a consultation slot.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const hospital: HospitalRecord = await api.createHospital(token, {
        name: hospitalName,
        city: hospitalCity,
        state: "Karnataka",
        phone: hospitalPhone,
        emergency_phone: "108",
      });
      const department: HospitalDepartmentRecord = await api.createDepartment(token, {
        hospital_id: hospital.id,
        name: departmentName,
        speciality,
      });
      const assigned: HospitalDoctorRecord = await api.assignDoctor(token, {
        hospital_id: hospital.id,
        department_id: department.id,
        doctor_id: doctorIdForSlot,
        speciality,
        consultation_fee: 500,
      });
      const slot = await api.createConsultationSlot(token, {
        hospital_id: hospital.id,
        department_id: department.id,
        doctor_id: assigned.doctor_id,
        date: slotDate,
        start_time: "10:00",
        end_time: "10:20",
        consultation_mode: "in_person",
        capacity: 1,
      });
      setHospitalAdminResult({ hospital, department, assigned, slot });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hospital setup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">M</div>
          <div>
            <strong>MedRAG India</strong>
            <span>Clinical RAG console</span>
          </div>
        </div>
        <div className="status">
          <ShieldCheck size={18} />
          <span>{status}</span>
        </div>
        <div className="apiBase">
          API
          <span>{API_BASE}</span>
        </div>
        <nav>
          <a href="#auth">Auth</a>
          <a href="#ask">Ask AI</a>
          <a href="#documents">Documents</a>
          <a href="#history">History</a>
          <a href="#hospitals">Hospitals</a>
          <a href="#agent">Care Agent</a>
          <a href="#compliance">Compliance</a>
        </nav>
      </aside>

      <section className="content">
        <header className="hero">
          <div>
            <p className="eyebrow">Production API client</p>
            <h1>Patient-safe RAG, document intake, and consent-aware clinical access.</h1>
          </div>
          <div className="heroBadge">
            <Activity size={18} />
            LangGraph workflow
          </div>
        </header>

        {error && <div className="alert">{error}</div>}

        <section className="grid">
          <form className="panel" id="auth" onSubmit={handleAuth}>
            <div className="panelTitle">
              <KeyRound size={18} />
              <h2>Authentication</h2>
            </div>
            <div className="segmented">
              <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
                Register
              </button>
              <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
                Login
              </button>
            </div>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
            </label>
            {mode === "register" && (
              <>
                <label>
                  Full name
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
                </label>
                <label>
                  Role
                  <select value={role} onChange={(event) => setRole(event.target.value)}>
                    <option value="patient">Patient</option>
                    <option value="doctor">Doctor</option>
                    <option value="hospital_admin">Hospital Admin</option>
                  </select>
                </label>
                {role === "patient" && (
                  <>
                    <label>
                      Blood group
                      <input value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value)} />
                    </label>
                    <label>
                      Allergies
                      <input value={allergies} onChange={(event) => setAllergies(event.target.value)} />
                    </label>
                    <label>
                      Chronic conditions
                      <input value={chronicConditions} onChange={(event) => setChronicConditions(event.target.value)} />
                    </label>
                    <label>
                      Current medications
                      <input value={currentMedications} onChange={(event) => setCurrentMedications(event.target.value)} />
                    </label>
                    <label>
                      Past records and health scans
                      <input
                        type="file"
                        multiple
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        onChange={(event) => setIntakeFiles(Array.from(event.target.files ?? []))}
                      />
                    </label>
                  </>
                )}
              </>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Working..." : mode === "register" ? "Create session" : "Login"}
            </button>
          </form>

          <section className="panel" id="ask">
            <div className="panelTitle">
              <Activity size={18} />
              <h2>Clinical Question</h2>
            </div>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} />
            <button className="primary" disabled={!token || busy} onClick={handleAsk}>
              Ask with safety graph
            </button>
            <button className="secondary" disabled={!token || busy} onClick={handleNewConversation}>
              New conversation
            </button>
            {answer && (
              <div className="answer">
                <strong>{answer.safety_label}</strong>
                <div className="metaGrid">
                  <span>Route: {answer.query_route || "not routed"}</span>
                  <span>Confidence: {Math.round((answer.query_route_confidence || 0) * 100)}%</span>
                  <span>{answer.query_route_used_fallback ? "Fallback retrieval" : "LLM router accepted"}</span>
                  <span>Sources: {answer.retrieval_source_types?.join(", ") || "none"}</span>
                </div>
                <p>{answer.answer}</p>
                {answer.query_route_reason && <small>{answer.query_route_reason}</small>}
                {answer.rewritten_queries?.length > 0 && (
                  <small>Search: {answer.rewritten_queries.join(" | ")}</small>
                )}
                <small>Trace: {answer.trace_id}</small>
                <small>Conversation: {answer.conversation_id}</small>
              </div>
            )}
          </section>

          <section className="panel" id="documents">
            <div className="panelTitle">
              <UploadCloud size={18} />
              <h2>Document Upload</h2>
            </div>
            <label>
              Type
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                <option value="past_record">Past record</option>
                <option value="health_scan">Health scan</option>
                <option value="imaging">X-ray / imaging</option>
                <option value="dental_image">Dental image</option>
                <option value="symptom_photo">Symptom photo</option>
                <option value="lab_report">Lab report</option>
                <option value="prescription">Prescription</option>
              </select>
            </label>
            <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={handleUpload} />
            {document && (
              <div className="answer">
                <strong>{document.original_filename}</strong>
                <p>
                  {document.document_type} | {document.status} | malware: {document.malware_status}
                </p>
                {document.ocr_review_status && document.ocr_review_status !== "not_started" && (
                  <div className="metaGrid">
                    <span>OCR: {document.ocr_review_status}</span>
                    {document.ocr_engine && <span>Engine: {document.ocr_engine}</span>}
                    {document.ocr_confidence && <span>Confidence: {document.ocr_confidence}</span>}
                    {document.ocr_handwriting_detected && <span>Handwriting detected</span>}
                  </div>
                )}
                {document.ocr_warning && <p>{document.ocr_warning}</p>}
                {document.image_review_status && document.image_review_status !== "not_required" && (
                  <>
                    <div className="metaGrid">
                      <span>Modality: {document.image_modality || "unknown"}</span>
                      <span>Review: {document.image_review_status}</span>
                      <span>Image embedding: {document.image_embedding_status || "not_required"}</span>
                      {document.image_embedding_model && <span>Model: {document.image_embedding_model}</span>}
                    </div>
                    {document.image_ai_observations && <p>{document.image_ai_observations}</p>}
                    {session?.role !== "patient" && (
                      <>
                        <textarea
                          value={verifiedFindings}
                          onChange={(event) => setVerifiedFindings(event.target.value)}
                          rows={3}
                        />
                        <button className="secondary" disabled={busy} onClick={handleVerifyImageFindings}>
                          Verify image findings
                        </button>
                      </>
                    )}
                  </>
                )}
                <small>SHA-256: {document.sha256}</small>
              </div>
            )}
          </section>

          <section className="panel" id="history">
            <div className="panelTitle">
              <History size={18} />
              <h2>Previous Chat</h2>
            </div>
            <textarea value={previousChat} onChange={(event) => setPreviousChat(event.target.value)} rows={5} />
            <button className="primary" disabled={!token || busy} onClick={handleImportHistory}>
              Store prior chat
            </button>
            <button className="secondary" disabled={!token || busy} onClick={() => refreshHistory().catch((err) => setError(err.message))}>
              Refresh history
            </button>
            {history.slice(0, 3).map((item) => (
              <div className="answer" key={item.trace_id}>
                <strong>{item.safety_label}</strong>
                <p>{item.question}</p>
                <small>
                  {item.prompt_version} | {new Date(item.created_at).toLocaleString()}
                </small>
              </div>
            ))}
          </section>

          <section className="panel" id="agent">
            <div className="panelTitle">
              <CalendarCheck size={18} />
              <h2>Agentic Care</h2>
            </div>
            <button className="primary" disabled={!token || busy} onClick={handleYearlyScan}>
              Schedule yearly scan
            </button>
            <div className="panelTitle compact">
              <Ambulance size={18} />
              <h2>Symptom Action</h2>
            </div>
            <textarea value={symptoms} onChange={(event) => setSymptoms(event.target.value)} rows={3} />
            <label>
              Severity
              <input
                type="number"
                min="1"
                max="10"
                value={severity}
                onChange={(event) => setSeverity(Number(event.target.value))}
              />
            </label>
            <button className="secondary" disabled={!token || busy} onClick={handleSymptomAgent}>
              Run care agent
            </button>
            {agentResult && (
              <div className="answer">
                <strong>{agentResult.action}</strong>
                <p>{agentResult.reasoning}</p>
                <small>{JSON.stringify(agentResult.result)}</small>
              </div>
            )}
          </section>

          <section className="panel" id="hospitals">
            <div className="panelTitle">
              <Building2 size={18} />
              <h2>Hospital Consultations</h2>
            </div>
            <div className="grid2">
              <label>
                City
                <input value={hospitalCity} onChange={(event) => setHospitalCity(event.target.value)} />
              </label>
              <label>
                Speciality
                <input value={speciality} onChange={(event) => setSpeciality(event.target.value)} />
              </label>
            </div>
            <label>
              Reason
              <textarea value={bookingReason} onChange={(event) => setBookingReason(event.target.value)} rows={3} />
            </label>
            <button className="secondary" disabled={busy} onClick={handleFindHospitals}>
              Find consultations
            </button>
            {hospitals.length > 0 && (
              <div className="answer">
                <strong>Hospitals</strong>
                {hospitals.map((hospital) => (
                  <p key={hospital.id}>
                    {hospital.name} | {hospital.city}, {hospital.state} | {hospital.phone || hospital.emergency_phone}
                  </p>
                ))}
              </div>
            )}
            {slots.length > 0 && (
              <div className="answer">
                <strong>Available slots</strong>
                {slots.map((slot) => (
                  <p key={slot.id}>
                    {slot.date} {slot.start_time}-{slot.end_time} | {slot.consultation_mode} |{" "}
                    {slot.booked_count}/{slot.capacity}
                    <button className="secondary inlineButton" disabled={!token || busy} onClick={() => handleBookConsultation(slot.id)}>
                      Book
                    </button>
                  </p>
                ))}
              </div>
            )}
            {bookingResult && (
              <div className="answer">
                <strong>Booking confirmed</strong>
                <small>{JSON.stringify(bookingResult)}</small>
              </div>
            )}
            {session?.role === "hospital_admin" && (
              <div className="answer">
                <div className="panelTitle compact">
                  <Building2 size={16} />
                  <strong>Hospital admin setup</strong>
                </div>
                <div className="grid2">
                  <label>
                    Hospital
                    <input value={hospitalName} onChange={(event) => setHospitalName(event.target.value)} />
                  </label>
                  <label>
                    Phone
                    <input value={hospitalPhone} onChange={(event) => setHospitalPhone(event.target.value)} />
                  </label>
                  <label>
                    Department
                    <input value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} />
                  </label>
                  <label>
                    Doctor user id
                    <input value={doctorIdForSlot} onChange={(event) => setDoctorIdForSlot(event.target.value)} />
                  </label>
                  <label>
                    Slot date
                    <input type="date" value={slotDate} onChange={(event) => setSlotDate(event.target.value)} />
                  </label>
                </div>
                <button className="secondary" disabled={busy} onClick={handleCreateHospitalFlow}>
                  Create hospital slot
                </button>
                {hospitalAdminResult && <small>{JSON.stringify(hospitalAdminResult)}</small>}
              </div>
            )}
          </section>

          <section className="panel" id="compliance">
            <div className="panelTitle">
              <FileText size={18} />
              <h2>Compliance Hooks</h2>
            </div>
            <p>
              Consent grants and care-team membership are enforced by the backend before a clinician can query a
              patient record. Patient self-access works by default.
            </p>
            <code>{userId || "Sign in to see user id"}</code>
          </section>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
