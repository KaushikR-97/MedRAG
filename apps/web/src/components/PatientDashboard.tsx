import React, { useEffect, useState } from "react";
import { Sparkles, FileText, Heart, Activity, Users, MessageSquare, Pill, CheckCircle2, AlertTriangle, CalendarPlus } from "lucide-react";
import { api, AuthResponse, FitnessActivityRecord, PatientCareBrief, PrescriptionRecord } from "../api/client";

type PatientDashboardProps = {
  token: string;
  session: AuthResponse;
  onNavigate: (tab: "home" | "clinical" | "documents" | "care" | "hospitals" | "trust" | "doctor" | "profile" | "public-health" | "family" | "chat") => void;
};

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ token, session, onNavigate }) => {
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState("");
  const [careBrief, setCareBrief] = useState<PatientCareBrief | null>(null);
  const [briefError, setBriefError] = useState("");
  const [fitnessActivities, setFitnessActivities] = useState<FitnessActivityRecord[]>([]);
  const [fitnessMessage, setFitnessMessage] = useState("");
  const [fitnessError, setFitnessError] = useState("");
  const [appleSteps, setAppleSteps] = useState("6500");
  const [appleMinutes, setAppleMinutes] = useState("30");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoadingPrescriptions(true);
    setPrescriptionError("");
    api.listPrescriptions(token)
      .then((records) => {
        if (cancelled) return;
        setPrescriptions(
          [...records].sort((a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || "")).slice(0, 3),
        );
      })
      .catch((err: any) => {
        if (!cancelled) setPrescriptionError(err.message || "Could not load prescriptions");
      })
      .finally(() => {
        if (!cancelled) setLoadingPrescriptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const loadFitnessActivities = async () => {
    try {
      const result = await api.listFitnessActivities(token);
      setFitnessActivities(result.activities.slice(0, 5));
    } catch (err: any) {
      setFitnessError(err.message || "Could not load fitness activity");
    }
  };

  useEffect(() => {
    if (token) loadFitnessActivities();
  }, [token]);

  const connectFitness = async (provider: string) => {
    setFitnessError("");
    setFitnessMessage("");
    try {
      const result = await api.connectFitnessProvider(token, provider);
      if (result.authorization_url) {
        window.open(result.authorization_url, "_blank", "noreferrer");
        setFitnessMessage(`Opened ${provider} authorization. Complete login and paste the callback code into backend callback when available.`);
      } else {
        setFitnessMessage((result.instructions || []).join(" "));
      }
    } catch (err: any) {
      setFitnessError(err.message || `Could not connect ${provider}`);
    }
  };

  const syncFitness = async (provider: string) => {
    setFitnessError("");
    setFitnessMessage("");
    try {
      await api.syncFitnessProvider(token, provider);
      setFitnessMessage(`${provider} activity synced.`);
      await loadFitnessActivities();
    } catch (err: any) {
      setFitnessError(err.message || `Could not sync ${provider}`);
    }
  };

  const importApple = async () => {
    setFitnessError("");
    setFitnessMessage("");
    try {
      await api.importAppleHealthSample(token, {
        steps: Number(appleSteps) || 0,
        exercise_minutes: Number(appleMinutes) || 0,
      });
      setFitnessMessage("Apple Health sample imported.");
      await loadFitnessActivities();
    } catch (err: any) {
      setFitnessError(err.message || "Could not import Apple Health sample");
    }
  };

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setBriefError("");
    api.getPatientCareBrief(token)
      .then((brief) => {
        if (!cancelled) setCareBrief(brief);
      })
      .catch((err: any) => {
        if (!cancelled) setBriefError(err.message || "Could not load care brief");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Welcome Hero Card */}
      <div className="card calm-hero">
        <div>
          <div className="page-kicker">Welcome back</div>
          <h2 style={{ fontSize: "1.55rem", marginBottom: "8px" }}>Hello, {session.full_name || "Patient"}</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.92rem", margin: 0, maxWidth: "720px", lineHeight: 1.6 }}>
            Take a breath. Your reports, appointments, doctors, and family access are in one place.
            Choose what you need now.
          </p>
        </div>
        <div className="patient-id-pill">Patient ID {session.user_id}</div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: "1.08rem", marginBottom: "6px" }}>What would you like to do?</h3>
        <p style={{ color: "var(--muted)", fontSize: "0.86rem", marginBottom: "16px" }}>
          Start with one of these common actions. You can always come back here.
        </p>
        <div className="primary-action-grid">
          <button onClick={() => onNavigate("hospitals")} className="button patient-action primary-action">
            <CalendarPlus size={22} />
            <span>
              <strong>Book a doctor</strong>
              <small>Video or clinic visit</small>
            </span>
          </button>
          <button onClick={() => onNavigate("clinical")} className="button-sec patient-action">
            <Sparkles size={22} />
            <span>
              <strong>Ask Health AI</strong>
              <small>Get guidance before care</small>
            </span>
          </button>
          <button onClick={() => onNavigate("documents")} className="button-sec patient-action">
            <FileText size={22} />
            <span>
              <strong>Upload reports</strong>
              <small>Keep records ready</small>
            </span>
          </button>
          <button onClick={() => onNavigate("chat")} className="button-sec patient-action">
            <MessageSquare size={22} />
            <span>
              <strong>Message doctor</strong>
              <small>For booked consultations</small>
            </span>
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={18} style={{ color: "var(--primary)" }} />
            Today's Care Brief
          </h3>
          <span style={{ color: "var(--muted)", fontSize: "0.74rem" }}>
            {careBrief?.generated_at ? new Date(careBrief.generated_at).toLocaleTimeString() : ""}
          </span>
        </div>
        {briefError && <div className="toast toast-error">{briefError}</div>}
        {!briefError && !careBrief && <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Loading care brief...</div>}
        {careBrief && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
            {careBrief.suggested_actions.map((action, index) => (
              <div key={`${action.type}-${index}`} style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "12px", background: "rgba(255,255,255,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                  <strong style={{ fontSize: "0.86rem" }}>{action.title}</strong>
                  <span style={{ color: action.priority === "high" ? "#e74c3c" : action.priority === "medium" ? "#f1c40f" : "var(--muted)", fontSize: "0.72rem" }}>
                    {action.priority.toUpperCase()}
                  </span>
                </div>
                <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: 0 }}>{action.detail}</p>
              </div>
            ))}
          </div>
        )}
        {careBrief && careBrief.active_diseases.length > 0 && (
          <div style={{ marginTop: "12px", color: "var(--muted)", fontSize: "0.8rem" }}>
            Active treatment context: {careBrief.active_diseases.map((item) => item.diagnosis).join(", ")}
          </div>
        )}
      </div>

      {/* Grid of quick vitals & stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ background: "rgba(231,76,60,0.1)", padding: "10px", borderRadius: "10px", color: "#e74c3c" }}>
            <Heart size={20} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Average Pulse</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>72 bpm</div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ background: "rgba(26,115,232,0.1)", padding: "10px", borderRadius: "10px", color: "var(--primary)" }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Blood Pressure</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>120/80 mmHg</div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ background: "rgba(46,204,113,0.1)", padding: "10px", borderRadius: "10px", color: "#2ecc71" }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Blood Glucose</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>95 mg/dL</div>
          </div>
        </div>
      </div>

      {/* Main quick-navigation grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div className="card">
          <h3 style={{ fontSize: "1rem", marginBottom: "12px" }}>Other Helpful Areas</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <button onClick={() => onNavigate("chat")} className="button-sec" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "20px", height: "auto" }}>
              <MessageSquare size={20} />
              <span>Doctor Chat</span>
            </button>
            <button onClick={() => onNavigate("family")} className="button-sec" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "20px", height: "auto" }}>
              <Users size={20} />
              <span>Family Care</span>
            </button>
            <button onClick={() => onNavigate("care")} className="button-sec" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "20px", height: "auto" }}>
              <Pill size={20} />
              <span>Medicines</span>
            </button>
            <button onClick={() => onNavigate("trust")} className="button-sec" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "20px", height: "auto" }}>
              <CheckCircle2 size={20} />
              <span>Privacy</span>
            </button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: "1rem", marginBottom: "12px" }}>Consent & Security Summary</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "16px" }}>
            Review active care-team accesses and audit compliance block ledgers to verify your EMR timeline remains secure.
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => onNavigate("trust")} className="button-sec" style={{ flex: 1 }}>
              Ledger Auditor
            </button>
            <button onClick={() => onNavigate("care")} className="button-sec" style={{ flex: 1 }}>
              Reminders & Family
            </button>
            <button onClick={() => onNavigate("family")} className="button-sec" style={{ flex: 1 }}>
              Consent Grants
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Activity size={18} style={{ color: "var(--primary)" }} />
          Fitness & Exercise Sync
        </h3>
        {fitnessError && <div className="toast toast-error" style={{ marginBottom: "10px" }}>{fitnessError}</div>}
        {fitnessMessage && <div className="toast toast-success" style={{ marginBottom: "10px" }}>{fitnessMessage}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {["fitbit", "google_fit"].map((provider) => (
            <div key={provider} style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "12px", background: "rgba(255,255,255,0.5)" }}>
              <strong>{provider === "google_fit" ? "Google Fit" : "Fitbit"}</strong>
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button className="button-sec" onClick={() => connectFitness(provider)}>Connect</button>
                <button className="button" onClick={() => syncFitness(provider)}>Sync</button>
              </div>
            </div>
          ))}
          <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "12px", background: "rgba(255,255,255,0.5)" }}>
            <strong>Apple Health</strong>
            <p style={{ color: "var(--muted)", fontSize: "0.76rem", margin: "6px 0" }}>Use HealthKit bridge/export import.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "8px" }}>
              <input className="input" value={appleSteps} onChange={(event) => setAppleSteps(event.target.value)} placeholder="Steps" />
              <input className="input" value={appleMinutes} onChange={(event) => setAppleMinutes(event.target.value)} placeholder="Exercise min" />
              <button className="button" onClick={importApple}>Import</button>
            </div>
          </div>
        </div>
        {fitnessActivities.length > 0 && (
          <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px" }}>
            {fitnessActivities.map((item) => (
              <div key={item.id} style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "10px", fontSize: "0.8rem" }}>
                <strong>{item.activity_date}</strong>
                <div style={{ color: "var(--muted)" }}>{item.provider} | {item.steps} steps | {item.exercise_minutes} min</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <Pill size={18} style={{ color: "var(--primary)" }} />
            Recent Signed Prescriptions
          </h3>
          <button onClick={() => onNavigate("documents")} className="button-sec" style={{ padding: "6px 12px", fontSize: "0.78rem" }}>
            Open Medical Vault
          </button>
        </div>
        {prescriptionError && <div className="toast toast-error">{prescriptionError}</div>}
        {loadingPrescriptions && <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Loading prescriptions...</div>}
        {!loadingPrescriptions && !prescriptionError && prescriptions.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No doctor-signed prescriptions yet.</div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
          {prescriptions.map((rx) => (
            <div key={rx.id} style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "12px", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "8px" }}>
                <strong style={{ fontSize: "0.9rem" }}>{rx.diagnosis || "Signed prescription"}</strong>
                <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{rx.created_at ? new Date(rx.created_at).toLocaleDateString() : ""}</span>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--muted)", whiteSpace: "pre-wrap", marginBottom: "8px" }}>{rx.medications}</div>
              <div style={{ fontSize: "0.78rem", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span><strong>Dosage:</strong> {rx.dosage || "As directed"}</span>
                <span><strong>Duration:</strong> {rx.duration || "As directed"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px", color: rx.ingested_to_rag ? "#2ecc71" : "#f1c40f", fontSize: "0.76rem" }}>
                {rx.ingested_to_rag ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {rx.ingested_to_rag ? "Added to Medical Vault and RAG" : "Saved to vault, RAG pending"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
