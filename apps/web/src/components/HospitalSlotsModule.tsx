import React, { useState, useEffect } from "react";
import { Building2, Stethoscope, CalendarCheck, Ambulance } from "lucide-react";
import { api, AppointmentRecord } from "../api/client";
import { RazorpayModal } from "./RazorpayModal";

type HospitalSlotsModuleProps = {
  token: string;
  sessionRole: string;
  sessionCity: string;
  onStartVideoCall: (appt: AppointmentRecord) => void;
};

export const HospitalSlotsModule: React.FC<HospitalSlotsModuleProps> = ({ token, sessionRole, sessionCity, onStartVideoCall }) => {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [showRazorpay, setShowRazorpay] = useState(false);

  // Search/Filters
  const [searchCity, setSearchCity] = useState(sessionCity || "Bengaluru");
  const [selectedSpecialty, setSelectedSpecialty] = useState("Cardiology");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedDoctorName, setSelectedDoctorName] = useState("");
  const [resourceBookings, setResourceBookings] = useState<any[]>([]);
  const [resourceHospitalId, setResourceHospitalId] = useState("");
  const [resourceType, setResourceType] = useState("general_bed");
  const [resourceReason, setResourceReason] = useState("Planned admission request");
  
  // Booking Form States
  const [activeSlotToBook, setActiveSlotToBook] = useState<any | null>(null);
  const [reason, setReason] = useState("Routine consultation");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicyNo, setInsurancePolicyNo] = useState("");
  
  // Ambulance Dispatch States
  const [symptoms, setSymptoms] = useState("Sudden chest pressure and dizziness");
  const [locationText, setLocationText] = useState("102, Residency Road, Richmond Town, Bengaluru");
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [ambulanceHospitalId, setAmbulanceHospitalId] = useState("");
  const [ambulanceResult, setAmbulanceResult] = useState<any | null>(null);
  const [ambulanceLoading, setAmbulanceLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refreshData = async () => {
    try {
      const city = searchCity || sessionCity;
      const hospRes = await api.listHospitals({ city });
      setHospitals(hospRes);
      if (!ambulanceHospitalId && hospRes.length) {
        setAmbulanceHospitalId(hospRes[0].id);
      }
      if (!resourceHospitalId && hospRes.length) {
        setResourceHospitalId(hospRes[0].id);
      }
      
      const docRes = await api.listDoctorsByCity(city, selectedSpecialty);
      setDoctors(docRes);

      if (selectedDoctorId) {
        const slotsRes = await api.listConsultationSlots({ doctor_id: selectedDoctorId, city });
        setSlots(slotsRes);
      } else {
        setSlots([]);
      }

      const apptsRes = await api.listMyAppointments(token);
      setAppointments(apptsRes);
      if (sessionRole === "patient") {
        setResourceBookings(await api.listHospitalResourceBookings(token));
      }
    } catch (err: any) {
      console.error("Failed to load hospital configurations", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, [token]);

  useEffect(() => {
    if (sessionCity && !searchCity) setSearchCity(sessionCity);
  }, [sessionCity]);

  const handleSearchCatalog = async () => {
    setSelectedDoctorId("");
    setSelectedDoctorName("");
    setSlots([]);
    try {
      const city = searchCity || sessionCity;
      const hospRes = await api.listHospitals({ city });
      setHospitals(hospRes);
      if (!ambulanceHospitalId && hospRes.length) setAmbulanceHospitalId(hospRes[0].id);
      if (!resourceHospitalId && hospRes.length) setResourceHospitalId(hospRes[0].id);
      setDoctors(await api.listDoctorsByCity(city, selectedSpecialty));
      setAppointments(await api.listMyAppointments(token));
      if (sessionRole === "patient") setResourceBookings(await api.listHospitalResourceBookings(token));
    } catch (err: any) {
      setError(err.message || "Could not search doctors");
    }
  };

  const handleSelectDoctor = async (doc: any) => {
    setSelectedDoctorId(doc.id);
    setSelectedDoctorName(doc.full_name);
    setError("");
    setSuccess("");
    try {
      const city = searchCity || sessionCity;
      const slotsRes = await api.listConsultationSlots({ doctor_id: doc.id, city });
      setSlots(slotsRes);
    } catch (err: any) {
      setError(err.message || "Could not load this doctor's slots");
    }
  };

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
      const res = await api.dispatchAmbulance(token, {
        symptoms,
        location_text: locationText,
        hospital_id: ambulanceHospitalId || undefined,
        latitude: locationCoords?.latitude,
        longitude: locationCoords?.longitude,
      });
      setAmbulanceResult(res);
      setSuccess("Ambulance request sent to selected hospital admin for dispatch approval.");
    } catch (err: any) {
      setError(err.message || "Ambulance booking failed");
    } finally {
      setAmbulanceLoading(false);
    }
  };

  const handleResourceBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await api.createHospitalResourceBooking(token, {
        hospital_id: resourceHospitalId,
        booking_type: resourceType === "icu" ? "icu" : resourceType === "ac_room" ? "ac_room" : resourceType === "room" ? "room" : "bed",
        resource_type: resourceType,
        reason: resourceReason,
      });
      setSuccess("Hospital resource request sent for admin approval.");
      refreshData();
    } catch (err: any) {
      setError(err.message || "Could not request hospital resource");
    }
  };

  const useCurrentLocation = () => {
    setError("");
    if (!navigator.geolocation) {
      setError("Location service is not available on this device/browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        };
        setLocationCoords(coords);
        setLocationText(`GPS: ${coords.latitude}, ${coords.longitude}`);
      },
      (err) => setError(err.message || "Could not access location service"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
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
        <button onClick={handleSearchCatalog} className="button-sec" style={{ alignSelf: "flex-end" }}>Search Doctors</button>

        <h4 style={{ fontSize: "0.9rem", marginBottom: "4px" }}>Available Specialists ({doctors.length})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
          {doctors.map((doc) => (
            <button
              key={doc.id}
              onClick={() => handleSelectDoctor(doc)}
              className={selectedDoctorId === doc.id ? "button" : "button-sec"}
              style={{ padding: "10px", justifyContent: "space-between", textAlign: "left", fontSize: "0.8rem" }}
            >
              <div>
              <div style={{ fontWeight: 600 }}>{doc.full_name}</div>
              <div style={{ color: "var(--muted)", marginTop: "2px" }}>
                {doc.speciality || selectedSpecialty} | INR {doc.consultation_fee} | {doc.city || searchCity}
              </div>
              </div>
            </button>
          ))}
        </div>

        <h4 style={{ fontSize: "0.9rem", marginBottom: "4px" }}>
          {selectedDoctorId ? `Open Slots for ${selectedDoctorName} (${slots.length})` : "Select a doctor to view slots"}
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto" }}>
          {!selectedDoctorId ? (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center" }}>Choose a doctor from the list above.</p>
          ) : slots.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center" }}>No open slots for this doctor.</p>
          ) : slots.map((s) => (
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
          <>
          <div style={{ background: "rgba(0,169,255,0.05)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(0,169,255,0.2)" }}>
            <h3 style={{ fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <Building2 size={18} style={{ color: "var(--primary)" }} />
              Book Bed / Room From Home
            </h3>
            <form onSubmit={handleResourceBooking} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <select value={resourceHospitalId} onChange={e => setResourceHospitalId(e.target.value)} className="input" required>
                <option value="">Select hospital</option>
                {hospitals.map((hospital) => (
                  <option key={hospital.id} value={hospital.id}>
                    {hospital.name} - Beds {hospital.beds_total || 0}, Rooms {hospital.rooms_total || 0}, ICU {hospital.icu_beds_total || 0}, AC {hospital.ac_rooms_total || 0}
                  </option>
                ))}
              </select>
              <select value={resourceType} onChange={e => setResourceType(e.target.value)} className="input">
                <option value="general_bed">General Bed</option>
                <option value="room">Room</option>
                <option value="icu">ICU Bed</option>
                <option value="ac_room">AC Room</option>
              </select>
              <input className="input" value={resourceReason} onChange={e => setResourceReason(e.target.value)} placeholder="Reason for admission or room request" />
              <button type="submit" className="button">Request Approval</button>
            </form>
            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "120px", overflowY: "auto" }}>
              {resourceBookings.slice(0, 4).map((booking) => (
                <div key={booking.id} style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                  {booking.hospital_name} | {booking.resource_type} | {booking.status.toUpperCase()}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "rgba(231,76,60,0.05)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(231,76,60,0.2)" }}>
            <h3 style={{ fontSize: "0.95rem", color: "#e74c3c", display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <Ambulance size={18} />
              Simulated Emergency Dispatch
              <span style={{ fontSize: "0.65rem", background: "rgba(231,76,60,0.2)", color: "#e74c3c", padding: "2px 6px", borderRadius: "6px" }}>DEMO ONLY</span>
            </h3>
            <form onSubmit={handleAmbulanceDispatch} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label className="label" style={{ color: "#e74c3c" }}>Hospital to Request</label>
                <select value={ambulanceHospitalId} onChange={e => setAmbulanceHospitalId(e.target.value)} className="input" style={{ borderColor: "rgba(231,76,60,0.3)" }} required>
                  <option value="">Select hospital</option>
                  {hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id}>{hospital.name} - {hospital.city} | Ambulances {hospital.ambulance_count || 0} ({hospital.ambulance_types || "standard"})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" style={{ color: "#e74c3c" }}>Symptoms</label>
                <input type="text" value={symptoms} onChange={e => setSymptoms(e.target.value)} className="input" style={{ borderColor: "rgba(231,76,60,0.3)" }} required />
              </div>
              <div>
                <label className="label" style={{ color: "#e74c3c" }}>Dispatch Address</label>
                <input type="text" value={locationText} onChange={e => setLocationText(e.target.value)} className="input" style={{ borderColor: "rgba(231,76,60,0.3)" }} required />
              </div>
              <button type="button" onClick={useCurrentLocation} className="button-sec" style={{ borderColor: "rgba(231,76,60,0.35)" }}>
                Use Current GPS Location
              </button>
              <button type="submit" className="button" disabled={ambulanceLoading} style={{ background: "#e74c3c", color: "white" }}>
                {ambulanceLoading ? "Submitting Request..." : "Request Ambulance"}
              </button>
            </form>

            {ambulanceResult && (
              <div style={{ marginTop: "12px", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px", fontSize: "0.75rem", color: "#e74c3c" }}>
                <strong>Request ID:</strong> {ambulanceResult.request_id} | <strong>Status:</strong> {ambulanceResult.status} | <strong>ETA:</strong> {ambulanceResult.eta}
              </div>
            )}
          </div>
          </>
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
