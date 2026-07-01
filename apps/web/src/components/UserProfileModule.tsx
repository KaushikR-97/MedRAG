import React, { useEffect, useState } from "react";
import { User, Lock, ImagePlus } from "lucide-react";
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
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [speciality, setSpeciality] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");

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
        setGender(me.gender || "");
        setCity(me.city || "");
        setSpeciality(me.speciality || "");
        setProfileImageUrl(me.profile_image_url || "");
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
        gender: gender || undefined,
        city: city || undefined,
        speciality: speciality || undefined,
        profile_image_url: profileImageUrl || "",
      });
      setSuccess("Profile settings updated successfully.");
      onProfileUpdate(fullName);
    } catch (err: any) {
      setError(err.message || "Failed to update profile details");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileImageFile = (file?: File) => {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file for the profile picture.");
      return;
    }
    if (file.size > 90_000) {
      setError("Profile image must be under 90 KB for this demo storage mode.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfileImageUrl(String(reader.result || ""));
    reader.onerror = () => setError("Could not read the selected image.");
    reader.readAsDataURL(file);
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
          {session.role === "doctor" && (
            <div style={{ display: "grid", gridTemplateColumns: "76px 1fr", gap: "14px", alignItems: "center", padding: "12px", border: "1px solid var(--line)", borderRadius: "8px", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", overflow: "hidden", border: "1px solid var(--line)", display: "grid", placeItems: "center", background: "rgba(14,165,233,0.12)", color: "var(--primary)", fontWeight: 800 }}>
                {profileImageUrl ? (
                  <img src={profileImageUrl} alt="Doctor profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span>{(fullName || "DR").slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <label className="label">Doctor Profile Picture</label>
                <input className="input" type="file" accept="image/*" onChange={(event) => handleProfileImageFile(event.target.files?.[0])} />
                <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                  <button type="button" className="button-sec" onClick={() => setProfileImageUrl("")} style={{ minHeight: "30px", padding: "4px 10px", fontSize: "0.75rem" }}>
                    Clear
                  </button>
                  <span style={{ color: "var(--muted)", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <ImagePlus size={14} /> Used on patient booking cards and appointment lists.
                  </span>
                </div>
              </div>
            </div>
          )}
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
            {session.role === "patient" && (
              <div>
                <label className="label">Gender</label>
                <select value={gender} onChange={e => setGender(e.target.value)} className="input">
                  <option value="">Select gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            )}
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
