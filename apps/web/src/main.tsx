import React, { useMemo, useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Sparkles, FileText, Users, Building2, ShieldCheck, Heart, User, Clock, AlertTriangle, LucideIcon
} from "lucide-react";
import { api, AuthResponse, AppointmentRecord, ConsultationRoomRecord, ConsultationMessageRecord } from "./api/client";
import "./styles.css";

// Import modular components
import { AuthModule } from "./components/AuthModule";
import { PatientDashboard } from "./components/PatientDashboard";
import { ClinicalAIModule } from "./components/ClinicalAIModule";
import { DocumentManager } from "./components/DocumentManager";
import { CareRemindersModule } from "./components/CareRemindersModule";
import { HospitalSlotsModule } from "./components/HospitalSlotsModule";
import { DoctorWorkspace } from "./components/DoctorWorkspace";
import { ComplianceModule } from "./components/ComplianceModule";
import { PublicHealthModule } from "./components/PublicHealthModule";
import { UserProfileModule } from "./components/UserProfileModule";
import { PatientDoctorChatModule } from "./components/PatientDoctorChatModule";
import { FamilyConsentModule } from "./components/FamilyConsentModule";
import { AdminHospitalModule } from "./components/AdminHospitalModule";
import { translations, Language } from "./utils/translations";

const HD_VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};
const VIDEO_SENDER_BITRATE_BPS = 2_500_000;

type StoredEnvelope<T> = {
  version: number;
  savedAt: number;
  value: T;
};

type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  encodedText: string;
  timestamp: number;
};

type AppTab = "home" | "clinical" | "documents" | "care" | "hospitals" | "trust" | "doctor" | "profile" | "public-health" | "family" | "chat";

type NavItem = {
  tab: AppTab;
  label: string;
  icon: LucideIcon;
};

const patientNavItems: NavItem[] = [
  { tab: "home", label: "Patient Home", icon: Heart },
  { tab: "hospitals", label: "Book A Doctor", icon: Building2 },
  { tab: "clinical", label: "Ask Health AI", icon: Sparkles },
  { tab: "chat", label: "Doctor Chat", icon: Users },
  { tab: "documents", label: "My Reports", icon: FileText },
  { tab: "care", label: "Medicines & Reminders", icon: Clock },
  { tab: "family", label: "Family Care", icon: Users },
  { tab: "trust", label: "Privacy & Access", icon: ShieldCheck },
];

const doctorNavItems: NavItem[] = [
  { tab: "doctor", label: "Doctor Dashboard", icon: Users },
  { tab: "clinical", label: "Clinical AI Assistant", icon: Sparkles },
  { tab: "hospitals", label: "Slots & Appointments", icon: Building2 },
  { tab: "trust", label: "Consent / Break-Glass Audit", icon: ShieldCheck },
];

const adminNavItems: NavItem[] = [
  { tab: "hospitals", label: "Doctors & Departments", icon: Building2 },
  { tab: "trust", label: "Audit Ledger", icon: ShieldCheck },
  { tab: "public-health", label: "Epidemiological Maps", icon: Building2 },
  { tab: "clinical", label: "Guideline Intelligence", icon: Sparkles },
  { tab: "documents", label: "Document Registry", icon: FileText },
];

const tabTitles: Record<AppTab, string> = {
  home: "Patient Home",
  clinical: "Ask Health AI",
  documents: "My Reports",
  care: "Care Reminders",
  hospitals: "Book A Doctor",
  trust: "Privacy & Access",
  doctor: "Doctor Dashboard",
  profile: "Settings",
  "public-health": "Epidemiological Maps",
  family: "Family & Consent",
  chat: "Chat With Doctors",
};

function getRoleNavItems(role: string): NavItem[] {
  if (role === "doctor") return doctorNavItems;
  if (role === "hospital_admin" || role === "admin") return adminNavItems;
  return patientNavItems;
}

