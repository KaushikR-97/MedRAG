import React, { useEffect, useState } from "react";
import { User, Lock, KeyRound } from "lucide-react";
import { api, AuthResponse } from "../api/client";

type UserProfileModuleProps = {
  token: string;
  session: AuthResponse;
  onLogout: () => void;
  onProfileUpdate: (newName: string) => void;
};

export const UserProfileModule: React.FC<UserProfileModuleProps> = ({ token, session, onLogout, onProfileUpdate }) => {
  // Update Profile States
  const [fullName, setFullName] = useState(session.full_name || "");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [speciality, setSpeciality] = useState("");

  // Change Password States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.getMe(token)
      .then((me) => {
        if (cancelled) return;
        setFullName(me.full_name || session.full_name || "");
        setPhone(me.phone || "");
        setAge(me.age ? String(me.age) : "");
        setCity(me.city || "");
        setSpeciality(me.speciality || "");
      })
      .catch((err) => {
        console.warn("Profile details could not be loaded", err);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.updateProfile(token, {
        full_name: fullName,
        phone: phone || undefined,
        age: age ? parseInt(age) : undefined,
        city: city || undefined,
        speciality: speciality || undefined
      });
      setSuccess("Profile settings updated successfully.");
      onProfileUpdate(fullName);
    } catch (err: any) {
      setError(err.message || "Failed to update profile details");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.changePassword(token, {
        current_password: currentPassword,
        new_password: newPassword
      });
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      setError(err.message || "Password change failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
      {/* Profile Details Edit */}
      <div className="card">
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <User size={18} style={{ color: "var(--primary)" }} />
          Account & Profile Settings
        </h3>
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: "14px" }}>
          User ID: <span style={{ color: "var(--primary)", fontFamily: "monospace" }}>{session.user_id}</span> | Role: {session.role}
        </p>

        {error && <div className="toast toast-error" style={{ marginBottom: "12px" }}>{error}</div>}
        {success && <div className="toast toast-success" style={{ marginBottom: "12px" }}>{success}</div>}

        <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label className="label">Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="input" required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="label">Phone Contact</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="input" placeholder="+91..." />
            </div>
            <div>
              <label className="label">Age</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} className="input" placeholder="Years" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="label">City Location</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} className="input" />
            </div>
            {session.role === "doctor" && (
              <div>
                <label className="label">Medical Specialty</label>
                <input type="text" value={speciality} onChange={e => setSpeciality(e.target.value)} className="input" placeholder="Cardiology" />
              </div>
            )}
          </div>
          <button type="submit" className="button" disabled={loading} style={{ marginTop: "10px" }}>
            Update Profile Info
          </button>
        </form>
      </div>

      {/* Password and Logout */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div>
          <h3 style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <Lock size={16} style={{ color: "var(--primary)" }} />
            Security & Credentials
          </h3>
          <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label className="label">Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">New Secure Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input" placeholder="Min 10 characters" required />
            </div>
            <button type="submit" className="button" disabled={loading}>
              Change Password
            </button>
          </form>
        </div>

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "20px" }}>
          <h4 style={{ fontSize: "0.9rem", marginBottom: "8px" }}>Sign Out Session</h4>
          <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginBottom: "12px" }}>
            Signing out will invalidate your active JSON Web Token (JWT) session immediately.
          </p>
          <button onClick={onLogout} className="button" style={{ background: "#c0392b", color: "white" }}>
            Logout Session
          </button>
        </div>
      </div>
    </div>
  );
};
