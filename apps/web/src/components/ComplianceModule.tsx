import React, { useState, useEffect } from "react";
import { ShieldCheck, AlertOctagon, CheckCircle } from "lucide-react";
import { api } from "../api/client";

type ComplianceModuleProps = {
  token: string;
  sessionRole: string;
};

export const ComplianceModule: React.FC<ComplianceModuleProps> = ({ token, sessionRole }) => {
  const [driftAlerts, setDriftAlerts] = useState<any[]>([]);
  const [ledgerBlocks, setLedgerBlocks] = useState<any[]>([]);
  const [ledgerValid, setLedgerValid] = useState<boolean | null>(null);
  const [ledgerErr, setLedgerErr] = useState<string | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [hashingLoading, setHashingLoading] = useState(false);

  // Red-teaming simulator states
  const [redTeamScore, setRedTeamScore] = useState<any | null>(null);
  const [redTeamLogs, setRedTeamLogs] = useState<any[]>([]);
  const [simulatorRunning, setSimulatorRunning] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const refreshData = async () => {
    try {
      const driftRes = await api.getGuidelineDriftAlerts(token);
      setDriftAlerts(driftRes);

      const scoreRes = await api.redTeamScore(token);
      setRedTeamScore(scoreRes);
      setRedTeamLogs(scoreRes.logs || []);

      const ledgerRes = await api.getLedgerBlocks(token);
      setLedgerBlocks(ledgerRes);
    } catch (err: any) {
      console.error("Failed to load compliance details", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, [token]);

  const handleVerifyLedger = async () => {
    setLedgerLoading(true);
    setLedgerValid(null);
    setLedgerErr(null);
    try {
      const res = await api.verifyLedger(token);
      setLedgerValid(res.is_valid);
      setLedgerErr(res.error);
    } catch (err: any) {
      setLedgerErr("Verification request failed: " + err.message);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleHashTimeline = async () => {
    setHashingLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.hashTimelineLedger(token);
      setSuccess("PHR Timeline state successfully computed, hashed, and appended to compliance ledger.");
      refreshData();
    } catch (err: any) {
      setError(err.message || "Failed to commit ledger block");
    } finally {
      setHashingLoading(false);
    }
  };

  const handleRunRedTeam = async () => {
    setSimulatorRunning(true);
    setError("");
    setSuccess("");
    try {
      await api.runRedTeamSimulator(token);
      setSuccess("Clinical Safety Red-Teaming Simulator run completed successfully!");
      refreshData();
    } catch (err: any) {
      setError(err.message || "Simulator execution failed");
    } finally {
      setSimulatorRunning(false);
    }
  };

  const handleTriggerDriftCheck = async () => {
    setError("");
    setSuccess("");
    try {
      const alerts = await api.checkGuidelineDrift(token);
      setSuccess(`Completed guideline drift verification. Detected alerts: ${alerts.length}`);
      refreshData();
    } catch (err: any) {
      setError(err.message || "Guideline audit execution failed");
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
      {/* Red team simulation */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <AlertOctagon size={18} style={{ color: "var(--accent)" }} />
          Clinical Safety & Adversarial Red-Teaming
        </h3>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Run simulated LLM adversarial attacks to evaluate clinical safety parameters, refusal rates, and guardrails.
        </p>

        {redTeamScore && (
          <div style={{ padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "0.85rem" }}>
            <strong>Safety Metrics:</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "8px" }}>
              <div>Refusal Safety Score: <strong style={{ color: "green" }}>{redTeamScore.drift_score}%</strong></div>
              <div>Simulated Attack Runs: <strong>{redTeamScore.total_runs}</strong></div>
            </div>
          </div>
        )}

        <button 
          onClick={handleRunRedTeam} 
          className="button" 
          disabled={simulatorRunning}
          style={{ background: simulatorRunning ? "var(--muted)" : "var(--accent)", color: "white" }}
        >
          {simulatorRunning ? "Attacking Model Guardrails..." : "⚡ Run Adversarial Simulation"}
        </button>

        <h4 style={{ fontSize: "0.9rem", marginBottom: "4px" }}>Simulated Red-Teaming Logs</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto" }}>
          {redTeamLogs.map((log, idx) => (
            <div key={idx} style={{ padding: "8px", background: "rgba(255,0,0,0.02)", borderRadius: "6px", border: "1px solid rgba(255,0,0,0.1)", fontSize: "0.75rem" }}>
              <div style={{ color: "var(--accent)", fontWeight: 600 }}>Prompt: "{log.prompt}"</div>
              <div style={{ color: "rgba(255,255,255,0.7)", marginTop: "4px" }}>Reply: {log.reply}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "0.7rem", color: "var(--muted)" }}>
                <span>Guardrail Label: {log.label}</span>
                <span style={{ color: log.is_safe ? "green" : "red" }}>{log.is_safe ? "🛡️ BLOCKED (SAFE)" : "⚠️ LEAKED (UNSAFE)"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Ledger & Guideline Drift */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <ShieldCheck size={18} style={{ color: "var(--primary)" }} />
          Tamper-Proof PHR Ledger & Auditing
        </h3>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Blockchain-grounded patient timelines prevent back-dated medical changes. Verify blockchain state integrity.
        </p>

        {error && <div className="toast toast-error">{error}</div>}
        {success && <div className="toast toast-success">{success}</div>}

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleVerifyLedger} className="button" disabled={ledgerLoading}>
            {ledgerLoading ? "Validating hashes..." : "🔍 Verify Ledger Integrity"}
          </button>
          <button onClick={handleHashTimeline} className="button-sec" disabled={hashingLoading}>
            {hashingLoading ? "Computing block..." : "🔒 Commit Timeline Block"}
          </button>
        </div>

        {ledgerValid !== null && (
          <div style={{ padding: "10px", borderRadius: "8px", border: "1px solid", borderColor: ledgerValid ? "green" : "red", background: ledgerValid ? "rgba(0,255,0,0.05)" : "rgba(255,0,0,0.05)", fontSize: "0.8rem", color: ledgerValid ? "green" : "red" }}>
            {ledgerValid ? "✔ Compliance Ledger state is verified and intact. No tampering detected." : `❌ Tamper warning: ${ledgerErr}`}
          </div>
        )}

        <h4 style={{ fontSize: "0.9rem", marginBottom: "4px" }}>Active Guideline Drift Alerts</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto" }}>
          {driftAlerts.map(alert => (
            <div key={alert.id} style={{ padding: "8px", background: "rgba(241,196,15,0.05)", borderRadius: "6px", border: "1px solid rgba(241,196,15,0.2)", fontSize: "0.75rem" }}>
              <strong>{alert.guideline_title}</strong> ({alert.published_source})
              <div style={{ color: "var(--muted)", marginTop: "2px" }}>Reason: {alert.drift_reason}</div>
            </div>
          ))}
          {driftAlerts.length === 0 && (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>No guideline drift issues flagged.</p>
          )}
        </div>
        {sessionRole === "hospital_admin" && (
          <button onClick={handleTriggerDriftCheck} className="button-sec" style={{ alignSelf: "flex-end" }}>Run Guideline Drift Check</button>
        )}
      </div>
    </div>
  );
};