function getDefaultTab(role: string): AppTab {
  if (role === "doctor") return "doctor";
  if (role === "hospital_admin" || role === "admin") return "hospitals";
  return "home";
}

function normalizeSession(session: AuthResponse): AuthResponse {
  return {
    ...session,
    role: (session.role || "patient").toLowerCase(),
    full_name: session.full_name || "",
  };
}

function readUserChatMessages(_userId: string): ChatMessage[] {
  // Chat history is strictly in-memory to prevent storing PHI in localStorage
  return [];
}

function PatientOnboarding({
  token,
  session,
  onComplete,
}: {
  token: string;
  session: AuthResponse;
  onComplete: (next: AuthResponse) => void;
}) {
  const [age, setAge] = useState(session.age ? String(session.age) : "");
  const [gender, setGender] = useState(session.gender || "");
  const [city, setCity] = useState(session.city || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const profile = await api.updateProfile(token, {
        age: Number(age),
        gender,
        city: city.trim(),
      });
      onComplete({
        ...session,
        age: profile.age,
        city: profile.city,
        gender: profile.gender,
        full_name: profile.full_name || session.full_name,
      });
    } catch (err: any) {
      setError(err.message || "Could not save onboarding details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
      <form className="card" onSubmit={save} style={{ width: "min(460px, 100%)", display: "flex", flexDirection: "column", gap: "14px" }}>
        <h2 style={{ fontSize: "1.25rem" }}>Complete Patient Onboarding</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          These details help match doctors, hospitals, slots, ambulances, and rooms from your city by default.
        </p>
        {error && <div className="toast toast-error">{error}</div>}
        <div>
          <label className="label">Age</label>
          <input className="input" type="number" min={0} max={130} value={age} onChange={(event) => setAge(event.target.value)} required />
        </div>
        <div>
          <label className="label">Gender</label>
          <select className="input" value={gender} onChange={(event) => setGender(event.target.value)} required>
            <option value="">Select gender</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
        <div>
          <label className="label">City / Location</label>
          <input className="input" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Bengaluru" required />
        </div>
        <button className="button" disabled={saving} type="submit">{saving ? "Saving..." : "Continue"}</button>
      </form>
    </div>
  );
}

function App() {
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);
  const token = session?.access_token || "";

  // Navigation tab
  const [currentTab, setCurrentTab] = useState<AppTab>("home");
  const [lang, setLang] = useState<Language>("en");

  // Local consult secure chat fallback state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Video call state
  const [activeVideoCall, setActiveVideoCall] = useState<AppointmentRecord | null>(null);
  const [consultationRoom, setConsultationRoom] = useState<ConsultationRoomRecord | null>(null);
  const [consultationMessages, setConsultationMessages] = useState<ConsultationMessageRecord[]>([]);
  
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    const handleExpiredAuth = () => {
      setSession(null);
      setCurrentTab("home");
      setActiveVideoCall(null);
      setConsultationRoom(null);
    };
    window.addEventListener("medrag:auth-expired", handleExpiredAuth);
    return () => window.removeEventListener("medrag:auth-expired", handleExpiredAuth);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.refreshSession()
      .then((restored) => {
        if (!cancelled) setSession(normalizeSession(restored));
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setRestoringSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<"idle" | "connecting" | "connected" | "blocked" | "failed">("idle");
  const [videoQualityLabel, setVideoQualityLabel] = useState("HD requested");
  const [error, setError] = useState("");
  const [myAppointmentsList, setMyAppointmentsList] = useState<AppointmentRecord[]>([]);

  // Memoized conversations for appointment chat plus local fallback messages
  const activeConversations = useMemo(() => {
    if (!session) return [];
    const conversationsMap: { [key: string]: { id: string; name: string; lastMessage: string; timestamp: number; appointment?: AppointmentRecord } } = {};
    myAppointmentsList.forEach((appointment) => {
      if (appointment.status !== "confirmed") return;
      const otherId = session.role === "doctor" ? appointment.patient_id : appointment.doctor_id;
      if (!otherId) return;
      conversationsMap[otherId] = {
        id: otherId,
        name: session.role === "doctor"
          ? appointment.patient_name || `Patient ${otherId.slice(0, 6)}`
          : appointment.doctor_name || `Doctor ${otherId.slice(0, 6)}`,
        lastMessage: appointment.booking_reference || "Booked consultation",
        timestamp: Date.parse(appointment.date || "") || 0,
        appointment,
      };
    });
    chatMessages.forEach(msg => {
      const otherId = msg.senderId === session.user_id ? msg.recipientId : msg.senderId;
      const otherName = msg.senderId === session.user_id ? msg.recipientName : msg.senderName;
      
      const decrypted = "[Secure AES-GCM Encrypted]";
      
      const isNewer = !conversationsMap[otherId] || msg.timestamp > conversationsMap[otherId].timestamp;
      if (isNewer) {
        conversationsMap[otherId] = {
          id: otherId,
          name: otherName || "Anonymous User",
          lastMessage: decrypted,
          timestamp: msg.timestamp
        };
      }
    });
    return Object.values(conversationsMap).sort((a, b) => b.timestamp - a.timestamp);
  }, [chatMessages, session, myAppointmentsList]);

  // Load chat messages
  useEffect(() => {
    if (!session?.user_id) {
      setChatMessages([]);
      return;
    }
    setChatMessages(readUserChatMessages(session.user_id));
  }, [session?.user_id]);

  const refreshAppointments = async () => {
    if (!token) return;
    try {
      const appts = await api.listMyAppointments(token);
      setMyAppointmentsList(appts);
    } catch (err: any) {
      console.error("Failed to load appointments", err);
    }
  };

  useEffect(() => {
    refreshAppointments();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(refreshAppointments, 10000);
    return () => window.clearInterval(timer);
  }, [token]);

  useEffect(() => {
    if (!token || !session) return;
    let cancelled = false;
    api.getMe(token)
      .then((me) => {
        if (cancelled) return;
        const refreshed = normalizeSession({
          ...session,
          user_id: me.id || session.user_id,
          role: me.role || session.role,
          full_name: me.full_name || session.full_name,
          age: me.age,
          city: me.city,
          gender: me.gender,
          profile_image_url: me.profile_image_url,
        });
        setSession(refreshed);
      })
      .catch((err) => {
        console.warn("Could not refresh signed-in profile", err);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!session) return;
    const allowedTabs = new Set<AppTab>([
      ...getRoleNavItems(session.role).map((item) => item.tab),
      "profile",
    ]);
    if (!allowedTabs.has(currentTab)) {
      setCurrentTab(getDefaultTab(session.role));
    }
  }, [session?.role, currentTab]);

  // WebRTC handlers
  function handleStartVideoCall(appt: AppointmentRecord) {
    if (appt.consultation_mode !== "video") {
      setError("This is an offline consultation. No video room is created for in-person appointments.");
      return;
    }
    setActiveVideoCall(appt);
  }

  function stopConsultationMedia() {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    pendingIceCandidatesRef.current = [];
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setMediaStatus("idle");
  }

  async function ensurePeerConnection(appointmentId: string): Promise<RTCPeerConnection> {
    if (peerConnectionRef.current) return peerConnectionRef.current;
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { 
          urls: "turn:openrelay.metered.ca:80", 
          username: "openrelayproject", 
          credential: "openrelayproject" 
        },
        { 
          urls: "turn:openrelay.metered.ca:443", 
          username: "openrelayproject", 
          credential: "openrelayproject" 
        },
        { 
          urls: "turn:openrelay.metered.ca:443?transport=tcp", 
          username: "openrelayproject", 
          credential: "openrelayproject" 
        }
      ],
    });
    peer.onicecandidate = (event) => {
      if (event.candidate && token) {
        api.postConsultationSignal(token, appointmentId, {
          signal_type: "ice",
          payload: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            usernameFragment: event.candidate.usernameFragment,
          },
        }).catch((err) => console.error("Failed to send ICE candidate", err));
      }
    };
    peer.ontrack = (event) => {
      let [remoteStream] = event.streams;
      if (!remoteStream) {
        remoteStream = new MediaStream([event.track]);
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => undefined);
      }
    };
    peerConnectionRef.current = peer;
    return peer;
  }

  async function startVideoMedia(appointmentId: string) {
    if (!token) return;
    setMediaStatus("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia(HD_VIDEO_CONSTRAINTS);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      const peer = await ensurePeerConnection(appointmentId);
      const existingTrackIds = new Set(peer.getSenders().map((sender) => sender.track?.id).filter(Boolean));
      stream.getTracks().forEach((track) => {
        if (!existingTrackIds.has(track.id)) peer.addTrack(track, stream);
      });
      const videoTrack = stream.getVideoTracks()[0];
      const videoSettings = videoTrack?.getSettings();
      if (videoSettings?.width && videoSettings?.height) {
        setVideoQualityLabel(`${videoSettings.width}x${videoSettings.height}${videoSettings.frameRate ? ` @ ${Math.round(videoSettings.frameRate)}fps` : ""}`);
      }
      for (const sender of peer.getSenders()) {
        if (sender.track?.kind !== "video") continue;
        const params = sender.getParameters();
        params.encodings = params.encodings?.length ? params.encodings : [{}];
        params.encodings[0] = {
          ...params.encodings[0],
          maxBitrate: VIDEO_SENDER_BITRATE_BPS,
          maxFramerate: 30,
          scaleResolutionDownBy: 1,
        };
        await sender.setParameters(params).catch((err) => console.warn("Could not apply HD sender parameters", err));
      }
      setMediaStatus("connected");

      if (session?.role === "doctor") {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await api.postConsultationSignal(token, appointmentId, {
          signal_type: "offer",
          payload: { type: offer.type, sdp: offer.sdp },
        });
      }
      await handleConsultationSignals(appointmentId);
    } catch (err) {
      setMediaStatus(err instanceof DOMException && err.name === "NotAllowedError" ? "blocked" : "failed");
      setError(err instanceof Error ? err.message : "Could not start camera and microphone");
    }
  }

  async function handleConsultationSignals(appointmentId: string) {
    if (!token) return;
    const peer = await ensurePeerConnection(appointmentId);
    const signals = await api.pollConsultationSignals(token, appointmentId);
    for (const signal of signals) {
      if (signal.signal_type === "offer") {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.payload as unknown as RTCSessionDescriptionInit));
        for (const candidate of pendingIceCandidatesRef.current.splice(0)) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await api.postConsultationSignal(token, appointmentId, {
          signal_type: "answer",
          payload: { type: answer.type, sdp: answer.sdp },
        });
      }
      if (signal.signal_type === "answer") {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.payload as unknown as RTCSessionDescriptionInit));
        for (const candidate of pendingIceCandidatesRef.current.splice(0)) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
      if (signal.signal_type === "ice") {
        const candidate = signal.payload as unknown as RTCIceCandidateInit;
        if (peer.remoteDescription) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          pendingIceCandidatesRef.current.push(candidate);
        }
      }
      if (signal.signal_type === "leave") {
        stopConsultationMedia();
      }
    }
  }

  useEffect(() => {
    if (!token || !activeVideoCall) {
      setConsultationRoom(null);
      setConsultationMessages([]);
      return;
    }

    let cancelled = false;
    const currentCall = activeVideoCall;
    async function joinRoom() {
      try {
        const room = await api.joinConsultationRoom(token, currentCall.id);
        if (cancelled) return;
        setConsultationRoom(room);
        const messages = await api.listConsultationMessages(token, currentCall.id);
        if (!cancelled) setConsultationMessages(messages);
        await startVideoMedia(currentCall.id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to join consultation room");
      }
    }

    joinRoom();
    return () => {
      cancelled = true;
    };
  }, [token, activeVideoCall?.id]);

  useEffect(() => {
    if (!token || !activeVideoCall || !consultationRoom) return;
    const interval = window.setInterval(async () => {
      try {
        const lastId = consultationMessages.length ? consultationMessages[consultationMessages.length - 1].id : "";
        const nextMessages = await api.listConsultationMessages(token, activeVideoCall.id, lastId);
        if (nextMessages.length) {
          setConsultationMessages((prev) => {
            const seen = new Set(prev.map((message) => message.id));
            return [...prev, ...nextMessages.filter((message) => !seen.has(message.id))];
          });
        }
        await handleConsultationSignals(activeVideoCall.id);
      } catch (err) {
        console.error("Consultation room polling failed", err);
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [token, activeVideoCall?.id, consultationRoom?.id, consultationMessages]);

  useEffect(() => {
    if (!activeVideoCall) {
      stopConsultationMedia();
    }
    return () => stopConsultationMedia();
  }, [activeVideoCall?.id]);

  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
  }, [isMuted]);

  useEffect(() => {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !isCameraOff;
    });
  }, [isCameraOff]);

  const handleLogout = async () => {
    if (token) {
      try {
        await api.logout(token);
      } catch (e) {
        console.error("Logout request failed", e);
      }
    }
    setSession(null);
  };

  const handleProfileUpdate = (newName: string) => {
    if (session) {
      const updated = { ...session, full_name: newName };
      setSession(updated);
    }
  };

  if (restoringSession) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
        <div className="card" style={{ width: "min(360px, 100%)", textAlign: "center" }}>
          <Sparkles style={{ color: "var(--primary)", marginBottom: "12px" }} />
          <div style={{ fontWeight: 700 }}>Restoring secure session...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <AuthModule 
        onLoginSuccess={(newSession, token) => {
          const normalized = normalizeSession(newSession);
          setSession(normalized);
        }} 
      />
    );
  }

  if (session.role === "patient" && (!session.age || !session.city || !session.gender)) {
    return (
      <PatientOnboarding
        token={token}
        session={session}
        onComplete={(next) => {
          const normalized = normalizeSession(next);
          setSession(normalized);
        }}
      />
    );
  }

  const t = (key: string) => translations[lang][key] || key;
  const navItems = getRoleNavItems(session.role);
  const currentPageTitle = navItems.find((item) => item.tab === currentTab)?.label || tabTitles[currentTab];

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="app-brand">
          <Sparkles style={{ color: "var(--primary)" }} />
          <div>
            <strong>{t("dashboard_title")}</strong>
            <span>Your health companion</span>
          </div>
        </div>

        {/* Global Demo mode badge */}
        <div className="demo-badge">
          <AlertTriangle size={12} />
          DEMO MODE
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.tab} onClick={() => setCurrentTab(item.tab)} className={`button-sec nav-button ${currentTab === item.tab ? "active" : ""}`}>
              <Icon size={16} /> {item.label}
            </button>
          );
        })}
        <button onClick={() => setCurrentTab("profile")} className={`button-sec nav-button profile-nav ${currentTab === "profile" ? "active" : ""}`}>
          <User size={16} /> {t("settings_panel")}
        </button>
      </aside>

      {/* Main layout frame */}
      <main className="app-content">
        <header className="app-header">
          <div>
            <div className="page-kicker">MedRAG India</div>
            <h1>{currentPageTitle}</h1>
          </div>
          <div className="header-actions">
            <select 
              value={lang} 
              onChange={e => setLang(e.target.value as Language)} 
              className="language-select"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="bn">বাংলা (Bengali)</option>
            </select>
            <span className="signed-in-pill">Signed in as <strong>{session.full_name || session.role}</strong></span>
          </div>
        </header>

        {currentTab === "home" && <PatientDashboard token={token} session={session} onNavigate={setCurrentTab} />}
        {currentTab === "clinical" && <ClinicalAIModule token={token} patientId={session.user_id} userRole={session.role} />}
        {currentTab === "documents" && <DocumentManager token={token} activePatientId={session.user_id} userRole={session.role} />}
        {currentTab === "care" && <CareRemindersModule token={token} sessionRole={session.role} activePatientId={session.user_id} />}
        {currentTab === "family" && <FamilyConsentModule token={token} />}
        {currentTab === "chat" && (
          <PatientDoctorChatModule
            token={token}
            sessionUserId={session.user_id}
            sessionUserName={session.full_name || "Patient"}
            chatMessages={chatMessages}
            setChatMessages={setChatMessages}
            appointments={myAppointmentsList}
            onStartVideoCall={handleStartVideoCall}
          />
        )}
        {currentTab === "hospitals" && (
          session.role === "hospital_admin" || session.role === "admin"
            ? <AdminHospitalModule token={token} />
            : <HospitalSlotsModule token={token} sessionRole={session.role} sessionCity={session.city || ""} onStartVideoCall={handleStartVideoCall} />
        )}
        {currentTab === "trust" && <ComplianceModule token={token} sessionRole={session.role} />}
        {currentTab === "public-health" && <PublicHealthModule token={token} />}
        {currentTab === "doctor" && (
          <DoctorWorkspace 
            token={token} 
            activeConversations={activeConversations} 
            chatMessages={chatMessages} 
            setChatMessages={setChatMessages} 
            sessionUserId={session.user_id}
            sessionUserName={session.full_name || "Doctor"}
            myAppointments={myAppointmentsList}
            onStartVideoCall={handleStartVideoCall}
            onAppointmentsChanged={refreshAppointments}
          />
        )}
        {currentTab === "profile" && <UserProfileModule token={token} session={session} onLogout={handleLogout} onProfileUpdate={handleProfileUpdate} />}
      </main>

      {/* Active Video Call WebRTC Overlays */}
      {activeVideoCall && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", zIndex: 999, padding: "24px" }}>
          <h3 style={{ color: "white", marginBottom: "20px" }}>Active Video Consultation Call</h3>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.85rem", marginBottom: "14px" }}>
            Video quality: {videoQualityLabel} | Status: {mediaStatus}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "20px", width: "min(100%, 1320px)", marginBottom: "20px" }}>
            <div style={{ aspectRatio: "16 / 9", background: "#111827", borderRadius: "12px", overflow: "hidden", position: "relative", border: "1px solid rgba(255,255,255,0.12)" }}>
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span style={{ position: "absolute", bottom: "10px", left: "10px", color: "white", fontSize: "0.8rem", background: "rgba(0,0,0,0.5)", padding: "2px 6px", borderRadius: "4px" }}>Local Feed (You)</span>
            </div>
            <div style={{ aspectRatio: "16 / 9", background: "#111827", borderRadius: "12px", overflow: "hidden", position: "relative", border: "1px solid rgba(255,255,255,0.12)" }}>
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span style={{ position: "absolute", bottom: "10px", left: "10px", color: "white", fontSize: "0.8rem", background: "rgba(0,0,0,0.5)", padding: "2px 6px", borderRadius: "4px" }}>Remote Feed</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setIsMuted(!isMuted)} className="button-sec">{isMuted ? "Unmute" : "Mute"}</button>
            <button onClick={() => setIsCameraOff(!isCameraOff)} className="button-sec">{isCameraOff ? "Turn Camera On" : "Turn Camera Off"}</button>
            <button onClick={() => setActiveVideoCall(null)} className="button" style={{ background: "#e74c3c" }}>End Call</button>
          </div>
        </div>
      )}
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
