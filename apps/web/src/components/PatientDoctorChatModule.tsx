import React, { useEffect, useMemo, useState } from "react";
import { MessageSquare, Send, Video } from "lucide-react";
import { api, AppointmentRecord, ConsultationMessageRecord } from "../api/client";
import { encryptMessage, decryptMessage } from "../utils/crypto";

type PatientDoctorChatModuleProps = {
  token: string;
  sessionUserId: string;
  sessionUserName: string;
  appointments: AppointmentRecord[];
  chatMessages: any[];
  setChatMessages: React.Dispatch<React.SetStateAction<any[]>>;
  onStartVideoCall: (appt: AppointmentRecord) => void;
};

export const PatientDoctorChatModule: React.FC<PatientDoctorChatModuleProps> = ({
  token,
  sessionUserId,
  sessionUserName,
  appointments,
  chatMessages,
  setChatMessages,
  onStartVideoCall,
}) => {
  const doctorConversations = useMemo(() => {
    const map = new Map<string, { id: string; name: string; appointment?: AppointmentRecord }>();
    for (const appointment of appointments) {
      if (appointment.status !== "confirmed") continue;
      if (!appointment.doctor_id) continue;
      map.set(appointment.doctor_id, {
        id: appointment.doctor_id,
        name: `Doctor ${appointment.doctor_id.slice(0, 6)}`,
        appointment,
      });
    }
    for (const message of chatMessages) {
      const otherId = message.senderId === sessionUserId ? message.recipientId : message.senderId;
      const otherName = message.senderId === sessionUserId ? message.recipientName : message.senderName;
      if (!map.has(otherId)) {
        map.set(otherId, { id: otherId, name: otherName || `Doctor ${otherId.slice(0, 6)}` });
      }
    }
    return Array.from(map.values());
  }, [appointments, chatMessages, sessionUserId]);

  const [activeDoctor, setActiveDoctor] = useState<{ id: string; name: string; appointment?: AppointmentRecord } | null>(null);
  const [messageText, setMessageText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [decryptedText, setDecryptedText] = useState<Record<string, string>>({});
  const [serverMessages, setServerMessages] = useState<ConsultationMessageRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeDoctor && doctorConversations.length > 0) {
      setActiveDoctor(doctorConversations[0]);
    }
  }, [doctorConversations, activeDoctor]);

  useEffect(() => {
    let cancelled = false;
    async function decryptVisibleMessages() {
      if (!activeDoctor) {
        setDecryptedText({});
        return;
      }
      const next: Record<string, string> = {};
      const visible = chatMessages.filter(
        (message) =>
          (message.senderId === sessionUserId && message.recipientId === activeDoctor.id) ||
          (message.senderId === activeDoctor.id && message.recipientId === sessionUserId),
      );
      for (const message of visible) {
        const derivedSecret = passphrase.trim() || [sessionUserId, activeDoctor.id].sort().join("-");
        next[message.id] = await decryptMessage(message.encodedText, derivedSecret);
      }
      if (!cancelled) setDecryptedText(next);
    }
    decryptVisibleMessages();
    return () => {
      cancelled = true;
    };
  }, [activeDoctor?.id, chatMessages, passphrase, sessionUserId]);

  useEffect(() => {
    if (!activeDoctor?.appointment || !isVideoJoinLive(activeDoctor.appointment)) {
      setServerMessages([]);
      return;
    }
    let cancelled = false;
    async function loadThread() {
      try {
        setError("");
        await api.joinConsultationRoom(token, activeDoctor!.appointment!.id);
        const messages = await api.listConsultationMessages(token, activeDoctor!.appointment!.id);
        if (!cancelled) setServerMessages(messages);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Could not load consultation messages");
      }
    }
    loadThread();
    const timer = window.setInterval(loadThread, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeDoctor?.appointment?.id, token]);

  const visibleMessages = activeDoctor
    ? chatMessages.filter(
        (message) =>
          (message.senderId === sessionUserId && message.recipientId === activeDoctor.id) ||
          (message.senderId === activeDoctor.id && message.recipientId === sessionUserId),
      )
    : [];

  const handleSend = async () => {
    if (!activeDoctor || !messageText.trim()) return;
    if (activeDoctor.appointment) {
      if (!isVideoJoinLive(activeDoctor.appointment)) {
        setError("Secure consultation chat opens during the confirmed appointment window.");
        return;
      }
      try {
        setError("");
        const sent = await api.sendConsultationMessage(token, activeDoctor.appointment.id, { body: messageText.trim() });
        setServerMessages((prev) => [...prev, sent]);
        setMessageText("");
        return;
      } catch (err: any) {
        setError(err.message || "Could not send consultation message");
      }
    }
    const derivedSecret = passphrase.trim() || [sessionUserId, activeDoctor.id].sort().join("-");
    const encodedText = await encryptMessage(messageText.trim(), derivedSecret);
    setChatMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        senderId: sessionUserId,
        senderName: sessionUserName,
        recipientId: activeDoctor.id,
        recipientName: activeDoctor.name,
        encodedText,
        timestamp: Date.now(),
      },
    ]);
    setMessageText("");
  };

  const isVideoJoinLive = (appointment?: AppointmentRecord) => {
    if (!appointment || appointment.status !== "confirmed" || appointment.consultation_mode !== "video") return false;
    const [startText, endText] = appointment.time_slot.split("-");
    const start = new Date(`${appointment.date}T${(startText || "").trim()}:00`);
    const end = new Date(`${appointment.date}T${(endText || "").trim()}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    const now = new Date();
    return now.getTime() >= start.getTime() - 10 * 60 * 1000 && now.getTime() <= end.getTime() + 15 * 60 * 1000;
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px" }}>
      <div className="card">
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <MessageSquare size={18} style={{ color: "var(--primary)" }} />
          Chat With Doctors
        </h3>
        <p style={{ color: "var(--muted)", fontSize: "0.84rem", marginBottom: "16px" }}>
          Conversations appear after the doctor confirms your consultation. Messages open during the confirmed slot window.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {doctorConversations.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No doctor conversations yet. Book a telehealth slot first.</p>
          ) : (
            doctorConversations.map((doctor) => (
              <button
                key={doctor.id}
                className={activeDoctor?.id === doctor.id ? "button" : "button-sec"}
                style={{ justifyContent: "flex-start" }}
                onClick={() => setActiveDoctor(doctor)}
              >
                {doctor.name}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: "520px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
          <div>
            <h3 style={{ fontSize: "1.05rem" }}>{activeDoctor ? activeDoctor.name : "Select a doctor"}</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: "3px" }}>
              {activeDoctor?.appointment ? `Appointment ${activeDoctor.appointment.booking_reference}` : "Secure local consult thread"}
            </p>
          </div>
          {activeDoctor?.appointment && isVideoJoinLive(activeDoctor.appointment) && (
            <button className="button" onClick={() => activeDoctor.appointment && onStartVideoCall(activeDoctor.appointment)}>
              <Video size={16} />
              Join Video
            </button>
          )}
        </div>
        {error && <div className="toast toast-error" style={{ marginBottom: "12px" }}>{error}</div>}

        <div style={{ flex: 1, border: "1px solid var(--line)", borderRadius: "10px", padding: "14px", background: "rgba(0,0,0,0.28)", overflowY: "auto" }}>
          {!activeDoctor ? (
            <p style={{ color: "var(--muted)", textAlign: "center", marginTop: "120px" }}>Select a doctor thread.</p>
          ) : serverMessages.length === 0 && visibleMessages.length === 0 ? (
            <p style={{ color: "var(--muted)", textAlign: "center", marginTop: "120px" }}>No messages yet.</p>
          ) : (
            <>
              {serverMessages.map((message) => {
                const isMine = message.sender_id === sessionUserId;
                return (
                  <div key={message.id} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: "8px" }}>
                    <div style={{ maxWidth: "75%", borderRadius: "10px", padding: "8px 12px", background: isMine ? "var(--primary)" : "rgba(255,255,255,0.08)" }}>
                      {message.body}
                    </div>
                  </div>
                );
              })}
              {visibleMessages.map((message) => {
                const isMine = message.senderId === sessionUserId;
                return (
                  <div key={message.id} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: "8px" }}>
                    <div style={{ maxWidth: "75%", borderRadius: "10px", padding: "8px 12px", background: isMine ? "var(--primary)" : "rgba(255,255,255,0.08)" }}>
                      {decryptedText[message.id] || "Decrypting..."}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", marginTop: "12px" }}>
          <input
            className="input"
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Optional shared passphrase"
            disabled={!activeDoctor}
          />
          <span />
          <input
            className="input"
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSend();
            }}
            placeholder="Type a secure message..."
            disabled={!activeDoctor}
          />
          <button className="button" onClick={handleSend} disabled={!activeDoctor || !messageText.trim()}>
            <Send size={16} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
