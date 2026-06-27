import React, { useEffect, useState } from "react";
import { ShieldCheck, Users, Plus, RefreshCw } from "lucide-react";
import { api } from "../api/client";

type FamilyConsentModuleProps = {
  token: string;
};

export const FamilyConsentModule: React.FC<FamilyConsentModuleProps> = ({ token }) => {
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<any[]>([]);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [fullName, setFullName] = useState("");
  const [relation, setRelation] = useState("spouse");
  const [age, setAge] = useState("");
  const [notes, setNotes] = useState("");
  const [scope, setScope] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refreshData = async () => {
    try {
      const [members, logs] = await Promise.all([
        api.listFamilyMembers(token),
        api.whatsappLogs(token),
      ]);
      const requests = await api.listPatientAccessRequests(token, "pending");
      setFamilyMembers(members);
      setWhatsappLogs(logs);
      setAccessRequests(requests);
    } catch (err: any) {
      setError(err.message || "Could not load family and consent records");
    }
  };

  useEffect(() => {
    refreshData();
  }, [token]);

  const handleRegisterFamily = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.registerFamily(token, {
        full_name: fullName,
        relation,
        age: age ? Number(age) : 0,
        notes,
        scope,
      });
      setFullName("");
      setAge("");
      setNotes("");
      setSuccess("Family member linked and consent grant created.");
      await refreshData();
    } catch (err: any) {
      setError(err.message || "Could not link family member");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (consentId: string) => {
    setError("");
    setSuccess("");
    try {
      await api.triggerWhatsappAlert(token, { consent_grant_id: consentId });
      setSuccess("Consent reminder sent in demo WhatsApp log.");
      await refreshData();
    } catch (err: any) {
      setError(err.message || "Could not send consent reminder");
    }
  };

  const handleRenewConsent = async (consentId: string) => {
    setError("");
    setSuccess("");
    try {
      await api.renewWhatsappConsent(token, { consent_grant_id: consentId });
      setSuccess("Consent extended for 30 days.");
      await refreshData();
    } catch (err: any) {
      setError(err.message || "Could not renew consent");
    }
  };

  const handleApproveAccess = async (requestId: string) => {
    setError("");
    setSuccess("");
    try {
      await api.approvePatientAccessRequest(token, requestId);
      setSuccess("Doctor access approved for 30 days.");
      await refreshData();
    } catch (err: any) {
      setError(err.message || "Could not approve access request");
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: "24px" }}>
      <div className="card">
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <Users size={18} style={{ color: "var(--primary)" }} />
          Link Family / Caregiver
        </h3>

        {error && <div className="toast toast-error" style={{ marginBottom: "12px" }}>{error}</div>}
        {success && <div className="toast toast-success" style={{ marginBottom: "12px" }}>{success}</div>}

        <form onSubmit={handleRegisterFamily} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr", gap: "12px" }}>
            <div>
              <label className="label">Relation</label>
              <select className="input" value={relation} onChange={(event) => setRelation(event.target.value)}>
                <option value="spouse">Spouse</option>
                <option value="parent">Parent</option>
                <option value="child">Child</option>
                <option value="sibling">Sibling</option>
                <option value="caregiver">Caregiver</option>
              </select>
            </div>
            <div>
              <label className="label">Age</label>
              <input className="input" type="number" value={age} onChange={(event) => setAge(event.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Consent Scope</label>
            <select className="input" value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value="all">All care coordination</option>
              <option value="profile.read">Profile only</option>
              <option value="documents.read">Documents only</option>
              <option value="clinical.ask">Clinical assistant only</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <button className="button" disabled={loading} type="submit">
            <Plus size={16} />
            {loading ? "Linking..." : "Link Family Member"}
          </button>
        </form>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
          <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px" }}>
            <ShieldCheck size={18} style={{ color: "var(--primary)" }} />
            Family Consent Ledger
          </h3>
          <button className="button-sec" onClick={refreshData}>
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {accessRequests.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "8px" }}>
              <h4 style={{ fontSize: "0.95rem" }}>Doctor Access Requests</h4>
              {accessRequests.map((request) => (
                <div key={request.id} style={{ border: "1px solid rgba(0,169,255,0.28)", borderRadius: "8px", padding: "12px", background: "rgba(0,169,255,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                    <div>
                      <strong>{request.requester_name}</strong>
                      <div style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: "3px" }}>
                        Scope: {request.scope} | Purpose: {request.purpose}
                      </div>
                    </div>
                    <button className="button" onClick={() => handleApproveAccess(request.id)}>Approve</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {familyMembers.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No family members linked yet.</p>
          ) : (
            familyMembers.map((member) => {
              const consent = member.active_consent;
              return (
                <div key={member.id} style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "12px", background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                    <div>
                      <strong>{member.full_name}</strong>
                      <div style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: "3px" }}>
                        {member.relation} | Scope: {consent?.scope || "none"} | Expires: {consent?.expires_at || "not set"}
                      </div>
                    </div>
                    {consent && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="button-sec" onClick={() => handleSendReminder(consent.id)}>Send Alert</button>
                        <button className="button" onClick={() => handleRenewConsent(consent.id)}>Renew</button>
                      </div>
                    )}
                  </div>
                  {member.notes && <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: "8px" }}>{member.notes}</p>}
                </div>
              );
            })
          )}
        </div>

        <div>
          <h4 style={{ fontSize: "0.95rem", marginBottom: "10px" }}>Demo WhatsApp Consent Alerts</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "220px", overflowY: "auto" }}>
            {whatsappLogs.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>No consent alerts sent yet.</p>
            ) : (
              whatsappLogs.map((log) => (
                <div key={log.id} style={{ padding: "10px", border: "1px solid rgba(37,211,102,0.2)", borderRadius: "8px", background: "rgba(37,211,102,0.05)" }}>
                  <div style={{ color: "#25d366", fontWeight: 700, fontSize: "0.78rem" }}>To {log.to_phone} | {log.status}</div>
                  <p style={{ margin: "5px 0 0 0", color: "var(--ink)", fontSize: "0.78rem" }}>{log.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
