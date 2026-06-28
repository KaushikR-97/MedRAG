export type AuthResponse = {
  access_token: string;
  token_type: string;
  user_id: string;
  role: string;
  full_name?: string;
  age?: number;
  city?: string;
  gender?: string;
};

export type LoginResponse = {
  mfa_required: boolean;
  mfa_token: string;
  simulated_otp?: string | null;
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
  ocr_text: string;
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
  ambulance_count: number;
  ambulance_types: string;
  beds_total: number;
  rooms_total: number;
  icu_beds_total: number;
  ac_rooms_total: number;
};

export type ConsultationSlotRecord = {
  id: string;
  hospital_id: string;
  department_id: string;
  doctor_id: string;
  date: string;
  start_time: string;
  end_time: string;
  timezone?: string;
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
  patient_name?: string;
  doctor_id: string | null;
  doctor_name?: string;
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
  confirmed_at?: string | null;
  timezone?: string;
  starts_at?: string;
  ends_at?: string;
  server_now?: string;
};

export type ConsultationRoomRecord = {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  status: string;
  expires_at: string;
  room_token: string;
};

export type ConsultationMessageRecord = {
  id: string;
  room_id: string;
  appointment_id: string;
  sender_id: string;
  recipient_id: string;
  message_type: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type ConsultationSignalRecord = {
  id: string;
  room_id: string;
  sender_id: string;
  signal_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export const API_BASE = (import.meta.env.VITE_API_BASE ?? "http://localhost:8000").replace(/\/+$/, "");

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("medrag:auth-expired", { detail }));
    }
    throw new Error(`${response.status} ${response.statusText} from ${url}: ${detail || "Request failed"}`);
  }
  return response.json() as Promise<T>;
}

async function requestBlob(path: string, options: RequestInit = {}, token?: string): Promise<Blob> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("medrag:auth-expired", { detail }));
    }
    throw new Error(`${response.status} ${response.statusText} from ${url}: ${detail || "Request failed"}`);
  }
  return response.blob();
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

