export type AuthResponse = {
  access_token: string;
  token_type: string;
  user_id: string;
  role: string;
};

export type SourceSnippet = {
  id: string;
  title: string;
  score: number;
  text: string;
};

export type ClinicalAnswer = {
  answer: string;
  conversation_id: string;
  safety_label: string;
  escalation: string | null;
  sources: SourceSnippet[];
  trace_id: string;
  query_route: string;
  query_route_reason: string;
  query_route_confidence: number;
  query_route_used_fallback: boolean;
  retrieval_source_types: string[];
  rewritten_queries: string[];
};

export type DocumentRecord = {
  id: string;
  original_filename: string;
  document_type: string;
  status: string;
  malware_status: string;
  sha256: string;
  ocr_engine: string;
  ocr_confidence: string;
  ocr_review_status: string;
  ocr_handwriting_detected: boolean;
  ocr_warning: string;
  image_modality: string;
  image_review_status: string;
  image_ai_observations: string;
  clinician_verified_findings: string;
  image_embedding_status: string;
  image_embedding_model: string;
  image_vector_id: string;
  verified_by_patient: boolean;
  ingested_to_rag: boolean;
};

export type IngestionJobRecord = {
  id: string;
  document_id: string;
  job_type: string;
  status: string;
  queue_job_id: string;
  error: string;
};

export type PatientIntakeResponse = AuthResponse & {
  documents: DocumentRecord[];
  ingestion_jobs: IngestionJobRecord[];
};

export type ClinicalHistoryItem = {
  trace_id: string;
  conversation_id: string;
  patient_id: string;
  question: string;
  answer: string;
  safety_label: string;
  model_provider: string;
  model_name: string;
  prompt_version: string;
  created_at: string;
};

export type CareAgentResponse = {
  action: string;
  safety_label: string;
  reasoning: string;
  result: Record<string, unknown>;
};

export type HospitalRecord = {
  id: string;
  name: string;
  city: string;
  state: string;
  phone: string;
  emergency_phone: string;
};

export type ConsultationSlotRecord = {
  id: string;
  hospital_id: string;
  department_id: string;
  doctor_id: string;
  date: string;
  start_time: string;
  end_time: string;
  consultation_mode: string;
  capacity: number;
  booked_count: number;
  status: string;
};

export type HospitalDepartmentRecord = {
  id: string;
  hospital_id: string;
  name: string;
  speciality: string;
  active: boolean;
};

export type HospitalDoctorRecord = {
  id: string;
  hospital_id: string;
  department_id: string;
  doctor_id: string;
  speciality: string;
  consultation_fee: number;
  active: boolean;
};

export type AppointmentRecord = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  hospital_id: string;
  department_id: string;
  slot_id: string;
  appointment_type: string;
  consultation_mode: string;
  date: string;
  time_slot: string;
  status: string;
  urgency: string;
  reason: string;
  booking_reference: string;
};

