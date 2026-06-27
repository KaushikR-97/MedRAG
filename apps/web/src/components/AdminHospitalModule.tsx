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

  useEffect(() => {
    refreshHospitals();
    refreshAmbulanceRequests();
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
        {[
          { icon: Pill, title: "Pharmacy Checks", copy: "Medication inventory, interaction flags, and prescription dispense queue." },
          { icon: Bed, title: "Bed Allocation", copy: "Ward capacity, admission requests, discharge queue, and bed status." },
          { icon: ClipboardList, title: "In-Person Consultations", copy: "Front-desk queue, check-in status, walk-ins, and appointment handling." },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div className="card" key={item.title}>
              <h4 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", marginBottom: "8px" }}>
                <Icon size={17} style={{ color: "var(--primary)" }} />
                {item.title}
              </h4>
              <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{item.copy}</p>
            </div>
          );
        })}
      </div>

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