export const api = {
  async register(payload: {
    email: string;
    password: string;
    full_name: string;
    role: string;
    phone?: string;
    registration_number?: string;
  }) {
    const hashedPassword = await sha256(payload.password);
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...payload, password: hashedPassword }),
    });
  },
  async registerPatientIntake(payload: {
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
    const hashedPassword = await sha256(payload.password);
    for (const [key, value] of Object.entries(payload)) {
      if (key !== "documents" && typeof value === "string") {
        form.append(key, key === "password" ? hashedPassword : value);
      }
    }
    for (const doc of payload.documents) {
      form.append("files", doc.file);
      form.append("document_types", doc.document_type);
    }
    return request<PatientIntakeResponse>("/auth/register/patient-intake", { method: "POST", body: form });
  },
  async login(payload: { email: string; password: string }) {
    const hashedPassword = await sha256(payload.password);
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ ...payload, password: hashedPassword }),
    });
  },
  async verifyMfa(payload: { mfa_token: string; otp: string }) {
    return request<AuthResponse>("/auth/mfa-verify", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async changePassword(token: string, payload: { current_password: string; new_password: string }) {
    const hashedCurrent = await sha256(payload.current_password);
    const hashedNew = await sha256(payload.new_password);
    return request<{ message: string }>(
      "/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({
          current_password: hashedCurrent,
          new_password: hashedNew,
        }),
      },
      token,
    );
  },
  async getMe(token: string) {
    type MeResponse = {
      id: string;
      email: string;
      full_name: string;
      role: string;
      phone: string;
      registration_number: string;
      age?: number;
      city?: string;
      gender?: string;
      speciality?: string;
    };
    try {
      return await request<MeResponse>("/auth/me", {}, token);
    } catch (err: any) {
      if (String(err?.message || "").includes("404")) {
        return request<MeResponse>("/auth/profile", {}, token);
      }
      throw err;
    }
  },
  async updateMe(
    token: string,
    payload: {
      full_name?: string;
      phone?: string;
      age?: number;
      city?: string;
      gender?: string;
      speciality?: string;
    },
  ) {
    type MeResponse = {
      id: string;
      email: string;
      full_name: string;
      role: string;
      phone: string;
      registration_number: string;
      age?: number;
      city?: string;
      gender?: string;
      speciality?: string;
    };
    try {
      return await request<MeResponse>("/auth/me", { method: "PUT", body: JSON.stringify(payload) }, token);
    } catch (err: any) {
      if (String(err?.message || "").includes("404")) {
        return request<MeResponse>("/auth/profile", { method: "PUT", body: JSON.stringify(payload) }, token);
      }
      throw err;
    }
  },
  async requestPasswordReset(payload: { email: string }) {
    return request<{ message: string, simulated_otp?: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async resetPassword(payload: { email: string; otp: string; new_password: string }) {
    const hashedNew = await sha256(payload.new_password);
    return request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ ...payload, new_password: hashedNew }),
    });
  },
  async logout(token: string) {
    return request<{ message: string }>("/auth/logout", { method: "POST" }, token);
  },
  async updateProfile(token: string, payload: Parameters<typeof this.updateMe>[1]) {
    return this.updateMe(token, payload);
  },
  async createDoctor(
    token: string,
    payload: {
      email: string;
      password?: string;
      full_name: string;
      phone?: string;
      registration_number: string;
      speciality?: string;
      hospital_id: string;
      department_id: string;
      consultation_fee?: number;
    },
  ) {
    const hashedPassword = payload.password ? await sha256(payload.password) : undefined;
    return request<{
      doctor_user_id: string;
      doctor_assignment_id: string;
      full_name: string;
      email: string;
      speciality: string;
    }>(
      "/hospitals/create-doctor",
      {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          ...(hashedPassword ? { password: hashedPassword } : {}),
        }),
      },
      token,
    );
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
  askClinicalRag(
    token: string,
    payload: { question: string; patient_id?: string | null; user_role?: string },
  ) {
    return request<ClinicalAnswer>(
      "/clinical/ask",
      {
        method: "POST",
        body: JSON.stringify({
          question: payload.question,
          patient_id: payload.patient_id || null,
          user_role: payload.user_role,
        }),
      },
      token,
    );
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
      acoustic_cough_type?: string;
      wheeze_acoustic_type?: string;
    },
  ) {
    return request<CareAgentResponse>(
      "/care-agent/symptom-action",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    );
  },
  pmjayCheckEligibility(token: string, payload: { diagnosis: string; patient_id?: string | null }) {
    return request<{
      eligible: boolean;
      package_name: string;
      package_code: string;
      coverage_amount: number;
      reasoning: string;
      guidelines: string[];
    }>("/shared/pmjay-eligibility", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  registerFamily(token: string, payload: { full_name: string; relation: string; age?: number; notes?: string; scope?: string }) {
    return request<{ id: string }>("/patient/family/register", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  getFamily(token: string) {
    return request<Array<{
      id: string;
      full_name: string;
      relation: string;
      age: number;
      notes: string;
      member_user_id: string | null;
      active_consent: { id: string; scope: string; purpose: string; expires_at: string | null } | null;
    }>>("/patient/family", {}, token);
  },
  listFamilyMembers(token: string) {
    return this.getFamily(token).then((members) =>
      members.map((member) => ({
        ...member,
        name: member.full_name,
      })),
    );
  },
  triggerWhatsappAlert(token: string, payload: { consent_grant_id: string }) {
    return request<{ status: string }>("/compliance/consent/alert-whatsapp", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  getWhatsappLogs(token: string) {
    return request<Array<{
      id: string;
      to_phone: string;
      body: string;
      consent_grant_id: string | null;
      status: string;
      created_at: string;
    }>>("/compliance/consent/whatsapp-logs", {}, token);
  },
  whatsappLogs(token: string) {
    return this.getWhatsappLogs(token);
  },
  renewWhatsappConsent(token: string, payload: { consent_grant_id: string }) {
    return request<{ status: string; new_expiry: string }>("/compliance/consent/renew-whatsapp", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  checkDrugInteractions(token: string, payload: { medicines: string[] }) {
    return request<{
      interactions: Array<{ medicine_a: string; medicine_b: string; severity: string; message: string }>;
    }>("/doctor/drug-interactions", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  uploadDocument(token: string, file: File, documentType: string, patientId?: string | null) {
    const form = new FormData();
    form.append("file", file);
    const patientQuery = patientId ? `&patient_id=${encodeURIComponent(patientId)}` : "";
    return request<DocumentRecord>(
      `/documents/upload?document_type=${encodeURIComponent(documentType)}${patientQuery}`,
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
  verifyOcr(token: string, docId: string, verifiedText: string) {
    return request<DocumentRecord>(
      `/documents/${encodeURIComponent(docId)}/verify-ocr`,
      { method: "POST", body: JSON.stringify({ verified_text: verifiedText }) },
      token,
    );
  },
  listDocuments(token: string, patientId?: string | null) {
    const query = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
    return request<DocumentRecord[]>(`/documents${query}`, { method: "GET" }, token);
  },
  listDocumentJobs(token: string, docId: string) {
    return request<IngestionJobRecord[]>(`/documents/${encodeURIComponent(docId)}/jobs`, { method: "GET" }, token);
  },
  deleteDocument(token: string, docId: string) {
    return request<{ status: string }>(`/documents/${encodeURIComponent(docId)}`, { method: "DELETE" }, token);
  },
  retryDocumentIngestion(token: string, docId: string) {
    return request<DocumentRecord>(
      `/documents/${encodeURIComponent(docId)}/retry-ingestion`,
      { method: "POST" },
      token,
    );
  },
  viewDocument(token: string, docId: string) {
    return requestBlob(`/documents/${encodeURIComponent(docId)}/download?inline=true`, { method: "GET" }, token);
  },
  getPatientProfile(token: string, patientId: string) {
    return request<{
      blood_group?: string;
      date_of_birth?: string;
      gender?: string;
      allergies?: string;
      chronic_conditions?: string;
      current_medications?: string;
    }>(`/patient/profile/${encodeURIComponent(patientId)}`, { method: "GET" }, token);
  },
  listAppointments(token: string, patientId?: string | null) {
    const query = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
    return request<AppointmentRecord[]>(`/hospitals/appointments${query}`, { method: "GET" }, token);
  },
  listMyAppointments(token: string) {
    return this.listAppointments(token);
  },
  updateAppointmentStatus(token: string, appointmentId: string, payload: { status: string; cancellation_reason?: string }) {
    return request<AppointmentRecord>(
      `/hospitals/appointments/${encodeURIComponent(appointmentId)}/status`,
      { method: "POST", body: JSON.stringify(payload) },
      token,
    );
  },
  createPrescription(token: string, payload: { patient_id: string; diagnosis: string; medications: string; dosage?: string; duration?: string; instructions?: string; follow_up_date?: string; pmjay_covered?: boolean }) {
    return request<any>("/doctor/prescriptions", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  listPrescriptions(token: string, patientId?: string | null) {
    const query = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
    return request<any[]>(`/doctor/prescriptions${query}`, { method: "GET" }, token);
  },
  getAiPrescriptionDraft(token: string, payload: { patient_id: string; notes?: string }) {
    return request<any>("/doctor/ai-prescription", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  getPrescriptionEducation(token: string, rxId: string) {
    return request<any>(`/doctor/prescriptions/${encodeURIComponent(rxId)}/education`, { method: "GET" }, token);
  },
  createConsent(
    token: string,
    payload: { patient_id: string; grantee_id: string; scope: string; purpose: string; expires_at?: string | null },
  ) {
    return request("/compliance/consents", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  requestPatientAccess(token: string, payload: { patient_id: string; scope?: string; purpose?: string }) {
    return request<{
      id: string;
      patient_id: string;
      requester_id: string;
      requester_name: string;
      requester_role: string;
      scope: string;
      purpose: string;
      status: string;
      consent_grant_id: string | null;
      created_at: string;
      decided_at: string | null;
    }>("/compliance/access-requests", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  listPatientAccessRequests(token: string, status = "pending") {
    return request<Array<{
      id: string;
      patient_id: string;
      requester_id: string;
      requester_name: string;
      requester_role: string;
      scope: string;
      purpose: string;
      status: string;
      consent_grant_id: string | null;
      created_at: string;
      decided_at: string | null;
    }>>(`/compliance/access-requests?status=${encodeURIComponent(status)}`, {}, token);
  },
  approvePatientAccessRequest(token: string, requestId: string) {
    return request<{
      id: string;
      status: string;
      consent_grant_id: string | null;
    }>(`/compliance/access-requests/${encodeURIComponent(requestId)}/approve`, { method: "POST" }, token);
  },
  listDoctors(params: { city?: string; speciality?: string } = {}) {
    const query = new URLSearchParams();
    if (params.city) query.set("city", params.city);
    if (params.speciality) query.set("speciality", params.speciality);
    return request<any[]>(`/hospitals/doctors?${query.toString()}`);
  },
  listDoctorsByCity(city: string, speciality?: string) {
    return this.listDoctors({ city, speciality });
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
    city?: string;
  } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    return request<ConsultationSlotRecord[]>(`/hospitals/slots?${query.toString()}`);
  },
  bookConsultation(
    token: string,
    payload: {
      slot_id: string;
      reason?: string;
      urgency?: string;
      notes?: string;
      payment_method?: string;
      insurance_provider?: string;
      insurance_policy_number?: string;
    },
  ) {
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
      ambulance_count?: number;
      ambulance_types?: string;
      beds_total?: number;
      rooms_total?: number;
      icu_beds_total?: number;
      ac_rooms_total?: number;
    },
  ) {
    return request<HospitalRecord>("/hospitals", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  updateHospitalResources(
    token: string,
    hospitalId: string,
    payload: {
      ambulance_count: number;
      ambulance_types: string;
      beds_total: number;
      rooms_total: number;
      icu_beds_total: number;
      ac_rooms_total: number;
    },
  ) {
    return request<HospitalRecord>(
      `/hospitals/${encodeURIComponent(hospitalId)}/resources`,
      { method: "POST", body: JSON.stringify(payload) },
      token,
    );
  },
  createHospitalResourceBooking(token: string, payload: { hospital_id: string; booking_type: string; resource_type: string; reason?: string }) {
    return request<any>("/hospitals/resource-bookings", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  listHospitalResourceBookings(token: string, status = "") {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<any[]>(`/hospitals/resource-bookings${query}`, {}, token);
  },
  updateHospitalResourceBooking(token: string, bookingId: string, payload: { status: string; admin_notes?: string }) {
    return request<any>(
      `/hospitals/resource-bookings/${encodeURIComponent(bookingId)}/status`,
      { method: "POST", body: JSON.stringify(payload) },
      token,
    );
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
      hospital_id?: string;
      department_id?: string;
      doctor_id?: string;
      date: string;
      start_time: string;
      end_time: string;
      timezone?: string;
      slot_duration_minutes?: number;
      consultation_mode?: string;
      capacity?: number;
      consultation_fee?: number;
      accept_insurance?: boolean;
    },
  ) {
    return request<ConsultationSlotRecord>("/hospitals/slots", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  transcribeVoice(token: string, file: File, language: string) {
    const form = new FormData();
    form.append("file", file);
    return request<{
      raw_text: string;
      text: string;
      acoustic_cough_type: string;
      wheeze_acoustic_type: string;
    }>(`/shared/voice/transcribe?language=${encodeURIComponent(language)}`, { method: "POST", body: form }, token);
  },
  soapNote(token: string, payload: { visit_summary: string }) {
    return request<{
      soap: Record<string, string>;
      diff_warnings: string[];
    }>("/doctor/soap-note", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  smsReceive(payload: { phone: string; body: string }) {
    return request<{ status: string; reply: string }>("/communication/sms/receive", { method: "POST", body: JSON.stringify(payload) });
  },
  smsLogs(token: string) {
    return request<Array<{
      id: string;
      phone: string;
      body: string;
      direction: string;
      created_at: string;
    }>>("/communication/sms/logs", {}, token);
  },
  redTeamRun(token: string) {
    return request<Array<{
      id: string;
      prompt: string;
      safety_label: string;
      reply: string;
      is_safe: boolean;
      created_at: string;
    }>>("/compliance/red-team/run", { method: "POST" }, token);
  },
  runRedTeamSimulator(token: string) {
    return this.redTeamRun(token);
  },
  redTeamHistory(token: string) {
    return request<{
      drift_score: number;
      total_runs: number;
      logs: Array<{
        id: string;
        prompt: string;
        safety_label: string;
        reply: string;
        is_safe: boolean;
        created_at: string;
      }>;
    }>("/compliance/red-team/score", {}, token);
  },
  redTeamScore(token: string) {
    return this.redTeamHistory(token);
  },
  createSecondOpinion(
    token: string,
    payload: { specialty: string; redacted_summary: string; clinical_question: string }
  ) {
    return request<{
      id: string;
      clinician_id: string;
      specialty: string;
      redacted_summary: string;
      clinical_question: string;
      status: string;
      response_recommendation: string | null;
      responder_id: string | null;
      created_at: string;
    }>("/doctor/second-opinion/create", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  secondOpinionBoard(token: string) {
    return request<Array<{
      id: string;
      clinician_id: string;
      specialty: string;
      redacted_summary: string;
      clinical_question: string;
      status: string;
      response_recommendation: string | null;
      responder_id: string | null;
      created_at: string;
    }>>("/doctor/second-opinion/board", {}, token);
  },
  respondSecondOpinion(
    token: string,
    payload: { request_id: string; response_recommendation: string }
  ) {
    return request<{
      id: string;
      clinician_id: string;
      specialty: string;
      redacted_summary: string;
      clinical_question: string;
      status: string;
      response_recommendation: string | null;
      responder_id: string | null;
      created_at: string;
    }>("/doctor/second-opinion/respond", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  ocrSpellcheck(token: string, payload: { text: string }) {
    return request<Array<{
      original: string;
      correction: string;
      is_typo: boolean;
      suggestions: string[];
    }>>("/shared/ocr/spellcheck", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  pillboxPing(token: string, payload: { reminder_id: string; status: string }) {
    return request<{ status: string; alert_id: string; caregiver_notified: boolean }>(
      "/patient/pillbox/ping",
      { method: "POST", body: JSON.stringify(payload) },
      token
    );
  },
  pillboxAlerts(token: string) {
    return request<Array<{
      id: string;
      reminder_id: string;
      patient_id: string;
      status: string;
      logged_at: string;
    }>>("/patient/pillbox/alerts", {}, token);
  },
  screenMentalHealthConversation(token: string, payload: { conversation_text: string }) {
    return request<{ score: number; risk_level: string; sentiment_score: number }>(
      "/patient/mental-health/screen-conversation",
      { method: "POST", body: JSON.stringify(payload) },
      token
    );
  },
  weatherAllergenSync(token: string) {
    return request<{ aqi: number; pollen: string; vulnerable: boolean; alerts_triggered: number; tasks_created: string[] }>(
      "/patient/weather-health/allergen-sync",
      { method: "POST" },
      token
    );
  },
  getGuidelineDriftAlerts(token: string) {
    return request<Array<{
      id: string;
      guideline_title: string;
      published_source: string;
      drift_reason: string;
      action_taken: string;
      created_at: string;
    }>>("/compliance/guidelines/drift-alerts", {}, token);
  },
  checkGuidelineDrift(token: string) {
    return request<Array<{
      id: string;
      guideline_title: string;
      published_source: string;
      drift_reason: string;
      action_taken: string;
      created_at: string;
    }>>("/compliance/guidelines/check-drift", { method: "POST" }, token);
  },
  hashTimelineLedger(token: string, patient_id?: string | null) {
    const query = patient_id ? `?patient_id=${encodeURIComponent(patient_id)}` : "";
    return request<{
      id: string;
      patient_id: string;
      block_index: number;
      timeline_hash: string;
      previous_hash: string;
      nonce: number;
      hash: string;
      created_at: string;
    }>(`/compliance/ledger/hash-timeline${query}`, { method: "POST" }, token);
  },
  verifyLedger(token: string, patient_id?: string | null) {
    const query = patient_id ? `?patient_id=${encodeURIComponent(patient_id)}` : "";
    return request<{ is_valid: boolean; error: string | null }>(
      `/compliance/ledger/verify${query}`,
      { method: "POST" },
      token
    );
  },
  getLedgerBlocks(token: string, patient_id?: string | null) {
    const query = patient_id ? `?patient_id=${encodeURIComponent(patient_id)}` : "";
    return request<Array<{
      id: string;
      patient_id: string;
      block_index: number;
      timeline_hash: string;
      previous_hash: string;
      nonce: number;
      hash: string;
      created_at: string;
    }>>(`/compliance/ledger/blocks${query}`, {}, token);
  },
  getSimilarCases(token: string, doc_id: string) {
    return request<{
      similar_cases: Array<{
        case_id: string;
        modality: string;
        observations: string;
        treatment_plan: string;
        outcome: string;
        similarity_score: number;
      }>;
    }>(`/documents/imagery/similar-cases/${doc_id}`, {}, token);
  },
  generateCohort(token: string, payload: { chronic_condition: string; min_age: number; max_age: number }) {
    return request<Array<{
      id: string;
      age: number;
      gender: string;
      chronic_conditions: string;
      timeline_events_count: number;
    }>>("/public-health/cohorts", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  getOutbreakMap(token: string) {
    return request<{
      heatmap: Array<{
        city: string;
        state: string;
        disease: string;
        cases_count: number;
        severity: string;
        message: string;
      }>;
    }>("/public-health/outbreak-map", {}, token);
  },
  voiceAudit(token: string, payload: { audio_text: string }) {
    return request<{
      status: string;
      event_id: string;
      hash: string;
      previous_hash: string;
      transcript: string;
    }>("/communication/voice-audit", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  triggerBreakGlass(token: string, payload: { patient_id: string; purpose: string }) {
    return request<{ status: string }>(
      "/compliance/break-glass",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    );
  },
  dispatchAmbulance(token: string, payload: { symptoms: string; location_text: string; hospital_id?: string; latitude?: number; longitude?: number }) {
    return request<{
      request_id: string;
      booking_reference: string;
      status: string;
      eta: string;
      symptoms: string;
      location: string;
      latitude?: number;
      longitude?: number;
    }>("/patient/ambulance/dispatch", { method: "POST", body: JSON.stringify(payload) }, token);
  },
  listAmbulanceRequests(token: string, status = "requested") {
    return request<Array<{
      id: string;
      patient_id: string;
      patient_name: string;
      hospital_id: string | null;
      hospital_name: string;
      symptoms: string;
      location_text: string;
      latitude: number | null;
      longitude: number | null;
      status: string;
      provider_reference: string;
      created_at: string;
    }>>(`/hospitals/ambulance/requests?status=${encodeURIComponent(status)}`, {}, token);
  },
  dispatchAmbulanceRequest(token: string, requestId: string) {
    return request<{ id: string; status: string; provider_reference: string; eta: string }>(
      `/hospitals/ambulance/requests/${encodeURIComponent(requestId)}/dispatch`,
      { method: "POST" },
      token,
    );
  },
  createMedicationReminder(token: string, payload: { medicine_name: string; dosage: string; schedule: string; patient_id?: string }) {
    return request<any>("/patient/medication-reminders", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token);
  },
  listMedicationReminders(token: string, patient_id?: string) {
    const query = patient_id ? `?patient_id=${encodeURIComponent(patient_id)}` : "";
    return request<Array<{
      id: string;
      patient_id: string;
      medicine_name: string;
      dosage: string;
      schedule: string;
      active: boolean;
      created_at: string;
    }>>(`/patient/medication-reminders${query}`, {}, token);
  },
  joinConsultationRoom(token: string, appointmentId: string) {
    return request<ConsultationRoomRecord>(
      `/consultations/${encodeURIComponent(appointmentId)}/room`,
      { method: "POST" },
      token,
    );
  },
  endConsultationRoom(token: string, appointmentId: string) {
    return request<ConsultationRoomRecord>(
      `/consultations/${encodeURIComponent(appointmentId)}/room/end`,
      { method: "POST" },
      token,
    );
  },
  listConsultationMessages(token: string, appointmentId: string, sinceId = "") {
    const query = sinceId ? `?since_id=${encodeURIComponent(sinceId)}` : "";
    return request<ConsultationMessageRecord[]>(
      `/consultations/${encodeURIComponent(appointmentId)}/messages${query}`,
      {},
      token,
    );
  },
  sendConsultationMessage(
    token: string,
    appointmentId: string,
    payload: { body: string; message_type?: string; client_message_id?: string },
  ) {
    return request<ConsultationMessageRecord>(
      `/consultations/${encodeURIComponent(appointmentId)}/messages`,
      { method: "POST", body: JSON.stringify(payload) },
      token,
    );
  },
  postConsultationSignal(
    token: string,
    appointmentId: string,
    payload: { signal_type: string; payload: Record<string, unknown> },
  ) {
    return request<{ id: string; status: string }>(
      `/consultations/${encodeURIComponent(appointmentId)}/signals`,
      { method: "POST", body: JSON.stringify(payload) },
      token,
    );
  },
  pollConsultationSignals(token: string, appointmentId: string) {
    return request<ConsultationSignalRecord[]>(
      `/consultations/${encodeURIComponent(appointmentId)}/signals`,
      {},
      token,
    );
  },
};