export const API_BASE = (import.meta.env.VITE_API_BASE ?? "http://localhost:8000").replace(/\/+$/, "");

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${response.status} ${response.statusText} from ${url}: ${detail || "Request failed"}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  register(payload: {
    email: string;
    password: string;
    full_name: string;
    role: string;
    phone?: string;
    registration_number?: string;
  }) {
    return request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(payload) });
  },
  registerPatientIntake(payload: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    blood_group?: string;
    date_of_birth?: string;
    gender?: string;
    allergies?: string;
    chronic_conditions?: string;
    current_medications?: string;
    abha_number?: string;
    documents: Array<{ file: File; document_type: string }>;
  }) {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (key !== "documents" && typeof value === "string") {
        form.append(key, value);
      }
    }
    for (const doc of payload.documents) {
      form.append("files", doc.file);
      form.append("document_types", doc.document_type);
    }
    return request<PatientIntakeResponse>("/auth/register/patient-intake", { method: "POST", body: form });
  },
  login(payload: { email: string; password: string }) {
    return request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) });
  },
  ask(token: string, question: string, conversation_id: string, patient_id?: string) {
    return request<ClinicalAnswer>(
      "/clinical/ask",
      {
        method: "POST",
        body: JSON.stringify({ question, conversation_id, patient_id: patient_id || null }),
      },
      token,
    );
  },
  history(token: string, patient_id?: string) {
    const query = patient_id ? `?patient_id=${encodeURIComponent(patient_id)}` : "";
    return request<ClinicalHistoryItem[]>(`/clinical/history${query}`, {}, token);
  },
  importHistory(
    token: string,
    payload: { patient_id?: string | null; source_label: string; messages: Array<{ role: string; content: string }> },
  ) {
    return request<{ trace_id: string; stored_messages: number }>(
      "/clinical/history/import",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    );
  },
  scheduleYearlyScan(token: string, payload: { preferred_date?: string; preferred_time_slot?: string }) {
    return request<CareAgentResponse>(
      "/care-agent/yearly-health-scan",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    );
  },
  symptomAction(
    token: string,
    payload: {
      patient_id?: string | null;
      symptoms: string;
      severity: number;
      duration?: string;
      location_text?: string;
      preferred_date?: string;
      preferred_time_slot?: string;
    },
  ) {
    return request<CareAgentResponse>(
      "/care-agent/symptom-action",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    );
  },
  uploadDocument(token: string, file: File, documentType: string) {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentRecord>(
      `/documents/upload?document_type=${encodeURIComponent(documentType)}`,
      { method: "POST", body: form },
      token,
    );
  },
  verifyImageFindings(token: string, docId: string, verifiedFindings: string) {
    return request<DocumentRecord>(
      `/documents/${encodeURIComponent(docId)}/verify-image-findings`,
      { method: "POST", body: JSON.stringify({ verified_findings: verifiedFindings }) },
      token,
    );
  },
  createConsent(
    token: string,
    payload: { patient_id: string; grantee_id: string; scope: string; purpose: string; expires_at?: string | null },
  ) {
    return request("/compliance/consents", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  listHospitals(params: { city?: string; speciality?: string } = {}) {
    const query = new URLSearchParams();
    if (params.city) query.set("city", params.city);
    if (params.speciality) query.set("speciality", params.speciality);
    return request<HospitalRecord[]>(`/hospitals?${query.toString()}`);
  },
  listConsultationSlots(params: {
    hospital_id?: string;
    doctor_id?: string;
    speciality?: string;
    date?: string;
  } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    return request<ConsultationSlotRecord[]>(`/hospitals/slots?${query.toString()}`);
  },
  bookConsultation(token: string, payload: { slot_id: string; reason?: string; urgency?: string; notes?: string }) {
    return request<AppointmentRecord>(
      "/hospitals/consultations/book",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    );
  },
  createHospital(
    token: string,
    payload: {
      name: string;
      registration_number?: string;
      address?: string;
      city?: string;
      state?: string;
      pincode?: string;
      phone?: string;
      email?: string;
      emergency_phone?: string;
    },
  ) {
    return request<HospitalRecord>("/hospitals", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  createDepartment(token: string, payload: { hospital_id: string; name: string; speciality?: string; description?: string }) {
    return request<HospitalDepartmentRecord>(
      "/hospitals/departments",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    );
  },
  assignDoctor(
    token: string,
    payload: {
      hospital_id: string;
      department_id: string;
      doctor_id: string;
      speciality?: string;
      consultation_fee?: number;
    },
  ) {
    return request<HospitalDoctorRecord>("/hospitals/doctors", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  createConsultationSlot(
    token: string,
    payload: {
      hospital_id: string;
      department_id: string;
      doctor_id: string;
      date: string;
      start_time: string;
      end_time: string;
      consultation_mode?: string;
      capacity?: number;
    },
  ) {
    return request<ConsultationSlotRecord>("/hospitals/slots", { method: "POST", body: JSON.stringify(payload) }, token);
  },
};
