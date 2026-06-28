import React, { useEffect, useState } from "react";
import { Bed, Building2, ClipboardList, Pill, Plus, Stethoscope } from "lucide-react";
import { api } from "../api/client";

type AdminHospitalModuleProps = {
  token: string;
};

export const AdminHospitalModule: React.FC<AdminHospitalModuleProps> = ({ token }) => {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [hospitalId, setHospitalId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departmentName, setDepartmentName] = useState("General Medicine");
  const [speciality, setSpeciality] = useState("General Physician");
  const [doctorEmail, setDoctorEmail] = useState("doctor@example.com");
  const [doctorName, setDoctorName] = useState("Demo Doctor");
  const [doctorPhone, setDoctorPhone] = useState("+919999977777");
  const [registrationNumber, setRegistrationNumber] = useState("KMC-12345");
  const [fee, setFee] = useState("500");
  const [ambulanceRequests, setAmbulanceRequests] = useState<any[]>([]);
  const [resourceBookings, setResourceBookings] = useState<any[]>([]);
  const [ambulanceCount, setAmbulanceCount] = useState("2");
  const [ambulanceTypes, setAmbulanceTypes] = useState("BLS, ALS");
  const [bedsTotal, setBedsTotal] = useState("50");
  const [roomsTotal, setRoomsTotal] = useState("20");
  const [icuBedsTotal, setIcuBedsTotal] = useState("8");
  const [acRoomsTotal, setAcRoomsTotal] = useState("10");
  const [uploadPatientId, setUploadPatientId] = useState("");
  const [uploadType, setUploadType] = useState("discharge_summary");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pharmacyQueue, setPharmacyQueue] = useState<any[]>([]);
  const [medicineName, setMedicineName] = useState("Paracetamol 500 mg");
  const [stockCount, setStockCount] = useState("120");
  const [bedWard, setBedWard] = useState("General Ward");
  const [bedTotal, setBedTotal] = useState("20");
  const [bedOccupied, setBedOccupied] = useState("8");
  const [bedRows, setBedRows] = useState<any[]>([]);
  const [walkInName, setWalkInName] = useState("Walk-in Patient");
  const [walkInReason, setWalkInReason] = useState("Fever consultation");
  const [frontDeskQueue, setFrontDeskQueue] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refreshHospitals = async () => {
    try {
      const result = await api.listHospitals();
      setHospitals(result);
      if (!hospitalId && result.length) setHospitalId(result[0].id);
    } catch (err: any) {
      setError(err.message || "Could not load assigned hospitals");
    }
  };

  const refreshAmbulanceRequests = async () => {
    try {
      const requests = await api.listAmbulanceRequests(token, "requested");
      setAmbulanceRequests(requests);
    } catch (err: any) {
      setError(err.message || "Could not load ambulance requests");
    }
  };

  const refreshResourceBookings = async () => {
    try {
      setResourceBookings(await api.listHospitalResourceBookings(token));
    } catch (err: any) {
      setError(err.message || "Could not load bed and room requests");
    }
  };

  useEffect(() => {
    refreshHospitals();
    refreshAmbulanceRequests();
    refreshResourceBookings();
    const timer = window.setInterval(refreshAmbulanceRequests, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const createDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const department = await api.createDepartment(token, { hospital_id: hospitalId, name: departmentName, speciality });
      setDepartmentId(department.id);
      setMessage("Department created.");
    } catch (err: any) {
      setError(err.message || "Could not create department");
    }
  };

  const createDoctor = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.createDoctor(token, {
        email: doctorEmail,
        password: "StrongPass123",
        full_name: doctorName,
        phone: doctorPhone,
        registration_number: registrationNumber,
        speciality,
        hospital_id: hospitalId,
        department_id: departmentId,
        consultation_fee: Number(fee),
      });
      setMessage("Doctor created with default password StrongPass123 and assigned to department.");
    } catch (err: any) {
      setError(err.message || "Could not create doctor");
    }
  };

  const dispatchAmbulance = async (requestId: string) => {
    setError("");
    setMessage("");
    try {
      const result = await api.dispatchAmbulanceRequest(token, requestId);
      setMessage(`Ambulance dispatched. Provider reference: ${result.provider_reference}, ETA: ${result.eta}`);
      await refreshAmbulanceRequests();
    } catch (err: any) {
      setError(err.message || "Could not dispatch ambulance");
    }
  };

  const updateResources = async () => {
    if (!hospitalId) return;
    setError("");
    setMessage("");
    try {
      await api.updateHospitalResources(token, hospitalId, {
        ambulance_count: Number(ambulanceCount) || 0,
        ambulance_types: ambulanceTypes,
        beds_total: Number(bedsTotal) || 0,
        rooms_total: Number(roomsTotal) || 0,
        icu_beds_total: Number(icuBedsTotal) || 0,
        ac_rooms_total: Number(acRoomsTotal) || 0,
      });
      setMessage("Hospital resources published for patient booking.");
      await refreshHospitals();
    } catch (err: any) {
      setError(err.message || "Could not update hospital resources");
    }
  };

  const updateBookingStatus = async (bookingId: string, status: string) => {
    setError("");
    setMessage("");
    try {
      await api.updateHospitalResourceBooking(token, bookingId, { status });
      setMessage(`Booking marked ${status}.`);
      await refreshResourceBookings();
    } catch (err: any) {
      setError(err.message || "Could not update booking");
    }
  };

  const uploadPatientDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!uploadFile || !uploadPatientId) return;
    setError("");
    setMessage("");
    try {
      await api.uploadDocument(token, uploadFile, uploadType, uploadPatientId);
      setMessage("Patient record uploaded. Uploads close 3 days after discharge.");
      setUploadFile(null);
    } catch (err: any) {
      setError(err.message || "Could not upload patient record");
    }
  };

  const addPharmacyCheck = () => {
    setPharmacyQueue((prev) => [
      { id: crypto.randomUUID(), medicine: medicineName, stock: Number(stockCount) || 0, status: "Ready for dispense review" },
      ...prev,
    ]);
    setMessage("Pharmacy check queued.");
  };

  const addBedAllocation = () => {
    const total = Number(bedTotal) || 0;
    const occupied = Number(bedOccupied) || 0;
    setBedRows((prev) => [
      { id: crypto.randomUUID(), ward: bedWard, total, occupied, available: Math.max(0, total - occupied) },
      ...prev,
    ]);
    setMessage("Bed allocation status updated.");
  };

  const addWalkInConsult = () => {
    setFrontDeskQueue((prev) => [
      { id: crypto.randomUUID(), name: walkInName, reason: walkInReason, status: "Waiting" },
      ...prev,
    ]);
    setMessage("In-person consultation added to front-desk queue.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {error && <div className="toast toast-error">{error}</div>}
      {message && <div className="toast toast-success">{message}</div>}

      <div className="card">
        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "1rem", marginBottom: "12px" }}>
          <Building2 size={18} style={{ color: "var(--primary)" }} />
          Hospital Workspace
        </h3>
        <label className="label">Managed Hospital</label>
        <select className="input" value={hospitalId} onChange={(event) => setHospitalId(event.target.value)}>
          <option value="">Select assigned hospital</option>
          {hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginTop: "14px" }}>
          <input className="input" type="number" value={ambulanceCount} onChange={(event) => setAmbulanceCount(event.target.value)} placeholder="Ambulances" />
          <input className="input" value={ambulanceTypes} onChange={(event) => setAmbulanceTypes(event.target.value)} placeholder="Ambulance types" />
          <input className="input" type="number" value={bedsTotal} onChange={(event) => setBedsTotal(event.target.value)} placeholder="Beds" />
          <input className="input" type="number" value={roomsTotal} onChange={(event) => setRoomsTotal(event.target.value)} placeholder="Rooms" />
          <input className="input" type="number" value={icuBedsTotal} onChange={(event) => setIcuBedsTotal(event.target.value)} placeholder="ICU beds" />
          <input className="input" type="number" value={acRoomsTotal} onChange={(event) => setAcRoomsTotal(event.target.value)} placeholder="AC rooms" />
        </div>
        <button className="button" type="button" onClick={updateResources} disabled={!hospitalId} style={{ marginTop: "12px" }}>Publish Hospital Resources</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <form className="card" onSubmit={createDepartment} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "1rem" }}>
            <Stethoscope size={18} style={{ color: "var(--primary)" }} />
            Departments
          </h3>
          <label className="label">Department Name</label>
          <input className="input" value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} />
          <label className="label">Speciality</label>
          <input className="input" value={speciality} onChange={(event) => setSpeciality(event.target.value)} />
          <button className="button" type="submit" disabled={!hospitalId}><Plus size={16} />Add Department</button>
          <label className="label">Department ID</label>
          <input className="input" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} placeholder="Created/selected department ID" />
        </form>

        <form className="card" onSubmit={createDoctor} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "1rem" }}>
            <Stethoscope size={18} style={{ color: "var(--primary)" }} />
            Doctors
          </h3>
          <label className="label">Doctor Name</label>
          <input className="input" value={doctorName} onChange={(event) => setDoctorName(event.target.value)} />
          <label className="label">Email</label>
          <input className="input" value={doctorEmail} onChange={(event) => setDoctorEmail(event.target.value)} />
          <label className="label">Phone</label>
          <input className="input" value={doctorPhone} onChange={(event) => setDoctorPhone(event.target.value)} />
          <label className="label">Registration Number</label>
          <input className="input" value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} />
          <label className="label">Consultation Fee</label>
          <input className="input" value={fee} onChange={(event) => setFee(event.target.value)} />
          <button className="button" type="submit" disabled={!hospitalId || !departmentId}><Plus size={16} />Add Doctor</button>
        </form>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem" }}>
            <Pill size={17} style={{ color: "var(--primary)" }} />
            Pharmacy Checks
          </h4>
          <input className="input" value={medicineName} onChange={(event) => setMedicineName(event.target.value)} />
          <input className="input" type="number" value={stockCount} onChange={(event) => setStockCount(event.target.value)} />
          <button className="button" type="button" onClick={addPharmacyCheck}>Queue Check</button>
          {pharmacyQueue.slice(0, 3).map((item) => (
            <div key={item.id} style={{ fontSize: "0.78rem", color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: "8px" }}>
              {item.medicine} | Stock {item.stock} | {item.status}
            </div>
          ))}
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem" }}>
            <Bed size={17} style={{ color: "var(--primary)" }} />
            Bed Allocation
          </h4>
          <input className="input" value={bedWard} onChange={(event) => setBedWard(event.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <input className="input" type="number" value={bedTotal} onChange={(event) => setBedTotal(event.target.value)} />
            <input className="input" type="number" value={bedOccupied} onChange={(event) => setBedOccupied(event.target.value)} />
          </div>
          <button className="button" type="button" onClick={addBedAllocation}>Update Beds</button>
          {bedRows.slice(0, 3).map((item) => (
            <div key={item.id} style={{ fontSize: "0.78rem", color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: "8px" }}>
              {item.ward} | {item.available}/{item.total} available
            </div>
          ))}
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem" }}>
            <ClipboardList size={17} style={{ color: "var(--primary)" }} />
            In-Person Consultations
          </h4>
          <input className="input" value={walkInName} onChange={(event) => setWalkInName(event.target.value)} />
          <input className="input" value={walkInReason} onChange={(event) => setWalkInReason(event.target.value)} />
          <button className="button" type="button" onClick={addWalkInConsult}>Add Walk-In</button>
          {frontDeskQueue.slice(0, 3).map((item) => (
            <div key={item.id} style={{ fontSize: "0.78rem", color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: "8px" }}>
              {item.name} | {item.reason} | {item.status}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "1rem", marginBottom: "12px" }}>
          <Bed size={18} style={{ color: "var(--primary)" }} />
          Bed / Room Requests
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
          {resourceBookings.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No bed or room requests.</p>
          ) : (
            resourceBookings.map((booking) => (
              <div key={booking.id} style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "12px", background: "rgba(255,255,255,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <strong>{booking.patient_name}</strong>
                    <div style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: "4px" }}>
                      {booking.resource_type} | {booking.reason} | {booking.status.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {booking.status === "requested" && <button className="button" onClick={() => updateBookingStatus(booking.id, "approved")}>Approve</button>}
                    {booking.status === "approved" && <button className="button-sec" onClick={() => updateBookingStatus(booking.id, "admitted")}>Admit</button>}
                    {booking.status === "admitted" && <button className="button-sec" onClick={() => updateBookingStatus(booking.id, "discharged")}>Discharge</button>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <form className="card" onSubmit={uploadPatientDocument} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "1rem" }}>
          <ClipboardList size={18} style={{ color: "var(--primary)" }} />
          Upload Patient Records
        </h3>
        <input className="input" value={uploadPatientId} onChange={(event) => setUploadPatientId(event.target.value)} placeholder="Patient ID" />
        <select className="input" value={uploadType} onChange={(event) => setUploadType(event.target.value)}>
          <option value="discharge_summary">Discharge Summary</option>
          <option value="lab_report">Medical Report</option>
          <option value="imaging">Imaging</option>
          <option value="prescription">Prescription</option>
        </select>
        <input className="input" type="file" accept=".pdf,image/*" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} />
        <button className="button" type="submit" disabled={!uploadPatientId || !uploadFile}>Upload Into Patient Vault</button>
      </form>

      <div className="card">
        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "1rem", marginBottom: "12px" }}>
          <ClipboardList size={18} style={{ color: "var(--primary)" }} />
          Ambulance Requests
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "340px", overflowY: "auto" }}>
          {ambulanceRequests.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No pending ambulance requests.</p>
          ) : (
            ambulanceRequests.map((request) => (
              <div key={request.id} style={{ border: "1px solid rgba(231,76,60,0.22)", background: "rgba(231,76,60,0.06)", borderRadius: "8px", padding: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <strong>{request.patient_name}</strong>
                    <div style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: "4px" }}>
                      {request.hospital_name} | {request.created_at}
                    </div>
                  </div>
                  <button className="button" style={{ background: "#e74c3c" }} onClick={() => dispatchAmbulance(request.id)}>
                    Approve & Dispatch
                  </button>
                </div>
                <div style={{ marginTop: "8px", fontSize: "0.82rem" }}>
                  <div><strong>Symptoms:</strong> {request.symptoms}</div>
                  <div><strong>Location:</strong> {request.location_text}</div>
                  {request.latitude && request.longitude && (
                    <div>
                      <strong>GPS:</strong>{" "}
                      <a href={`https://www.google.com/maps?q=${request.latitude},${request.longitude}`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>
                        {request.latitude}, {request.longitude}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
