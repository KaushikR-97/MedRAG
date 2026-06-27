import React, { useState, useEffect } from "react";
import { Building2, Stethoscope, CalendarCheck, Ambulance } from "lucide-react";
import { api, AppointmentRecord } from "../api/client";
import { RazorpayModal } from "./RazorpayModal";

type HospitalSlotsModuleProps = {
  token: string;
  sessionRole: string;
  onStartVideoCall: (appt: AppointmentRecord) => void;
};

export const HospitalSlotsModule: React.FC<HospitalSlotsModuleProps> = ({ token, sessionRole, onStartVideoCall }) => {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [showRazorpay, setShowRazorpay] = useState(false);

  // Search/Filters
  const [searchCity, setSearchCity] = useState("Bengaluru");
  const [selectedSpecialty, setSelectedSpecialty] = useState("Cardiology");
  
  // Booking Form States
  const [activeSlotToBook, setActiveSlotToBook] = useState<any | null>(null);
  const [reason, setReason] = useState("Routine consultation");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicyNo, setInsurancePolicyNo] = useState("");
  
  // Ambulance Dispatch States
  const [symptoms, setSymptoms] = useState("Sudden chest pressure and dizziness");
  const [locationText, setLocationText] = useState("102, Residency Road, Richmond Town, Bengaluru");
  const [ambulanceResult, setAmbulanceResult] = useState<any | null>(null);
  const [ambulanceLoading, setAmbulanceLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refreshData = async () => {
    try {
      const hospRes = await api.listHospitals();
      setHospitals(hospRes);
      
      const docRes = await api.listDoctorsByCity(searchCity, selectedSpecialty);
      setDoctors(docRes);

      const slotsRes = await api.listConsultationSlots({ speciality: selectedSpecialty });
      setSlots(slotsRes);

      const apptsRes = await api.listMyAppointments(token);
      setAppointments(apptsRes);
    } catch (err: any) {
      console.error("Failed to load hospital configurations", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, [token]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSlotToBook) return;
    setError("");
    setSuccess("");
    if (paymentMethod === "cash") {
      setShowRazorpay(true);
      return;
    }
    await completeBooking();
  };

  const completeBooking = async () => {
    try {
      await api.bookConsultation(token, {
        slot_id: activeSlotToBook.id,
        reason,
        payment_method: paymentMethod,
        insurance_provider: insuranceProvider,
        insurance_policy_number: insurancePolicyNo
      });
      setSuccess("Booking request sent. The video room opens after the doctor confirms and the slot time begins.");
      setActiveSlotToBook(null);
      setShowRazorpay(false);
      refreshData();
    } catch (err: any) {
      setError(err.message || "Failed to book appointment");
    }
  };

  const isVideoJoinLive = (appt: AppointmentRecord) => {
    if (appt.status !== "confirmed" || appt.consultation_mode !== "video") return false;
    const [startText, endText] = appt.time_slot.split("-");
    const start = new Date(`${appt.date}T${(startText || "").trim()}:00`);
    const end = new Date(`${appt.date}T${(endText || "").trim()}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    const now = new Date();
    return now.getTime() >= start.getTime() - 10 * 60 * 1000 && now.getTime() <= end.getTime() + 15 * 60 * 1000;
  };

  const handleAmbulanceDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setAmbulanceLoading(true);
    setError("");
    setAmbulanceResult(null);
    try {
      const res = await api.dispatchAmbulance(token, { symptoms, location_text: locationText });
      setAmbulanceResult(res);
      setSuccess("Ambulance dispatched! Help is on the way.");
    } catch (err: any) {
      setError(err.message || "Ambulance booking failed");
    } finally {
      setAmbulanceLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
      {/* Finding doctors and slots */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <Stethoscope size={18} style={{ color: "var(--primary)" }} />
          Find Doctors & Book Slots
        </h3>
        
        {error && <div className="toast toast-error">{error}</div>}
        {success && <div className="toast toast-success">{success}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label className="label">Search City</label>
            <input type="text" value={searchCity} onChange={e => setSearchCity(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Specialty</label>
            <select value={selectedSpecialty} onChange={e => setSelectedSpecialty(e.target.value)} className="input">
              <option value="Cardiology">Cardiology</option>
              <option value="General Physician">General Physician</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Neurology">Neurology</option>
            </select>
          </div>
        </div>
        <button onClick={refreshData} className="button-sec" style={{ alignSelf: "flex-end" }}>Search Catalog</button>

        <h4 style={{ fontSize: "0.9rem", marginBottom: "4px" }}>Available Specialists ({doctors.length})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
          {doctors.map((doc) => (
            <div key={doc.id} style={{ padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "0.8rem" }}>
              <div style={{ fontWeight: 600 }}>{doc.full_name}</div>
              <div style={{ color: "var(--muted)", marginTop: "2px" }}>
                Speciality: {doc.speciality} | Fee: INR {doc.consultation_fee} | Contact: {doc.phone}
              </div>
            </div>
          ))}
        </div>

        <h4 style={{ fontSize: "0.9rem", marginBottom: "4px" }}>Open Booking Slots ({slots.length})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto" }}>
          {slots.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <div>
                <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Dr. {s.doctor_name || "Specialist"}</span>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                  Date: {s.date} | Time: {s.start_time} - {s.end_time} | Fee: INR {s.consultation_fee}
                </div>
              </div>
              {sessionRole === "patient" && (
                <button onClick={() => setActiveSlotToBook(s)} className="button" style={{ padding: "4px 8px", fontSize: "0.75rem" }}>
                  Book
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bookings list & Emergency dispatches */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <h3 style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <CalendarCheck size={18} style={{ color: "var(--primary)" }} />
            My Encounters & Consultation Rooms
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
            {appointments.map((appt) => (
              <div key={appt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "0.8rem" }}>
                <div>
                  <span style={{ fontWeight: 600 }}>Ref: {appt.booking_reference}</span>
                  <div style={{ color: "var(--muted)", marginTop: "2px" }}>
                    Date: {appt.date} | Slot: {appt.time_slot} | Mode: {appt.consultation_mode.toUpperCase()} | Status: {appt.status.toUpperCase()}
                  </div>
                </div>
                {isVideoJoinLive(appt) ? (
                  <button onClick={() => onStartVideoCall(appt)} className="button" style={{ background: "#2ecc71", padding: "4px 8px", fontSize: "0.75rem" }}>
                    Join Video
                  </button>
                ) : appt.consultation_mode === "video" ? (
                  <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                    {appt.status === "requested" ? "Awaiting doctor confirmation" : "Opens at slot time"}
                  </span>
                ) : null}
              </div>
            ))}
            {appointments.length === 0 && (
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center" }}>No upcoming appointments booked.</p>
            )}
          </div>
        </div>

        {/* Emergency ambulance card */}
        {sessionRole === "patient" && (
          <div style={{ background: "rgba(231,76,60,0.05)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(231,76,60,0.2)" }}>
            <h3 style={{ fontSize: "0.95rem", color: "#e74c3c", display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <Ambulance size={18} />
              Simulated Emergency Dispatch
              <span style={{ fontSize: "0.65rem", background: "rgba(231,76,60,0.2)", color: "#e74c3c", padding: "2px 6px", borderRadius: "6px" }}>DEMO ONLY</span>
            </h3>
            <form onSubmit={handleAmbulanceDispatch} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label className="label" style={{ color: "#e74c3c" }}>Symptoms</label>
                <input type="text" value={symptoms} onChange={e => setSymptoms(e.target.value)} className="input" style={{ borderColor: "rgba(231,76,60,0.3)" }} required />
              </div>
              <div>
                <label className="label" style={{ color: "#e74c3c" }}>Dispatch Address</label>
                <input type="text" value={locationText} onChange={e => setLocationText(e.target.value)} className="input" style={{ borderColor: "rgba(231,76,60,0.3)" }} required />
              </div>
              <button type="submit" className="button" disabled={ambulanceLoading} style={{ background: "#e74c3c", color: "white" }}>
                {ambulanceLoading ? "Contacting First Responders..." : "🚨 Dispatch Ambulance"}
              </button>
            </form>

            {ambulanceResult && (
              <div style={{ marginTop: "12px", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px", fontSize: "0.75rem", color: "#e74c3c" }}>
                <strong>Booking Ref:</strong> {ambulanceResult.booking_reference} | <strong>Status:</strong> Dispatched | <strong>ETA:</strong> {ambulanceResult.eta}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Booking Form Overlay */}
      {activeSlotToBook && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100 }}>
          <div className="card" style={{ width: "400px", padding: "24px" }}>
            <h4 style={{ fontSize: "1rem", marginBottom: "16px" }}>Book Consultation Slot</h4>
            <form onSubmit={handleBookAppointment} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label className="label">Reason for Visit</label>
                <input type="text" value={reason} onChange={e => setReason(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Payment Option</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input">
                  <option value="cash">Cash/Direct Pay</option>
                  <option value="insurance">Insurance Claim</option>
                </select>
              </div>
              {paymentMethod === "insurance" && (
                <>
                  <div>
                    <label className="label">Insurance Provider</label>
                    <input type="text" value={insuranceProvider} onChange={e => setInsuranceProvider(e.target.value)} className="input" placeholder="ICICI Lombard" required />
                  </div>
                  <div>
                    <label className="label">Policy Number</label>
                    <input type="text" value={insurancePolicyNo} onChange={e => setInsurancePolicyNo(e.target.value)} className="input" placeholder="POL-999-XYZ" required />
                  </div>
                </>
              )}
              <div style={{ display: "flex", gap: "10px", marginTop: "12px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setActiveSlotToBook(null)} className="button-sec">Cancel</button>
                <button type="submit" className="button">Confirm Booking</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRazorpay && activeSlotToBook && (
        <RazorpayModal
          amount={activeSlotToBook.consultation_fee}
          doctorName={activeSlotToBook.doctor_name || "Specialist"}
          onSuccess={async (paymentId) => {
            setSuccess(`Payment authorized: ${paymentId}. Completing booking...`);
            await completeBooking();
          }}
          onClose={() => setShowRazorpay(false)}
        />
      )}
    </div>
  );
};
