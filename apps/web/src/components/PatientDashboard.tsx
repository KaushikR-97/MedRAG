import React from "react";
import { Sparkles, FileText, Heart, Activity, Users, MessageSquare } from "lucide-react";
import { AuthResponse } from "../api/client";

type PatientDashboardProps = {
  session: AuthResponse;
  onNavigate: (tab: "home" | "clinical" | "documents" | "care" | "hospitals" | "trust" | "doctor" | "profile" | "public-health" | "family" | "chat") => void;
};

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ session, onNavigate }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Welcome Hero Card */}
      <div className="card" style={{ background: "linear-gradient(135deg, rgba(26,115,232,0.1) 0%, rgba(0,0,0,0) 100%)", borderLeft: "4px solid var(--primary)" }}>
        <h2 style={{ fontSize: "1.4rem", marginBottom: "8px" }}>Hello, {session.full_name || "Patient"}</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>
          Your Patient ID: <span style={{ fontFamily: "monospace", color: "var(--primary)" }}>{session.user_id}</span>
        </p>
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
          <h3 style={{ fontSize: "1rem", marginBottom: "12px" }}>Quick Health Navigation</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <button onClick={() => onNavigate("clinical")} className="button" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "20px", height: "auto" }}>
              <Sparkles size={20} />
              <span>Clinical AI Hub</span>
            </button>
            <button onClick={() => onNavigate("documents")} className="button-sec" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "20px", height: "auto" }}>
              <FileText size={20} />
              <span>Record Vault</span>
            </button>
            <button onClick={() => onNavigate("hospitals")} className="button-sec" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "20px", height: "auto", gridColumn: "span 2" }}>
              <span>Book Appointment Slot</span>
            </button>
            <button onClick={() => onNavigate("chat")} className="button-sec" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "20px", height: "auto" }}>
              <MessageSquare size={20} />
              <span>Chat With Doctors</span>
            </button>
            <button onClick={() => onNavigate("family")} className="button-sec" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "20px", height: "auto" }}>
              <Users size={20} />
              <span>Family & Consent</span>
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
    </div>
  );
};
