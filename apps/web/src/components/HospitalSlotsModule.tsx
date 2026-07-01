import React, { useState, useEffect } from "react";
import { Building2, Stethoscope, CalendarCheck, Ambulance, MapPin, Video, IndianRupee } from "lucide-react";
import { api, AppointmentRecord, ConsultationSlotRecord } from "../api/client";
import { RazorpayModal } from "./RazorpayModal";

type HospitalSlotsModuleProps = {
  token: string;
  sessionRole: string;
  sessionCity: string;
  onStartVideoCall: (appt: AppointmentRecord) => void;
};

const doctorInitials = (name = "Doctor") => {
  const clean = name.replace(/^dr\.?\s+/i, "").trim();
  return clean
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "DR";
};

const DoctorAvatar = ({ src, name, size = 52 }: { src?: string; name?: string; size?: number }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", border: "1px solid var(--line)", display: "grid", placeItems: "center", flex: `0 0 ${size}px`, background: "rgba(14,165,233,0.12)", color: "var(--primary)", fontWeight: 800, fontSize: size > 50 ? "0.9rem" : "0.75rem" }}>
    {src ? (
      <img src={src} alt={name || "Doctor"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    ) : (
      <span>{doctorInitials(name)}</span>
    )}
  </div>
);

const DoctorMeta = ({ doctor, compact = false }: { doctor: any; compact?: boolean }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontWeight: 700, color: "white", fontSize: compact ? "0.85rem" : "0.95rem" }}>
      Dr. {doctor.full_name || doctor.doctor_name || "Specialist"}
    </div>
    <div style={{ color: "var(--muted)", marginTop: "4px", fontSize: compact ? "0.72rem" : "0.78rem", display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <span>{doctor.speciality || doctor.doctor_speciality || "General Physician"}</span>
      {doctor.age || doctor.doctor_age ? <span>Age {doctor.age || doctor.doctor_age}</span> : null}
      {doctor.gender || doctor.doctor_gender ? <span>{String(doctor.gender || doctor.doctor_gender).replace(/_/g, " ")}</span> : null}
      {doctor.registration_number || doctor.doctor_registration_number ? <span>Reg: {doctor.registration_number || doctor.doctor_registration_number}</span> : null}
    </div>
  </div>
);

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

  const selectedDoctor = doctors.find((doc) => doc.id === selectedDoctorId);

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
      setSuccess(
        activeSlotToBook.consultation_mode === "video"
          ? "Booking request sent. The video room opens only after doctor confirmation and during the booked slot."
          : "Offline consultation request sent. Use the booking token at the clinic/hospital; no video link will be created."
      );
      setActiveSlotToBook(null);
      setShowRazorpay(false);
      refreshData();
    } catch (err: any) {
      setError(err.message || "Failed to book appointment");
    }
  };

  const isVideoJoinLive = (appt: AppointmentRecord) => {
    if (appt.status !== "confirmed" || appt.consultation_mode !== "video") return false;
    if (appt.starts_at && appt.ends_at && appt.server_now) {
      const now = Date.parse(appt.server_now);
      return now >= Date.parse(appt.starts_at) && now <= Date.parse(appt.ends_at);
    }
    const [startText, endText] = appt.time_slot.split("-");
    const start = new Date(`${appt.date}T${(startText || "").trim()}:00`);
    const end = new Date(`${appt.date}T${(endText || "").trim()}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    const now = new Date();
    return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
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
    <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "24px", alignItems: "start" }}>
      {/* Finding doctors and slots */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <Stethoscope size={18} style={{ color: "var(--primary)" }} />
          Find Doctors
        </h3>
        
        {error && <div className="toast toast-error">{error}</div>}
        {success && <div className="toast toast-success">{success}</div>}

        <div style={{ padding: "14px", border: "1px solid var(--line)", borderRadius: "8px", background: "rgba(255,255,255,0.015)" }}>
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
        <button onClick={handleSearchCatalog} className="button-sec" style={{ marginTop: "12px", alignSelf: "flex-end" }}>Search Doctors</button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ fontSize: "0.9rem" }}>Available Specialists ({doctors.length})</h4>
          <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Photo, identity and fee shown before booking</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px", maxHeight: "310px", overflowY: "auto" }}>
          {doctors.map((doc) => (
            <button
              key={doc.id}
              onClick={() => handleSelectDoctor(doc)}
              className={selectedDoctorId === doc.id ? "button" : "button-sec"}
              style={{ padding: "12px", justifyContent: "flex-start", textAlign: "left", fontSize: "0.8rem", alignItems: "center", gap: "12px", minHeight: "92px" }}
            >
              <DoctorAvatar src={doc.profile_image_url} name={doc.full_name} />
              <div style={{ minWidth: 0 }}>
                <DoctorMeta doctor={doc} />
                <div style={{ color: "var(--muted)", marginTop: "6px", display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "0.75rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><IndianRupee size={12} />{doc.consultation_fee || 0}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><MapPin size={12} />{doc.city || searchCity}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <h4 style={{ fontSize: "0.9rem", marginBottom: "4px" }}>
          {selectedDoctorId ? `Open Slots for ${selectedDoctorName} (${slots.length})` : "Select a doctor to view slots"}
        </h4>
        {selectedDoctor && (
          <div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px", border: "1px solid rgba(14,165,233,0.18)", borderRadius: "8px", background: "rgba(14,165,233,0.045)" }}>
            <DoctorAvatar src={selectedDoctor.profile_image_url} name={selectedDoctor.full_name} size={48} />
            <DoctorMeta doctor={selectedDoctor} compact />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
          {!selectedDoctorId ? (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center" }}>Choose a doctor from the list above.</p>
          ) : slots.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center" }}>No open slots for this doctor.</p>
          ) : slots.map((s: ConsultationSlotRecord) => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "center", padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", minWidth: 0 }}>
                <DoctorAvatar src={s.doctor_profile_image_url || selectedDoctor?.profile_image_url} name={s.doctor_name || selectedDoctorName} size={42} />
                <div>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700 }}>Dr. {s.doctor_name || selectedDoctorName || "Specialist"}</span>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "3px" }}>
                    {s.date} | {s.start_time}-{s.end_time} | {s.timezone || "Asia/Kolkata"} | INR {s.consultation_fee || selectedDoctor?.consultation_fee || 0}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: s.consultation_mode === "video" ? "#a7f3d0" : "#fde68a", marginTop: "3px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    {s.consultation_mode === "video" ? <Video size={12} /> : <Building2 size={12} />}
                    {s.consultation_mode === "video" ? "Video consultation" : "Offline / in-person consultation"}
                  </div>
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
            My Consultations
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
            {appointments.map((appt: AppointmentRecord) => (
              <div key={appt.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "center", padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "0.8rem" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", minWidth: 0 }}>
                  <DoctorAvatar src={appt.doctor_profile_image_url} name={appt.doctor_name || "Doctor"} size={44} />
                  <div>
                    <DoctorMeta
                      doctor={{
                        doctor_name: appt.doctor_name || "Specialist",
                        doctor_age: appt.doctor_age,
                        doctor_gender: appt.doctor_gender,
                        doctor_speciality: appt.doctor_speciality,
                        doctor_registration_number: appt.doctor_registration_number,
                      }}
                      compact
                    />
                    <div style={{ color: "var(--muted)", marginTop: "4px" }}>
                      Ref: {appt.booking_reference} | {appt.date} | {appt.time_slot} | {appt.status.toUpperCase()}
                    </div>
                    <div style={{ color: appt.consultation_mode === "video" ? "#a7f3d0" : "#fde68a", marginTop: "3px", display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.72rem" }}>
                      {appt.consultation_mode === "video" ? <Video size={12} /> : <Building2 size={12} />}
                      {appt.consultation_mode === "video" ? "Video room opens only during slot" : "Offline visit: show token at clinic, no video link"}
                    </div>
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
                ) : (
                  <span style={{ color: "#fde68a", fontSize: "0.75rem" }}>
                    {appt.status === "requested" ? "Awaiting confirmation" : "In-person token"}
                  </span>
                )}
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
          <div style={{ background: "rgba(0,169,255,0.05)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(0,169,255,0.2)" }}>
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

          <div style={{ background: "rgba(231,76,60,0.05)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(231,76,60,0.2)" }}>
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
            <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "10px", border: "1px solid var(--line)", borderRadius: "8px", marginBottom: "12px", background: "rgba(255,255,255,0.02)" }}>
              <DoctorAvatar src={activeSlotToBook.doctor_profile_image_url || selectedDoctor?.profile_image_url} name={activeSlotToBook.doctor_name || selectedDoctorName} size={44} />
              <div>
                <DoctorMeta
                  doctor={{
                    doctor_name: activeSlotToBook.doctor_name || selectedDoctorName,
                    doctor_age: activeSlotToBook.doctor_age || selectedDoctor?.age,
                    doctor_gender: activeSlotToBook.doctor_gender || selectedDoctor?.gender,
                    doctor_speciality: activeSlotToBook.doctor_speciality || selectedDoctor?.speciality,
                    doctor_registration_number: activeSlotToBook.doctor_registration_number || selectedDoctor?.registration_number,
                  }}
                  compact
                />
                <div style={{ color: "var(--muted)", fontSize: "0.74rem", marginTop: "4px" }}>
                  {activeSlotToBook.date} | {activeSlotToBook.start_time}-{activeSlotToBook.end_time} | {activeSlotToBook.timezone || "Asia/Kolkata"}
                </div>
              </div>
            </div>
            <div style={{ color: activeSlotToBook.consultation_mode === "video" ? "#a7f3d0" : "#fde68a", fontSize: "0.8rem", marginBottom: "10px" }}>
              {activeSlotToBook.consultation_mode === "video"
                ? "Video consultation: link opens only after confirmation and during the slot."
                : "Offline consultation: no video link will be created; patient receives an in-person booking token."}
            </div>
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
