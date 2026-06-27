import React, { useState, useEffect } from "react";
import { Globe, Users, Sparkles } from "lucide-react";
import { api } from "../api/client";

type PublicHealthModuleProps = {
  token: string;
};

export const PublicHealthModule: React.FC<PublicHealthModuleProps> = ({ token }) => {
  const [cohortCondition, setCohortCondition] = useState("Diabetes");
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(70);
  const [cohortList, setCohortList] = useState<any[]>([]);
  const [cohortLoading, setCohortLoading] = useState(false);

  // Outbreak heatmap logs
  const [outbreakList, setOutbreakList] = useState<any[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

  const [error, setError] = useState("");

  const refreshData = async () => {
    setMapLoading(true);
    try {
      const res = await api.getOutbreakMap(token);
      setOutbreakList(res.heatmap || []);
    } catch (err: any) {
      console.error("Failed to load outbreak map", err);
    } finally {
      setMapLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [token]);

  const handleGenerateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    setCohortLoading(true);
    setError("");
    setCohortList([]);
    try {
      const res = await api.generateCohort(token, {
        chronic_condition: cohortCondition,
        min_age: minAge,
        max_age: maxAge
      });
      setCohortList(res);
    } catch (err: any) {
      setError(err.message || "Failed to generate cohort");
    } finally {
      setCohortLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
      {/* Public health cohort builder */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <Users size={18} style={{ color: "var(--primary)" }} />
          De-identified Clinical Cohort Builder
        </h3>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Generate anonymous patient cohorts based on chronic conditions and age ranges for clinical research.
        </p>

        {error && <div className="toast toast-error">{error}</div>}

        <form onSubmit={handleGenerateCohort} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label className="label">Chronic Condition</label>
            <input type="text" value={cohortCondition} onChange={e => setCohortCondition(e.target.value)} className="input" placeholder="Asthma, Diabetes" required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="label">Min Age</label>
              <input type="number" value={minAge} onChange={e => setMinAge(parseInt(e.target.value) || 0)} className="input" required />
            </div>
            <div>
              <label className="label">Max Age</label>
              <input type="number" value={maxAge} onChange={e => setMaxAge(parseInt(e.target.value) || 0)} className="input" required />
            </div>
          </div>
          <button type="submit" className="button" disabled={cohortLoading}>
            {cohortLoading ? "Analyzing EHR Registry..." : "Generate Cohort"}
          </button>
        </form>

        <h4 style={{ fontSize: "0.9rem", marginBottom: "4px" }}>Cohort Results ({cohortList.length})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
          {cohortList.map((c, i) => (
            <div key={i} style={{ padding: "8px", background: "rgba(255,255,255,0.01)", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "0.75rem" }}>
              Patient ID: {c.id.slice(0, 8)}... | Gender: {c.gender} | Age: {c.age} | Conditions: {c.chronic_conditions} | Events: {c.timeline_events_count}
            </div>
          ))}
          {cohortList.length === 0 && !cohortLoading && (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center" }}>No cohort generated yet.</p>
          )}
        </div>
      </div>

      {/* Outbreak Heatmap List */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <Globe size={18} style={{ color: "var(--primary)" }} />
          National Disease Outbreak & Epidemic Map
        </h3>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Real-time disease case indicators mapped from clinical logs and diagnostic reports.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "400px", overflowY: "auto" }}>
          {mapLoading ? (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Fetching national outbreak registries...</p>
          ) : outbreakList.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", textAlign: "center" }}>No active outbreaks flagged.</p>
          ) : (
            outbreakList.map((item, idx) => (
              <div key={idx} style={{ padding: "12px", background: item.severity === "high" ? "rgba(231,76,60,0.05)" : "rgba(241,196,15,0.05)", borderRadius: "8px", border: "1px solid", borderColor: item.severity === "high" ? "rgba(231,76,60,0.2)" : "rgba(241,196,15,0.2)", fontSize: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: item.severity === "high" ? "#e74c3c" : "#f1c40f", marginBottom: "4px" }}>
                  <span>{item.disease.toUpperCase()} OUTBREAK DETECTED</span>
                  <span>{item.cases_count} cases</span>
                </div>
                <div>Location: {item.city}, {item.state}</div>
                <div style={{ color: "var(--muted)", marginTop: "4px" }}>{item.message}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
