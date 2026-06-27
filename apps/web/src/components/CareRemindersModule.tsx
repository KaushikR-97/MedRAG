import React, { useState, useEffect } from "react";
import { Users, Clock, MessageSquare, Plus } from "lucide-react";
import { api } from "../api/client";

type CareRemindersModuleProps = {
  token: string;
  sessionRole: string;
  activePatientId?: string;
};

export const CareRemindersModule: React.FC<CareRemindersModuleProps> = ({ token, sessionRole, activePatientId }) => {
  const [reminders, setReminders] = useState<any[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<any[]>([]);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);

  // Create reminder state
  const [medName, setMedName] = useState("");
  const [dosage, setDosage] = useState("");
  const [schedule, setSchedule] = useState("09:00, 21:00");
  const [patientIdInput, setPatientIdInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refreshData = async () => {
    try {
      const remindersRes = await api.listMedicationReminders(token, activePatientId || undefined);
      setReminders(remindersRes);
      
      if (sessionRole === "patient") {
        const familyRes = await api.listFamilyMembers(token);
        setFamilyMembers(familyRes);
        const whatsappRes = await api.whatsappLogs(token);
        setWhatsappLogs(whatsappRes);
      }
      
      const smsRes = await api.smsLogs(token);
      setSmsLogs(smsRes);
    } catch (err: any) {
      console.error("Failed to load care configuration", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, [token, activePatientId]);

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.createMedicationReminder(token, {
        medicine_name: medName,
        dosage,
        schedule,
        patient_id: sessionRole === "doctor" ? patientIdInput : undefined,
      });
      setSuccess("Reminder successfully created.");
      setMedName("");
      setDosage("");
      refreshData();
    } catch (err: any) {
      setError(err.message || "Failed to create reminder");
    } finally {
      setLoading(false);
    }
  };

  const triggerPillboxAdherence = async (reminderId: string, status: "taken" | "missed") => {
    setError("");
    setSuccess("");
    try {
      const res = await api.pillboxPing(token, { reminder_id: reminderId, status });
      setSuccess(`[DEMO MODE] Pillbox adherence logged. Caregiver alerted: ${res.caregiver_notified ? "YES" : "NO"}`);
      refreshData();
    } catch (err: any) {
      setError(err.message || "Simulated ping failed");
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
      {/* Reminder manager */}
      <div className="card">
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <Clock size={18} style={{ color: "var(--primary)" }} />
          Medication Reminders
        </h3>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
          Track daily medication timings. Simulated IoT Smart Pillbox triggers caregiver alerts if doses are missed.
        </p>

        {error && <div className="toast toast-error" style={{ marginBottom: "12px" }}>{error}</div>}
        {success && <div className="toast toast-success" style={{ marginBottom: "12px" }}>{success}</div>}

        <form onSubmit={handleCreateReminder} style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="label">Medicine Name</label>
              <input type="text" value={medName} onChange={e => setMedName(e.target.value)} className="input" placeholder="Metformin" required />
            </div>
            <div>
              <label className="label">Dosage</label>
              <input type="text" value={dosage} onChange={e => setDosage(e.target.value)} className="input" placeholder="500mg" required />
            </div>
          </div>
          <div>
            <label className="label">Schedule (CSV Timings)</label>
            <input type="text" value={schedule} onChange={e => setSchedule(e.target.value)} className="input" required />
          </div>
          {sessionRole === "doctor" && (
            <div>
              <label className="label">Patient ID</label>
              <input type="text" value={patientIdInput} onChange={e => setPatientIdInput(e.target.value)} className="input" placeholder="12-digit patient ID" required />
            </div>
          )}
          <button type="submit" className="button" disabled={loading} style={{ alignSelf: "flex-end" }}>
            <Plus size={16} style={{ marginRight: "4px" }} />
            Add Reminder
          </button>
        </form>

        <h4 style={{ fontSize: "0.9rem", marginBottom: "12px" }}>Active Schedules ({reminders.length})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {reminders.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>No active reminders configured.</p>
          ) : (
            reminders.map((rem) => (
              <div key={rem.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{rem.medicine_name}</span>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                    Dosage: {rem.dosage} | Timings: {rem.schedule}
                  </div>
                </div>
                {sessionRole === "patient" && (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button 
                      onClick={() => triggerPillboxAdherence(rem.id, "taken")} 
                      className="button" 
                      style={{ padding: "4px 8px", fontSize: "0.7rem", background: "green" }}
                    >
                      Pill Taken
                    </button>
                    <button 
                      onClick={() => triggerPillboxAdherence(rem.id, "missed")} 
                      className="button" 
                      style={{ padding: "4px 8px", fontSize: "0.7rem", background: "red" }}
                    >
                      Pill Missed
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Messaging simulation & family */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {sessionRole === "patient" && (
          <div>
            <h3 style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <Users size={16} style={{ color: "var(--primary)" }} />
              Linked Family / Caregivers
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {familyMembers.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>No family members linked.</p>
              ) : (
                familyMembers.map((m, idx) => (
                  <div key={idx} style={{ padding: "8px", background: "rgba(255,255,255,0.01)", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "0.8rem" }}>
                    <strong>{m.relation.toUpperCase()}:</strong> {m.name} (Age: {m.age})
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div>
          <h3 style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <MessageSquare size={16} style={{ color: "var(--primary)" }} />
            Simulated Notification Inbox
            <span style={{ fontSize: "0.75rem", background: "rgba(255,0,0,0.2)", color: "red", padding: "2px 6px", borderRadius: "8px", marginLeft: "6px" }}>DEMO MODE</span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "300px", overflowY: "auto" }}>
            {whatsappLogs.map((log) => (
              <div key={log.id} style={{ padding: "10px", background: "rgba(37,211,102,0.05)", borderRadius: "8px", border: "1px solid rgba(37,211,102,0.2)", fontSize: "0.75rem" }}>
                <div style={{ fontWeight: 600, color: "#25d366", marginBottom: "4px" }}>WhatsApp Alert to {log.to_phone}</div>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.8)" }}>{log.body}</p>
              </div>
            ))}
            
            {smsLogs.map((log) => (
              <div key={log.id} style={{ padding: "10px", background: "rgba(26,115,232,0.05)", borderRadius: "8px", border: "1px solid rgba(26,115,232,0.2)", fontSize: "0.75rem" }}>
                <div style={{ fontWeight: 600, color: "var(--primary)", marginBottom: "4px" }}>
                  SMS ({log.direction === "inbound" ? "Inbound" : "Outbound"}) to {log.phone}
                </div>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.8)" }}>{log.body}</p>
              </div>
            ))}

            {whatsappLogs.length === 0 && smsLogs.length === 0 && (
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center", padding: "20px" }}>No simulated alerts logged.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
