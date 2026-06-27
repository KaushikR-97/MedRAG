import React, { useEffect, useState } from "react";
import { Building2, Plus, Stethoscope } from "lucide-react";
import { api } from "../api/client";

type AdminHospitalModuleProps = {
  token: string;
};

export const AdminHospitalModule: React.FC<AdminHospitalModuleProps> = ({ token }) => {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [hospitalName, setHospitalName] = useState("MedRAG Partner Hospital");
  const [city, setCity] = useState("Bengaluru");
  const [hospitalId, setHospitalId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departmentName, setDepartmentName] = useState("General Medicine");
  const [speciality, setSpeciality] = useState("General Physician");
  const [doctorEmail, setDoctorEmail] = useState("doctor@example.com");
  const [doctorName, setDoctorName] = useState("Demo Doctor");
  const [doctorPhone, setDoctorPhone] = useState("+919999977777");
  const [registrationNumber, setRegistrationNumber] = useState("KMC-12345");
  const [fee, setFee] = useState("500");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refreshHospitals = async () => {
    try {
      const result = await api.listHospitals();
      setHospitals(result);
      if (!hospitalId && result.length) setHospitalId(result[0].id);
    } catch (err: any) {
      setError(err.message || "Could not load hospitals");
    }
  };

  useEffect(() => {
    refreshHospitals();
  }, []);

  const createHospital = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const hospital = await api.createHospital(token, { name: hospitalName, city, state: "Karnataka" });
      setHospitalId(hospital.id);
      setMessage("Hospital created.");
      await refreshHospitals();
    } catch (err: any) {
      setError(err.message || "Could not create hospital");
    }
  };

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
      setMessage("Doctor profile created and assigned to department.");
    } catch (err: any) {
      setError(err.message || "Could not create doctor");
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
      {error && <div className="toast toast-error" style={{ gridColumn: "span 3" }}>{error}</div>}
      {message && <div className="toast toast-success" style={{ gridColumn: "span 3" }}>{message}</div>}

      <form className="card" onSubmit={createHospital} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "1rem" }}>
          <Building2 size={18} style={{ color: "var(--primary)" }} />
          Hospital
        </h3>
        <label className="label">Hospital Name</label>
        <input className="input" value={hospitalName} onChange={(event) => setHospitalName(event.target.value)} />
        <label className="label">City</label>
        <input className="input" value={city} onChange={(event) => setCity(event.target.value)} />
        <button className="button" type="submit"><Plus size={16} />Create Hospital</button>
        <label className="label">Active Hospital</label>
        <select className="input" value={hospitalId} onChange={(event) => setHospitalId(event.target.value)}>
          <option value="">Select hospital</option>
          {hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}
        </select>
      </form>

      <form className="card" onSubmit={createDepartment} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "1rem" }}>
          <Stethoscope size={18} style={{ color: "var(--primary)" }} />
          Department
        </h3>
        <label className="label">Department Name</label>
        <input className="input" value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} />
        <label className="label">Speciality</label>
        <input className="input" value={speciality} onChange={(event) => setSpeciality(event.target.value)} />
        <button className="button" type="submit" disabled={!hospitalId}><Plus size={16} />Create Department</button>
        <label className="label">Department ID</label>
        <input className="input" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} placeholder="Created department ID" />
      </form>

      <form className="card" onSubmit={createDoctor} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "1rem" }}>
          <Stethoscope size={18} style={{ color: "var(--primary)" }} />
          Doctor Assignment
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
        <button className="button" type="submit" disabled={!hospitalId || !departmentId}><Plus size={16} />Create & Assign Doctor</button>
      </form>
    </div>
  );
};
