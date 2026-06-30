import React, { useState, useEffect } from "react";
import { Users, FileText, Send, AlertTriangle, Building2, Plus } from "lucide-react";
import { api, AppointmentRecord, ConsultationMessageRecord, DoctorConsultPrep, PreConsultationRecord } from "../api/client";
import { encryptMessage, decryptMessage } from "../utils/crypto";

type DoctorWorkspaceProps = {
  token: string;
  activeConversations: any[];
  chatMessages: any[];
  setChatMessages: React.Dispatch<React.SetStateAction<any[]>>;
  sessionUserId: string;
  sessionUserName: string;
  myAppointments: AppointmentRecord[];
  onStartVideoCall: (appt: AppointmentRecord) => void;
  onAppointmentsChanged: () => void;
};

export const DoctorWorkspace: React.FC<DoctorWorkspaceProps> = ({
  token,
  activeConversations,
  chatMessages,
  setChatMessages,
  sessionUserId,
  sessionUserName,
  myAppointments,
  onStartVideoCall,
  onAppointmentsChanged,
}) => {
  // Patient Search & Record lookup
  const [searchPatientId, setSearchPatientId] = useState("");
  const [patientProfile, setPatientProfile] = useState<any | null>(null);
  const [patientDocs, setPatientDocs] = useState<any[]>([]);
  const [consentError, setConsentError] = useState("");
  const [accessRequestStatus, setAccessRequestStatus] = useState("");

  // Prescription States
  const [prescriptionDraft, setPrescriptionDraft] = useState({
    diagnosis: "Type 2 Diabetes Mellitus",
    medications: "Metformin 500mg, Glipizide 5mg",
    dosage: "Once daily with meals",
    duration: "90 days",
    instructions: "Avoid sugary drinks. Schedule lab review.",
    pmjay_covered: false
  });
  const [prescriptionsList, setPrescriptionsList] = useState<any[]>([]);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Slot release states
  const [slotDate, setSlotDate] = useState("2026-07-01");
  const [slotStartTime, setSlotStartTime] = useState("09:00");
  const [slotEndTime, setSlotEndTime] = useState("10:00");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState("30");
  const [slotTimezone, setSlotTimezone] = useState("Asia/Kolkata");
  const [slotFee, setSlotFee] = useState("500.0");
  const [releaseVideoSlots, setReleaseVideoSlots] = useState(true);
  const [releaseInPersonSlots, setReleaseInPersonSlots] = useState(true);
  
  const [chatInput, setChatInput] = useState("");
  const [activeChatRecipient, setActiveChatRecipient] = useState<{ id: string; name: string } | null>(null);
  const [activeChatAppointment, setActiveChatAppointment] = useState<AppointmentRecord | null>(null);
  const [serverMessages, setServerMessages] = useState<ConsultationMessageRecord[]>([]);
  const [decryptedText, setDecryptedText] = useState<{ [msgId: string]: string }>({});
  const [passphrase, setPassphrase] = useState("");
  const [preConsults, setPreConsults] = useState<Record<string, PreConsultationRecord>>({});
  const [preConsultFeedback, setPreConsultFeedback] = useState<Record<string, string>>({});
  const [consultPreps, setConsultPreps] = useState<Record<string, DoctorConsultPrep>>({});
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [organizationName, setOrganizationName] = useState("My Clinic");
  const [organizationType, setOrganizationType] = useState("clinic");
  const [clinicStaffUserId, setClinicStaffUserId] = useState("");
  const [clinicStaffRole, setClinicStaffRole] = useState("front_desk");
  const [clinicStaffScope, setClinicStaffScope] = useState("appointments,records");
  const [reportMonth, setReportMonth] = useState("2026-07");
  const [monthlyExpenses, setMonthlyExpenses] = useState("0");
  const [businessReport, setBusinessReport] = useState<any | null>(null);

  useEffect(() => {
    async function decryptAll() {
      const results: { [msgId: string]: string } = {};
      for (const m of chatMessages) {
        const derivedSecret = passphrase.trim()
          ? passphrase.trim()
          : [sessionUserId, m.recipientId].sort().join("-");
        const dec = await decryptMessage(m.encodedText, derivedSecret);
        results[m.id] = dec;
      }
      setDecryptedText(results);
    }
    decryptAll();
  }, [chatMessages, sessionUserId, passphrase]);

  useEffect(() => {
    if (!activeChatAppointment || !isChatOpen(activeChatAppointment)) {
      setServerMessages([]);
      return;
    }
    let cancelled = false;
    const appointment = activeChatAppointment;
    async function loadThread() {
      try {
        const messages = await api.listConsultationMessages(token, appointment.id);
        if (!cancelled) setServerMessages(messages);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Could not load appointment chat");
      }
    }
    loadThread();
    const timer = window.setInterval(loadThread, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeChatAppointment?.id, token]);

  useEffect(() => {
    refreshOrganizations();
  }, [token]);

  const refreshOrganizations = async () => {
    try {
      const result = await api.listOrganizations(token);
      setOrganizations(result);
      if (!organizationId && result.length) setOrganizationId(result[0].id);
    } catch (err: any) {
      setError(err.message || "Could not load clinic organizations");
    }
  };

  const handleCreateOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const org = await api.createOrganization(token, {
        name: organizationName,
        organization_type: organizationType,
      });
      setOrganizationId(org.id);
      setSuccess(`${org.name} created. You can now delegate clinic management tasks.`);
      await refreshOrganizations();
    } catch (err: any) {
      setError(err.message || "Could not create clinic organization");
    }
  };

  const handleAddClinicStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organizationId || !clinicStaffUserId.trim()) return;
    setError("");
    setSuccess("");
    try {
      await api.addOrganizationMember(token, organizationId, {
        user_id: clinicStaffUserId.trim(),
        member_role: clinicStaffRole,
        task_scope: clinicStaffScope,
      });
      setClinicStaffUserId("");
      setSuccess("Clinic member added with delegated task scope.");
      await refreshOrganizations();
    } catch (err: any) {
      setError(err.message || "Could not add clinic member");
    }
  };

  // Load patient record
  const handleLoadPatientRecord = async () => {
    setConsentError("");
    setAccessRequestStatus("");
    setPatientProfile(null);
    setPatientDocs([]);
    try {
      // 1. Fetch patient profile
      const prof = await api.getPatientProfile(token, searchPatientId);
      setPatientProfile(prof);
      // 2. Fetch patient documents
      const docs = await api.listDocuments(token, searchPatientId);
      setPatientDocs(docs);
    } catch (err: any) {
      setConsentError(err.message || "Access denied. Patient consent required.");
    }
  };

  const handleRequestPatientAccess = async () => {
    if (!searchPatientId.trim()) return;
    setConsentError("");
    setAccessRequestStatus("");
    try {
      const request = await api.requestPatientAccess(token, {
        patient_id: searchPatientId.trim(),
        scope: "clinical.ask",
        purpose: "Doctor requested clinical AI access for consultation and prescribing",
      });
      await api.requestPatientAccess(token, {
        patient_id: searchPatientId.trim(),
        scope: "documents.read",
        purpose: "Doctor requested selected medical report access",
      });
      setAccessRequestStatus(
        request.status === "pending"
          ? "Clinical AI access and selected-document access requests sent to the patient."
          : `Access request ${request.status}.`,
      );
    } catch (err: any) {
      setConsentError(err.message || "Could not request patient consent");
    }
  };

  const handleCreatePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!searchPatientId) {
      setError("Please search and load a patient profile first.");
      return;
    }
    try {
      const result = await api.createPrescription(token, {
        patient_id: searchPatientId,
        diagnosis: prescriptionDraft.diagnosis,
        medications: prescriptionDraft.medications,
        dosage: prescriptionDraft.dosage,
        duration: prescriptionDraft.duration,
        instructions: prescriptionDraft.instructions,
        pmjay_covered: prescriptionDraft.pmjay_covered,
      });
      setSuccess(
        result.ingested_to_rag
          ? "Prescription signed, visible on patient dashboard, saved to Medical Vault, and indexed into RAG."
          : "Prescription signed and visible on patient dashboard. Medical Vault/RAG indexing is pending or needs retry.",
      );
      // Reset
      setPrescriptionDraft({
        diagnosis: "Type 2 Diabetes Mellitus",
        medications: "Metformin 500mg, Glipizide 5mg",
        dosage: "Once daily with meals",
        duration: "90 days",
        instructions: "Avoid sugary drinks.",
        pmjay_covered: false
      });
    } catch (err: any) {
      setError(err.message || "Failed to issue prescription");
    }
  };

  const handleReleaseSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const modes = [
        ...(releaseVideoSlots ? ["video"] : []),
        ...(releaseInPersonSlots ? ["in_person"] : []),
      ];
      if (modes.length === 0) {
        setError("Select at least one consultation mode.");
        return;
      }
      for (const mode of modes) {
        await api.createConsultationSlot(token, {
          date: slotDate,
          start_time: slotStartTime,
          end_time: slotEndTime,
          timezone: slotTimezone,
          slot_duration_minutes: Number(slotDurationMinutes),
          consultation_mode: mode,
          capacity: mode === "in_person" ? 4 : 1,
          consultation_fee: parseFloat(slotFee),
          accept_insurance: true,
          hospital_id: "personal",
          department_id: "personal"
        });
      }
      setSuccess("Availability released for selected video/offline modes. Offline bookings receive consultation tokens.");
      onAppointmentsChanged();
    } catch (err: any) {
      setError(err.message || "Slot creation failed");
    }
  };

  const handleLoadBusinessReport = async () => {
    setError("");
    setSuccess("");
    try {
      const report = await api.doctorBusinessReport(token, reportMonth, Number(monthlyExpenses) || 0);
      setBusinessReport(report);
      setSuccess("Monthly business report prepared.");
    } catch (err: any) {
      setError(err.message || "Could not prepare business report");
    }
  };

  const previewSlotCount = () => {
    const [startHour, startMinute] = slotStartTime.split(":").map(Number);
    const [endHour, endMinute] = slotEndTime.split(":").map(Number);
    const duration = Number(slotDurationMinutes);
    if ([startHour, startMinute, endHour, endMinute, duration].some(Number.isNaN) || duration <= 0) return 0;
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return Math.max(0, Math.floor((end - start) / duration));
  };

  const updateSlotStart = (startTime: string) => {
    setSlotStartTime(startTime);
  };

  const handleConfirmAppointment = async (appt: AppointmentRecord) => {
    setError("");
    setSuccess("");
    try {
      await api.updateAppointmentStatus(token, appt.id, { status: "confirmed" });
      setSuccess("Booking confirmed. Patient can join video only during the booked slot window.");
      onAppointmentsChanged();
    } catch (err: any) {
      setError(err.message || "Could not confirm booking");
    }
  };

  const handleAppointmentStatus = async (appt: AppointmentRecord, status: string) => {
    setError("");
    setSuccess("");
    try {
      await api.updateAppointmentStatus(token, appt.id, { status });
      setSuccess(`Appointment marked ${status.replace("_", " ")}.`);
      onAppointmentsChanged();
    } catch (err: any) {
      setError(err.message || "Could not update appointment");
    }
  };

  const handleGeneratePreConsult = async (appt: AppointmentRecord) => {
    setError("");
    setSuccess("");
    try {
      const record = await api.generatePreConsultationDraft(token, appt.id);
      setPreConsults((prev) => ({ ...prev, [appt.id]: record }));
      if (record.status === "awaiting_patient_intake") {
        setSuccess("Pre-consult agent is waiting for the patient to submit symptoms and reason for call.");
      } else if (record.status === "awaiting_patient_consent") {
        setSuccess("Pre-consult agent is waiting for the patient to approve record access consent.");
      } else {
        setSuccess("Pre-consult draft is ready for doctor review.");
      }
    } catch (err: any) {
      setError(err.message || "Could not generate pre-consult draft");
    }
  };

  const handleScorePreConsult = async (appt: AppointmentRecord, approved: boolean) => {
    try {
      const record = await api.scorePreConsultationDraft(token, appt.id, {
        approved,
        feedback: preConsultFeedback[appt.id] || "",
      });
      setPreConsults((prev) => ({ ...prev, [appt.id]: record }));
      setSuccess(approved ? "AI draft approved. Reward recorded." : "AI draft rejected. Feedback recorded for improvement.");
    } catch (err: any) {
      setError(err.message || "Could not score pre-consult draft");
    }
  };

  const handleLoadConsultPrep = async (appt: AppointmentRecord) => {
    setError("");
    setSuccess("");
    try {
      const prep = await api.getDoctorConsultPrep(token, appt.id);
      setConsultPreps((prev) => ({ ...prev, [appt.id]: prep }));
      setSuccess("Consult prep loaded.");
    } catch (err: any) {
      setError(err.message || "Could not load consult prep");
    }
  };

  const isVideoJoinLive = (appt: AppointmentRecord) => {
    if (appt.status !== "confirmed" || appt.consultation_mode !== "video") return false;
    if (appt.starts_at && appt.ends_at && appt.server_now) {
      const now = Date.parse(appt.server_now);
      return now >= Date.parse(appt.starts_at) && now <= Date.parse(appt.ends_at);
    }
    const [startText, endText] = appt.time_slot.split("-");
    const start = new Date(`${appt.date}T${(startText || "").trim()}:00`);
    const end = new Date(`${appt.date}T${(endText || "").trim()}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    const now = new Date();
    return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
  };

  const isChatOpen = (appt: AppointmentRecord) => {
    if (appt.status !== "confirmed") return false;
    const start = appt.confirmed_at ? Date.parse(appt.confirmed_at) : Date.parse(appt.server_now || "");
    const end = appt.ends_at ? Date.parse(appt.ends_at) + 7 * 24 * 60 * 60 * 1000 : start + 7 * 24 * 60 * 60 * 1000;
    const now = Date.parse(appt.server_now || "") || Date.now();
    return now >= start && now <= end;
  };

  const handleSendMessage = async () => {
    if (!activeChatRecipient || !chatInput.trim()) return;
    if (activeChatAppointment) {
      if (!isChatOpen(activeChatAppointment)) {
        setError("Secure consultation chat is available for 7 days after booking confirmation.");
        return;
      }
      try {
        const sent = await api.sendConsultationMessage(token, activeChatAppointment.id, { body: chatInput.trim() });
        setServerMessages((prev) => [...prev, sent]);
        setChatInput("");
        return;
      } catch (err: any) {
        setError(err.message || "Could not send appointment chat message");
      }
    }
    const derivedSecret = passphrase.trim()
      ? passphrase.trim()
      : [sessionUserId, activeChatRecipient.id].sort().join("-");
    const cipherText = await encryptMessage(chatInput.trim(), derivedSecret);
    const newMsg = {
      id: crypto.randomUUID(),
      senderId: sessionUserId,
      senderName: sessionUserName,
      recipientId: activeChatRecipient.id,
      recipientName: activeChatRecipient.name,
      encodedText: cipherText,
      timestamp: Date.now()
    };
    const updated = [...chatMessages, newMsg];
    setChatMessages(updated);
    setChatInput("");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <Building2 size={18} style={{ color: "var(--primary)" }} />
          Clinic Organizations
        </h3>
        <form onSubmit={handleCreateOrganization} style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: "10px", alignItems: "end", marginBottom: "14px" }}>
          <div>
            <label className="label">Clinic Name</label>
            <input className="input" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} />
          </div>
          <div>
            <label className="label">Structure</label>
            <select className="input" value={organizationType} onChange={(event) => setOrganizationType(event.target.value)}>
              <option value="clinic">Clinic</option>
              <option value="solo_clinic">Solo Clinic</option>
              <option value="diagnostic_center">Diagnostic Center</option>
              <option value="pharmacy">Pharmacy</option>
            </select>
          </div>
          <button className="button" type="submit"><Plus size={16} />Create</button>
        </form>
        <label className="label">Active Clinic Organization</label>
        <select className="input" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} style={{ marginBottom: "14px" }}>
          <option value="">Select clinic organization</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>{org.name} ({org.organization_type.replace("_", " ")})</option>
          ))}
        </select>
        <form onSubmit={handleAddClinicStaff} style={{ display: "grid", gridTemplateColumns: "1fr 160px 1fr auto", gap: "10px", alignItems: "end" }}>
          <div>
            <label className="label">Staff User ID</label>
            <input className="input" value={clinicStaffUserId} onChange={(event) => setClinicStaffUserId(event.target.value)} placeholder="Doctor/admin/staff user ID" />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={clinicStaffRole} onChange={(event) => setClinicStaffRole(event.target.value)}>
              <option value="admin">Admin</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="front_desk">Front Desk</option>
              <option value="billing">Billing</option>
              <option value="lab_staff">Lab Staff</option>
              <option value="pharmacist">Pharmacist</option>
            </select>
          </div>
          <div>
            <label className="label">Task Scope</label>
            <input className="input" value={clinicStaffScope} onChange={(event) => setClinicStaffScope(event.target.value)} />
          </div>
          <button className="button-sec" type="submit" disabled={!organizationId}>Delegate</button>
        </form>
      </div>

      {/* Loading patient profiles & EMR access */}
      <div className="card">
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <Users size={18} style={{ color: "var(--primary)" }} />
          Electronic Health Record (EHR) Access
        </h3>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
          Access is strictly restricted to assigned care team members or patients with active consent grants.
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
          <input 
            type="text" 
            value={searchPatientId} 
            onChange={e => setSearchPatientId(e.target.value)} 
            className="input" 
            placeholder="Enter 12-digit Patient User ID" 
          />
          <button onClick={handleLoadPatientRecord} className="button">Search Profile</button>
        </div>

        {consentError && (
          <div style={{ padding: "16px", background: "rgba(231,76,60,0.1)", borderRadius: "10px", border: "1px solid rgba(231,76,60,0.3)", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#e74c3c", fontWeight: 600, fontSize: "0.85rem", marginBottom: "6px" }}>
              <AlertTriangle size={16} />
              Consent Clearance Required
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 12px 0" }}>
              You do not have active consent permissions to view this patient's private medical files.
            </p>
            <button
              onClick={handleRequestPatientAccess}
              className="button"
              style={{ padding: "6px 12px", fontSize: "0.75rem", marginRight: "8px" }}
            >
              Request Patient Approval
            </button>
            {/* Break-glass protocol */}
            <button 
              onClick={async () => {
                if (!searchPatientId) return;
                try {
                  await api.triggerBreakGlass(token, { patient_id: searchPatientId, purpose: "Emergency clinical diagnosis lookup" });
                  alert("Emergency break-glass protocol successfully authenticated and logged. Retrying profile search...");
                  handleLoadPatientRecord();
                } catch (err: any) {
                  alert("Failed to initiate override: " + err.message);
                }
              }}
              className="button"
              style={{ background: "#e74c3c", color: "white", padding: "6px 12px", fontSize: "0.75rem" }}
            >
              🚨 Override (Emergency Break-Glass)
            </button>
          </div>
        )}

        {accessRequestStatus && (
          <div className="toast toast-success" style={{ marginBottom: "16px" }}>{accessRequestStatus}</div>
        )}

        {patientProfile && (
          <div style={{ padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "8px" }}>
            <h4 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)" }}>Verified Patient Data:</h4>
            <div><strong>Blood Group:</strong> {patientProfile.blood_group || "Not specified"}</div>
            <div><strong>Date of Birth:</strong> {patientProfile.date_of_birth || "Not specified"}</div>
            <div><strong>Gender:</strong> {patientProfile.gender || "Not specified"}</div>
            <div><strong>Allergies:</strong> {patientProfile.allergies || "None declared"}</div>
            <div><strong>Chronic Conditions:</strong> {patientProfile.chronic_conditions || "None declared"}</div>
            <div><strong>Current Medications:</strong> {patientProfile.current_medications || "None"}</div>
            
            {patientDocs && patientDocs.length > 0 && (
              <div style={{ marginTop: "10px" }}>
                <strong style={{ color: "var(--primary)" }}>Patient Reports ({patientDocs.length}):</strong>
                <ul style={{ margin: "6px 0 0 0", paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {patientDocs.map(doc => (
                    <li key={doc.id}>
                      <div>{doc.original_filename} ({doc.document_type}) | {doc.status} | RAG: {doc.ingested_to_rag ? "ingested" : "not ingested"}</div>
                      {doc.ocr_warning && <div style={{ color: "#e74c3c", marginTop: "3px" }}>{doc.ocr_warning}</div>}
                      {doc.ocr_text && (
                        <details style={{ marginTop: "4px" }}>
                          <summary style={{ color: "var(--primary)", cursor: "pointer" }}>View extracted report text</summary>
                          <pre style={{ whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.35)", padding: "8px", borderRadius: "6px", marginTop: "4px", maxHeight: "180px", overflowY: "auto" }}>{doc.ocr_text}</pre>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {patientDocs && patientDocs.length === 0 && (
              <div style={{ marginTop: "10px", color: "var(--muted)" }}>No reports found for this patient.</div>
            )}
          </div>
        )}
      </div>

      {/* Writing prescriptions */}
      <div className="card">
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <FileText size={18} style={{ color: "var(--primary)" }} />
          Issue Digital Prescription
        </h3>
        
        {error && <div className="toast toast-error" style={{ marginBottom: "12px" }}>{error}</div>}
        {success && <div className="toast toast-success" style={{ marginBottom: "12px" }}>{success}</div>}

        <form onSubmit={handleCreatePrescription} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="label">Diagnosis</label>
              <input type="text" value={prescriptionDraft.diagnosis} onChange={e => setPrescriptionDraft({...prescriptionDraft, diagnosis: e.target.value})} className="input" required />
            </div>
            <div>
              <label className="label">Medications (CSV)</label>
              <input type="text" value={prescriptionDraft.medications} onChange={e => setPrescriptionDraft({...prescriptionDraft, medications: e.target.value})} className="input" required />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="label">Dosage Instructions</label>
              <input type="text" value={prescriptionDraft.dosage} onChange={e => setPrescriptionDraft({...prescriptionDraft, dosage: e.target.value})} className="input" required />
            </div>
            <div>
              <label className="label">Duration</label>
              <input type="text" value={prescriptionDraft.duration} onChange={e => setPrescriptionDraft({...prescriptionDraft, duration: e.target.value})} className="input" required />
            </div>
          </div>
          <div>
            <label className="label">Special Instructions</label>
            <textarea value={prescriptionDraft.instructions} onChange={e => setPrescriptionDraft({...prescriptionDraft, instructions: e.target.value})} className="input" rows={2} style={{ resize: "none" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "6px 0" }}>
            <input 
              type="checkbox" 
              checked={prescriptionDraft.pmjay_covered} 
              onChange={e => setPrescriptionDraft({...prescriptionDraft, pmjay_covered: e.target.checked})} 
            />
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Mark as PM-JAY coverage eligible</span>
          </div>
          <button type="submit" className="button">Finalize & Sign Prescription</button>
        </form>
      </div>

      {/* Release Slots */}
      <div className="card">
        <h3 style={{ fontSize: "1rem", marginBottom: "12px" }}>Release Availability Window</h3>
        <form onSubmit={handleReleaseSlot} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="label">Date</label>
              <input type="date" value={slotDate} onChange={e => setSlotDate(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Consultation Duration</label>
              <select
                value={slotDurationMinutes}
                onChange={e => setSlotDurationMinutes(e.target.value)}
                className="input"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="label">Start Time</label>
              <input type="time" value={slotStartTime} onChange={e => updateSlotStart(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Available Until</label>
              <input type="time" value={slotEndTime} onChange={e => setSlotEndTime(e.target.value)} className="input" required />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="label">Consultation Fee (INR)</label>
              <input type="text" value={slotFee} onChange={e => setSlotFee(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Slot Time Zone</label>
              <select value={slotTimezone} onChange={e => setSlotTimezone(e.target.value)} className="input">
                <option value="Asia/Kolkata">IST - India Standard Time</option>
                <option value="Asia/Dubai">GST - Dubai</option>
                <option value="Europe/London">London</option>
                <option value="America/New_York">New York</option>
                <option value="America/Los_Angeles">Los Angeles</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
            <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.8rem", color: "var(--muted)" }}>
              <input type="checkbox" checked={releaseVideoSlots} onChange={e => setReleaseVideoSlots(e.target.checked)} />
              Video slots
            </label>
            <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.8rem", color: "var(--muted)" }}>
              <input type="checkbox" checked={releaseInPersonSlots} onChange={e => setReleaseInPersonSlots(e.target.checked)} />
              In-person slots
            </label>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            This will create {previewSlotCount()} patient-selectable slots from {slotStartTime} to {slotEndTime}.
          </p>
          <button type="submit" className="button" style={{ alignSelf: "flex-end", marginTop: "10px" }}>Release Slots</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ fontSize: "1rem", marginBottom: "12px" }}>Business Report & Monthly Budget</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "10px", alignItems: "end" }}>
          <div>
            <label className="label">Month</label>
            <input className="input" type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} />
          </div>
          <div>
            <label className="label">Expenses (INR)</label>
            <input className="input" type="number" value={monthlyExpenses} onChange={e => setMonthlyExpenses(e.target.value)} />
          </div>
          <button className="button" type="button" onClick={handleLoadBusinessReport}>Prepare</button>
        </div>
        {businessReport && (
          <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.8rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
              <div>Total: <strong>{businessReport.appointments_total}</strong></div>
              <div>Done: <strong>{businessReport.appointments_completed}</strong></div>
              <div>Fees: <strong>INR {businessReport.total_fee_collection}</strong></div>
              <div>Taxable est.: <strong>INR {businessReport.estimated_taxable_income}</strong></div>
            </div>
            {businessReport.budget_sheet.map((row: any) => (
              <div key={row.line_item} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: "6px" }}>
                <span>{row.line_item}</span>
                <strong>INR {row.amount}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Appointments & Local consult Chat */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <h4 style={{ fontSize: "0.95rem", marginBottom: "12px" }}>Today's Telehealth Appointments</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
            {myAppointments.map(appt => (
              <div key={appt.id} style={{ padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Patient: {appt.patient_name || `${appt.patient_id.slice(0, 8)}...`}</span>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                      Slot: {appt.time_slot} | Mode: {appt.consultation_mode} | Token: {appt.booking_reference || "pending"} | Status: {appt.status.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {appt.status === "requested" && (
                    <button
                      onClick={() => handleConfirmAppointment(appt)}
                      className="button"
                      style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                    >
                      Confirm
                    </button>
                  )}
                  {appt.status === "confirmed" && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => handleGeneratePreConsult(appt)}
                        className="button-sec"
                        style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                      >
                        Pre-Consult
                      </button>
                      <button
                        onClick={() => handleLoadConsultPrep(appt)}
                        className="button-sec"
                        style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                      >
                        Prep
                      </button>
                      <button
                        onClick={() => {
                          setActiveChatRecipient({ id: appt.patient_id, name: appt.patient_name || `Patient ${appt.patient_id.slice(0, 6)}` });
                          setActiveChatAppointment(appt);
                        }}
                        className="button-sec"
                        style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                      >
                        Chat
                      </button>
                      {appt.consultation_mode === "video" && (
                        <button disabled={!isVideoJoinLive(appt)} onClick={() => onStartVideoCall(appt)} className="button" style={{ background: "#2ecc71", padding: "4px 8px", fontSize: "0.75rem" }}>
                          Start Call
                        </button>
                      )}
                    </div>
                  )}
                  {appt.consultation_mode === "in_person" && appt.status === "confirmed" && (
                    <button
                      onClick={() => handleAppointmentStatus(appt, "checked_in")}
                      className="button-sec"
                      style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                    >
                      Check In
                    </button>
                  )}
                  {appt.status === "checked_in" && (
                    <button
                      onClick={() => handleAppointmentStatus(appt, "completed")}
                      className="button"
                      style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                    >
                      Complete
                    </button>
                  )}
                  </div>
                </div>
                {preConsults[appt.id] && (
                  <div style={{ marginTop: "10px", borderTop: "1px solid var(--line)", paddingTop: "10px" }}>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "6px" }}>
                      Agent status: {preConsults[appt.id].status.replace(/_/g, " ")} | Reward: {preConsults[appt.id].reward_score}
                    </div>
                    {preConsults[appt.id].symptoms && (
                      <div style={{ fontSize: "0.78rem", marginBottom: "6px" }}>
                        <strong>Patient intake:</strong> {preConsults[appt.id].symptoms}
                      </div>
                    )}
                    {preConsults[appt.id].draft_summary ? (
                      <>
                        <pre style={{ whiteSpace: "pre-wrap", maxHeight: "180px", overflowY: "auto", background: "rgba(0,0,0,0.35)", border: "1px solid var(--line)", borderRadius: "8px", padding: "8px", fontSize: "0.74rem" }}>
                          {preConsults[appt.id].draft_summary}
                        </pre>
                        <textarea
                          className="input"
                          rows={2}
                          value={preConsultFeedback[appt.id] || ""}
                          onChange={(event) => setPreConsultFeedback((prev) => ({ ...prev, [appt.id]: event.target.value }))}
                          placeholder="Doctor feedback for the AI draft..."
                          style={{ marginTop: "8px", resize: "vertical", fontSize: "0.75rem" }}
                        />
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                          <button className="button-sec" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => handleScorePreConsult(appt, false)}>
                            Reject Draft
                          </button>
                          <button className="button" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => handleScorePreConsult(appt, true)}>
                            Approve Draft
                          </button>
                        </div>
                      </>
                    ) : (
                      <p style={{ color: "var(--muted)", fontSize: "0.76rem", margin: 0 }}>
                        The agent needs patient intake and approved consent before it can prepare the doctor draft.
                      </p>
                    )}
                  </div>
                )}
                {consultPreps[appt.id] && (
                  <div style={{ marginTop: "10px", borderTop: "1px solid var(--line)", paddingTop: "10px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div style={{ fontSize: "0.76rem" }}>
                        <strong>Patient snapshot</strong>
                        <div style={{ color: "var(--muted)", marginTop: "4px" }}>
                          Age: {String(consultPreps[appt.id].patient.age || "NA")} | Gender: {String(consultPreps[appt.id].patient.gender || "NA")}
                        </div>
                        <div style={{ color: "var(--muted)" }}>Allergies: {String(consultPreps[appt.id].patient.allergies || "None declared")}</div>
                        <div style={{ color: "var(--muted)" }}>Meds: {String(consultPreps[appt.id].patient.current_medications || "None declared")}</div>
                      </div>
                      <div style={{ fontSize: "0.76rem" }}>
                        <strong>Active prescriptions</strong>
                        <div style={{ color: "var(--muted)", marginTop: "4px" }}>
                          {consultPreps[appt.id].active_prescriptions.length
                            ? consultPreps[appt.id].active_prescriptions.map((rx) => `${rx.diagnosis}: ${rx.medications}`).join(" | ")
                            : "None found"}
                        </div>
                      </div>
                    </div>
                    {consultPreps[appt.id].missing_questions.length > 0 && (
                      <div style={{ marginTop: "8px", fontSize: "0.76rem" }}>
                        <strong>Ask before prescribing</strong>
                        <ul style={{ margin: "4px 0 0 16px", color: "var(--muted)" }}>
                          {consultPreps[appt.id].missing_questions.map((question, index) => <li key={index}>{question}</li>)}
                        </ul>
                      </div>
                    )}
                    <details style={{ marginTop: "8px", fontSize: "0.76rem" }}>
                      <summary style={{ color: "var(--primary)", cursor: "pointer" }}>Records and red flags</summary>
                      <div style={{ color: "var(--muted)", marginTop: "6px" }}>
                        Records: {consultPreps[appt.id].records.length}
                      </div>
                      <ul style={{ margin: "4px 0 0 16px", color: "var(--muted)" }}>
                        {consultPreps[appt.id].red_flags.map((flag, index) => <li key={index}>{flag}</li>)}
                      </ul>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Local chat consult fallback */}
        <div>
          <h4 style={{ fontSize: "0.95rem", marginBottom: "10px" }}>Secure Local Consult Messenger</h4>
          <div style={{ display: "flex", gap: "10px", height: "200px" }}>
            {/* Conversations list */}
            <div style={{ width: "150px", borderRight: "1px solid var(--line)", paddingRight: "10px", overflowY: "auto" }}>
              {activeConversations.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => {
                    setActiveChatRecipient(c);
                    setActiveChatAppointment(c.appointment || null);
                  }}
                  style={{ 
                    padding: "6px", 
                    borderRadius: "6px", 
                    background: activeChatRecipient?.id === c.id ? "rgba(255,255,255,0.05)" : "transparent",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    marginBottom: "4px"
                  }}
                >
                  {c.name}
                </div>
              ))}
            </div>
            
            {/* Chat pane */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ flex: 1, border: "1px solid var(--line)", borderRadius: "8px", padding: "8px", overflowY: "auto", background: "black", fontSize: "0.75rem" }}>
                {activeChatRecipient ? (
                  <>
                    {serverMessages.map((m) => {
                      const isMe = m.sender_id === sessionUserId;
                      return (
                        <div key={m.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: "6px" }}>
                          <div style={{ background: isMe ? "var(--primary)" : "rgba(255,255,255,0.1)", padding: "6px 12px", borderRadius: "10px", maxWidth: "80%" }}>
                            {m.body}
                          </div>
                        </div>
                      );
                    })}
                    {chatMessages
                      .filter(m => (m.senderId === sessionUserId && m.recipientId === activeChatRecipient.id) || (m.senderId === activeChatRecipient.id && m.recipientId === sessionUserId))
                      .map(m => {
                        const decrypted = decryptedText[m.id] || "Decrypting...";
                        const isMe = m.senderId === sessionUserId;
                        return (
                          <div key={m.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: "6px" }}>
                            <div style={{ background: isMe ? "var(--primary)" : "rgba(255,255,255,0.1)", padding: "6px 12px", borderRadius: "10px", maxWidth: "80%" }}>
                              {decrypted}
                            </div>
                          </div>
                        );
                      })}
                  </>
                ) : (
                  <p style={{ textAlign: "center", color: "var(--muted)", margin: "40px 0 0 0" }}>Select a caregiver chat conversation.</p>
                )}
              </div>
              {activeChatRecipient && (
                <input 
                  type="password" 
                  value={passphrase} 
                  onChange={e => setPassphrase(e.target.value)} 
                  className="input" 
                  style={{ height: "26px", fontSize: "0.75rem", background: "rgba(255,255,255,0.02)" }}
                  placeholder="Optional custom E2EE key passphrase (overrides default keys)..."
                />
              )}
              <div style={{ display: "flex", gap: "6px" }}>
                <input 
                  type="text" 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  className="input" 
                  style={{ height: "30px", fontSize: "0.85rem" }}
                  placeholder="Type secure local message..."
                />
                <button onClick={handleSendMessage} className="button" style={{ height: "30px", padding: "0 10px" }}>
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
