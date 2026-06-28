import json
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
SFT_OUTPUT_PATH = BASE_DIR / "apps" / "api" / "training" / "generated_medrag_sft.jsonl"
SOURCES_DIR = BASE_DIR / "apps" / "api" / "training" / "sources"

# Pre-packaged backup list of Indian drug MCQs to guarantee execution offline
BACKUP_DRUG_MCQS = [
    {
        "question": "Which of the following is a common brand name for Paracetamol (Acetaminophen) in India?",
        "option_a": "Crocin",
        "option_b": "Aspirin",
        "option_c": "Combiflam",
        "option_d": "Brufen",
        "correct_answer": "A",
        "correct_option_text": "Crocin",
        "generic_name": "Paracetamol",
        "therapeutic_class": "Analgesics / Antipyretics"
    },
    {
        "question": "What is the primary active ingredient in the Indian brand 'Glycomet'?",
        "option_a": "Glimepiride",
        "option_b": "Metformin Hydrochloride",
        "option_c": "Voglibose",
        "option_d": "Pioglitazone",
        "correct_answer": "B",
        "correct_option_text": "Metformin Hydrochloride",
        "generic_name": "Metformin",
        "therapeutic_class": "Antidiabetics"
    },
    {
        "question": "Which drug class does the Indian medication 'Amlokind' (Amlodipine) belong to?",
        "option_a": "Beta blocker",
        "option_b": "ACE inhibitor",
        "option_c": "Calcium Channel Blocker (CCB)",
        "option_d": "Angiotensin Receptor Blocker (ARB)",
        "correct_answer": "C",
        "correct_option_text": "Calcium Channel Blocker (CCB)",
        "generic_name": "Amlodipine",
        "therapeutic_class": "Antihypertensives"
    },
    {
        "question": "What is the common salt composition of the brand 'Pantocid' used widely in India?",
        "option_a": "Omeprazole",
        "option_b": "Rabeprazole",
        "option_c": "Pantoprazole",
        "option_d": "Ranitidine",
        "correct_answer": "C",
        "correct_option_text": "Pantoprazole",
        "generic_name": "Pantoprazole",
        "therapeutic_class": "Gastrointestinals (Proton Pump Inhibitors)"
    },
    {
        "question": "Which medication is commonly prescribed in India under the brand name 'Telma'?",
        "option_a": "Telmisartan",
        "option_b": "Amlodipine",
        "option_c": "Ramipril",
        "option_d": "Atenolol",
        "correct_answer": "A",
        "correct_option_text": "Telmisartan",
        "generic_name": "Telmisartan",
        "therapeutic_class": "Antihypertensives (Angiotensin Receptor Blockers)"
    },
    {
        "question": "Under the Drugs and Cosmetics Act of India, which schedule requires a prescription from a Registered Medical Practitioner (RMP) and carries warning labels?",
        "option_a": "Schedule G",
        "option_b": "Schedule H",
        "option_c": "Schedule Y",
        "option_d": "Schedule C",
        "correct_answer": "B",
        "correct_option_text": "Schedule H",
        "generic_name": "N/A",
        "therapeutic_class": "Regulatory"
    },
    {
        "question": "Which of the following brand names is a combination of Ibuprofen and Paracetamol widely used for pain relief in India?",
        "option_a": "Flexon",
        "option_b": "Combiflam",
        "option_c": "Calpol",
        "option_d": "Both A and B",
        "correct_answer": "D",
        "correct_option_text": "Both A and B",
        "generic_name": "Ibuprofen + Paracetamol",
        "therapeutic_class": "Analgesics / NSAIDs"
    },
    {
        "question": "What is the primary indication of 'Augmentin 625 Duo' in Indian clinical practice?",
        "option_a": "Viral fever management",
        "option_b": "Bacterial infections (Amoxicillin + Clavulanate)",
        "option_c": "Fungal skin infection",
        "option_d": "Allergic rhinitis",
        "correct_answer": "B",
        "correct_option_text": "Bacterial infections (Amoxicillin + Clavulanate)",
        "generic_name": "Amoxicillin + Clavulanic Acid",
        "therapeutic_class": "Antibacterial"
    },
    {
        "question": "The brand name 'Lantus' refers to which type of insulin commonly used in India?",
        "option_a": "Insulin Glargine (Long-acting)",
        "option_b": "Insulin Lispro (Rapid-acting)",
        "option_c": "Regular Human Insulin (Short-acting)",
        "option_d": "Isophane Insulin (Intermediate-acting)",
        "correct_answer": "A",
        "correct_option_text": "Insulin Glargine (Long-acting)",
        "generic_name": "Insulin Glargine",
        "therapeutic_class": "Antidiabetics"
    },
    {
        "question": "Which schedule was introduced under the Drugs & Cosmetics Rules to track and control the selling of third and fourth generation antibiotics, requiring a separate billing register?",
        "option_a": "Schedule H",
        "option_b": "Schedule H1",
        "option_c": "Schedule X",
        "option_d": "Schedule J",
        "correct_answer": "B",
        "correct_option_text": "Schedule H1",
        "generic_name": "N/A",
        "therapeutic_class": "Regulatory"
    }
]

CLINICAL_BEHAVIOR_ROWS = [
    {
        "instruction": "Doctor role: answer a medication question for an adult outpatient. Give clinician-facing options, dose-safety checks, contraindications, monitoring, and escalation criteria. Do not refuse solely because treatment is being discussed.",
        "context": "Scenario: Stable adult with uncomplicated fever. No age, pregnancy status, allergies, liver disease, renal disease, dengue risk, current medicines, or vitals are supplied.",
        "response": "For a stable adult with uncomplicated fever, first confirm severity, duration, temperature, hydration, local outbreak context, pregnancy status, allergies, liver disease, renal disease, anticoagulant use, and current medicines.\n\nMedication options to consider:\n1. Paracetamol/acetaminophen is the usual first-line antipyretic when no contraindication exists. Typical adult dosing is 500-1000 mg every 6-8 hours as needed. Keep total daily dose within local formulary limits, and use a lower maximum in older adults, low body weight, alcohol use, or liver disease.\n2. Avoid routine NSAIDs if dengue, significant dehydration, renal impairment, peptic ulcer disease, anticoagulant use, uncontrolled hypertension, heart failure, or pregnancy risk is present. If an NSAID is considered, document indication and GI/renal/cardiovascular risk.\n\nDo not mask danger signs. Escalate urgently for altered sensorium, breathlessness, hypotension, persistent high fever, bleeding, severe abdominal pain, neck stiffness, seizures, low oxygen saturation, pregnancy, infants/elderly/frail patients, or immunosuppression. Reassess if fever persists beyond 48-72 hours or local disease patterns suggest malaria, dengue, influenza, COVID-19, typhoid, sepsis, or another specific diagnosis.",
        "metadata": {"source": "clinical_behavior_seed", "role": "doctor", "topic": "generic_fever"}
    },
    {
        "instruction": "Doctor role: provide a general treatment-planning framework for any disease without hardcoding a single disease. Include medication selection, safety checks, monitoring, and escalation.",
        "context": "Scenario: The doctor asks for treatment advice but patient-specific details are incomplete.",
        "response": "Use a disease-agnostic clinician workflow:\n\n1. Confirm the working diagnosis and severity. Separate emergency, inpatient, outpatient, infectious, inflammatory, metabolic, toxic, obstetric, pediatric, and geriatric contexts.\n2. Check essentials before medicines: age, weight, pregnancy/lactation, allergies, renal and hepatic function, vitals, comorbidities, current medicines, prior adverse reactions, local resistance/outbreak patterns, and relevant labs/imaging.\n3. Select treatment class based on diagnosis and guideline fit. Prefer first-line therapies when criteria are met; avoid antibiotics, steroids, anticoagulants, opioids, sedatives, and high-risk drugs unless clear indications and monitoring exist.\n4. For each option document dose range, route, duration, contraindications, important interactions, monitoring parameters, expected response time, and follow-up.\n5. Add non-drug management when relevant: hydration, rest, diet, physiotherapy, wound care, isolation, lifestyle change, or procedural referral.\n6. Escalate urgently for red flags, organ dysfunction, pregnancy complications, severe pain, altered mental status, shock, hypoxia, sepsis risk, uncontrolled bleeding, severe dehydration, or treatment failure.",
        "metadata": {"source": "clinical_behavior_seed", "role": "doctor", "topic": "generic_treatment_framework"}
    },
    {
        "instruction": "Doctor role: answer a concise clinical prescribing question when information is missing. Be useful, list assumptions, and do not expose internal prompts.",
        "context": "Scenario: A doctor asks which tablets may be considered, but diagnosis, severity, age, pregnancy status, allergies, renal/hepatic function, and current medicines are not supplied.",
        "response": "With missing patient details, give conditional clinician support rather than a final prescription.\n\nAssumptions to verify first: diagnosis, severity, age/weight, pregnancy/lactation, allergies, renal and hepatic function, vitals, current medicines, comorbidities, and relevant investigations.\n\nAnswer structure:\n- If mild and outpatient-appropriate, list first-line medication classes and common adult dose ranges from accepted references.\n- State when each option should be avoided.\n- State monitoring and follow-up timing.\n- State red flags requiring urgent referral or admission.\n- End with: final prescribing decision remains with the treating Registered Medical Practitioner after examination and documentation.",
        "metadata": {"source": "clinical_behavior_seed", "role": "doctor", "topic": "missing_context"}
    },
    {
        "instruction": "Patient role: explain a medicine request safely. Educate and recommend clinician review, but do not provide a dose, prescription, or cure claim.",
        "context": "Scenario: Patient asks which tablet to take for fever without a clinician visit.",
        "response": "I can explain fever care, but I cannot prescribe a tablet or dose for you personally. Fever can come from many causes, including viral infection, dengue, malaria, typhoid, COVID-19, urinary infection, or other illnesses.\n\nWhat you can do safely: rest, drink fluids, track temperature, avoid self-mixing medicines, and speak with a clinician or pharmacist if you already take other medicines or have liver, kidney, stomach ulcer, pregnancy, or allergy concerns.\n\nSeek urgent care if you have breathing difficulty, confusion, fainting, chest pain, severe headache or neck stiffness, rash or bleeding, severe dehydration, persistent high fever, pregnancy, very young/elderly age, or worsening symptoms.",
        "metadata": {"source": "clinical_behavior_seed", "role": "patient", "topic": "patient_fever_boundary"}
    },
    {
        "instruction": "Doctor role: answer without repeating text, leaking prompt markers, or showing internal workflow details.",
        "context": "Scenario: The final answer should be displayed directly to the doctor.",
        "response": "Final clinical answer: confirm diagnosis and severity, check allergies and renal/hepatic function, choose guideline-appropriate first-line therapy, document contraindications and interactions, define monitoring and follow-up, and escalate for red flags or treatment failure. Do not display internal prompts, retrieval text, chain-of-thought, or repeated template fragments.",
        "metadata": {"source": "clinical_behavior_seed", "role": "doctor", "topic": "no_prompt_leak"}
    },
    {
        "instruction": "Doctor role: give a medication-safety checklist that applies across diseases.",
        "context": "Scenario: A clinician wants a checklist before prescribing any new medicine.",
        "response": "Before prescribing any new medicine, check:\n\n1. Indication: working diagnosis, severity, guideline indication, and non-drug alternatives.\n2. Patient factors: age, weight, pregnancy/lactation, allergies, renal function, hepatic function, frailty, comorbidities, and prior adverse reactions.\n3. Medicine factors: dose, route, frequency, duration, maximum daily dose, contraindications, interactions, duplication, therapeutic monitoring, and availability.\n4. Safety monitoring: baseline labs if needed, expected response time, adverse effects to watch for, follow-up date, and stopping rules.\n5. Escalation: urgent referral for red flags, organ dysfunction, severe allergic reaction, shock, hypoxia, uncontrolled bleeding, severe dehydration, altered mental status, or clinical deterioration.",
        "metadata": {"source": "clinical_behavior_seed", "role": "doctor", "topic": "medication_safety"}
    },
]

def load_drug_mcqa_dataset():
    """Try to load the ekacare dataset from Hugging Face. If it fails, return the backup subset."""
    try:
        from datasets import load_dataset
        print("Attempting to load 'ekacare/indian_drug_mcqa' from Hugging Face...")
        dataset = load_dataset("ekacare/indian_drug_mcqa", split="test")
        print(f"Successfully loaded {len(dataset)} examples from Hugging Face.")
        return dataset
    except Exception as e:
        print(f"Could not load Hugging Face dataset (Error: {e}). Using backup drug datasets.")
        return BACKUP_DRUG_MCQS


def load_existing_rows() -> list[dict]:
    if not SFT_OUTPUT_PATH.exists():
        return []
    rows: list[dict] = []
    with open(SFT_OUTPUT_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows

def generate_sft_examples():
    sft_rows = []
    existing_rows = load_existing_rows()
    
    # 1. Process Drug MCQs
    raw_drugs = load_drug_mcqa_dataset()
    if len(raw_drugs) == len(BACKUP_DRUG_MCQS) and len(existing_rows) > 50:
        print("Offline fallback detected. Preserving existing checked-in SFT rows before adding behavior seeds.")
        seen_keys: set[str] = set()
        for row in existing_rows:
            key = json.dumps(
                {
                    "instruction": row.get("instruction", ""),
                    "context": row.get("context", ""),
                    "response": row.get("response", ""),
                },
                sort_keys=True,
            )
            if key in seen_keys:
                continue
            seen_keys.add(key)
            sft_rows.append(row)
        raw_drugs = []
    for idx, item in enumerate(raw_drugs):
        # Keep MCQs useful but do not let them dominate instruction-following behavior.
        if idx >= 120:
            break
        
        q = item.get("question")
        opt_a = item.get("option_a")
        opt_b = item.get("option_b")
        opt_c = item.get("option_c")
        opt_d = item.get("option_d")
        opt_e = item.get("option_e", "")
        correct = item.get("correct_answer")
        correct_text = item.get("correct_option_text", "")
        
        options_block = f"A: {opt_a}\nB: {opt_b}\nC: {opt_c}\nD: {opt_d}"
        if opt_e:
            options_block += f"\nE: {opt_e}"
            
        context = f"Question Stem:\n{q}\n\nOptions:\n{options_block}"
        
        # If backup MCQ, we have correct_option_text. Otherwise, look it up or just print the letter.
        ans_text = correct_text
        if not ans_text:
            opt_key = f"option_{correct.lower()}"
            ans_text = item.get(opt_key, "")
            
        response = f"The correct answer is {correct}. {ans_text}"
        if item.get("generic_name") and item.get("generic_name") != "N/A":
            response += f"\n\nGeneric Composition: {item['generic_name']}"
        if item.get("therapeutic_class"):
            response += f"\nTherapeutic Category: {item['therapeutic_class']}"
            
        sft_rows.append({
            "instruction": "Solve the following multiple-choice clinical question about Indian drugs and pharmaceuticals. State the correct option letter (A, B, C, D, or E) and provide a concise explanation.",
            "context": context,
            "response": response,
            "metadata": {"source": "ekacare_drug_mcqa", "index": idx, "role": "doctor"}
        })

    # 2. Add role-behavior rows that teach doctor vs patient boundaries and generic prescribing structure.
    existing_behavior_keys = {
        (row.get("instruction", ""), row.get("context", ""), row.get("response", ""))
        for row in sft_rows
    }
    for row in CLINICAL_BEHAVIOR_ROWS:
        key = (row["instruction"], row["context"], row["response"])
        if key not in existing_behavior_keys:
            sft_rows.append(row)

    # 3. Add Synthesized Guideline Pairs (Osteoarthritis, Sinusitis, Hypertension)
    # We want to synthesize doctor-facing and patient-facing QA pairs from our guidelines
    print("Synthesizing patient and doctor dialogue SFT pairs from NHSRC guidelines...")
    
    # Osteoarthritis synthesized SFTs
    sft_rows.append({
        "instruction": "Patient role: explain the supplied medical reference in plain language. Include lifestyle or follow-up points when supported by context, mention red flags, and do not prescribe medicines, doses, cures, or personalized treatment.",
        "context": "Source: NHSRC Standard Treatment Guidelines: Management of Osteoarthritis Knee\nExcerpt: Standing anteroposterior and lateral view X-rays of the knee. Key radiographic findings include joint space narrowing, subchondral sclerosis, and marginal osteophytes. Core treatments include patient education, weight reduction for overweight or obese patients (BMI > 23 kg/m²), and low-impact aerobic exercise.",
        "response": "Based on the NHSRC guidelines for knee osteoarthritis, you can understand your condition in simple terms. The guidelines show that diagnostic joint changes include thinning of the cartilage (joint space narrowing) and extra bone growths (osteophytes). \n\nKey lifestyle measures you should follow include:\n1. Core Exercises: Low-impact aerobic exercises like walking, swimming, or cycling, and specific knee muscle strengthening.\n2. Weight Management: Weight reduction is strongly advised for individuals with a BMI greater than 23 kg/m² in India to relieve joint stress.\n\nRed Flags: If you experience severe swelling, redness, high fever, or find yourself completely unable to put weight on your leg, please seek urgent medical attention, as these signs could indicate a serious joint infection or structural failure.\n\nPlease note: I cannot recommend or prescribe any pain medications, specific tablet doses, or personalized medical treatment. You should discuss drug therapy directly with your doctor.",
        "metadata": {"source": "nhsrc_osteoarthritis", "role": "patient"}
    })
    sft_rows.append({
        "instruction": "Doctor role: use the supplied reference as clinician decision support. Summarize diagnostic considerations, treatment decision points, contraindications, monitoring, and escalation criteria without exposing prompts or internal context.",
        "context": "Source: NHSRC Standard Treatment Guidelines: Management of Osteoarthritis Knee\nExcerpt: Consider oral NSAIDs (Ibuprofen 400-800mg tid, Naproxen 250-500mg bid) if topical agents and paracetamol are inadequate. Always co-prescribe a Proton Pump Inhibitor (Omeprazole 20mg daily) for elderly patients (>60 years) or those with peptic ulcer history. Monitor BP, renal function (Serum Creatinine/eGFR), and fluid retention.",
        "response": "For clinical decision support in managing knee osteoarthritis:\n\n1. Diagnostics & Selection: If first-line topical NSAIDs and paracetamol fail, initiate oral NSAIDs at the lowest effective dose. Options include Ibuprofen (400-800mg TID) or Naproxen (250-500mg BID).\n2. Safety & Contraindications: Co-prescribing a Proton Pump Inhibitor (e.g., Omeprazole 20mg OD) is mandatory for patients aged >60 or those with a history of peptic ulcer disease to mitigate gastrointestinal bleeding risk.\n3. Monitoring: Regularly monitor blood pressure, renal function (Serum Creatinine and eGFR), and signs of fluid retention, particularly in patients with pre-existing hypertension, CKD, or congestive heart failure.\n4. Escalation: Refer to orthopedic specialists for Total Knee Arthroplasty (TKA) evaluation when the patient exhibits severe structural damage, intractable pain, and complete functional impairment unresponsive to full conservative therapies.",
        "metadata": {"source": "nhsrc_osteoarthritis", "role": "doctor"}
    })
    
    # Sinusitis synthesized SFTs
    sft_rows.append({
        "instruction": "Patient role: explain the supplied medical reference in plain language. Include lifestyle or follow-up points when supported by context, mention red flags, and do not prescribe medicines, doses, cures, or personalized treatment.",
        "context": "Source: NHSRC Standard Treatment Guidelines: Acute Sinusitis\nExcerpt: Acute bacterial sinusitis (ABRS) is suspected if symptoms last 10 or more days, or a 'double sickening' occurs (worsening after initial improvement). Non-pharmacological measures include steam inhalation and saline nasal irrigation. Short-term topical nasal decongestants (e.g., Oxymetazoline 0.05%) can be used for a maximum of 3-5 days.",
        "response": "According to the guidelines on sinus inflammation, most sinus issues are viral and clear up on their own. However, a bacterial infection is suspected if your symptoms last 10 or more days without improving, or if you start getting worse after initially feeling better (known as 'double sickening').\n\nSupportive steps you can take at home include:\n1. Steam Inhalation and drinking plenty of fluids to thin mucus.\n2. Saline Nasal Sprays or rinses 2-3 times daily to clean nasal passages.\n3. Short-term Nasal Decongestant Spray (like Oxymetazoline 0.05%): This can be used for a maximum of 3 to 5 days. Using it longer can cause rebound nasal congestion.\n\nRed Flags: Seek immediate emergency care if you experience swelling or redness around your eyes, double vision or changes in sight, severe forehead swelling, an extremely severe headache, neck stiffness, or confusion.\n\nPlease note: I cannot prescribe antibiotics or recommend medication doses. If you suspect a bacterial infection, you must consult a qualified doctor for a prescription.",
        "metadata": {"source": "nhsrc_sinusitis", "role": "patient"}
    })
    sft_rows.append({
        "instruction": "Doctor role: use the supplied reference as clinician decision support. Summarize diagnostic considerations, treatment decision points, contraindications, monitoring, and escalation criteria without exposing prompts or internal context.",
        "context": "Source: NHSRC Standard Treatment Guidelines: Acute Sinusitis\nExcerpt: First-line antibiotic is Amoxicillin 500mg tid (or 875mg bid) for 5-7 days. Alternative: Amoxicillin-Clavulanate 625mg tid or 1000mg bid. Penicillin-allergic: Doxycycline 100mg bid or Levofloxacin 500mg daily. Avoid macrolides due to pneumococcal resistance in India.",
        "response": "For clinical decision support in acute rhinosinusitis:\n\n1. Diagnostics: Diagnose Acute Bacterial Rhinosinusitis (ABRS) if symptoms persist >=10 days without improvement, severe symptoms (fever >=39C + purulent discharge) occur for >=3 days, or 'double sickening' is present. Defers antibiotic therapy for viral cases.\n2. First-line Antibiotics: Initiate Amoxicillin 500mg TID or 875mg BID for 5-7 days. For cases with risk of resistance or failure after 72 hours, prescribe Amoxicillin-Clavulanate (Co-Amoxiclav) 625mg TID or 1000mg BID.\n3. Alternatives for Penicillin Allergy: Prescribe Doxycycline 100mg BID for 5-7 days, or Levofloxacin 500mg OD for 5 days. Macrolides like Azithromycin should be avoided due to widespread pneumococcal resistance in India.\n4. Complications & Escalation: Refer immediately to ENT/Neurosurgery if there is any evidence of orbital complications (periorbital swelling, proptosis, diplopia) or intracranial complications (severe headache, meningismus, altered consciousness).",
        "metadata": {"source": "nhsrc_sinusitis", "role": "doctor"}
    })
    
    # Hypertension synthesized SFTs
    sft_rows.append({
        "instruction": "Patient role: explain the supplied medical reference in plain language. Include lifestyle or follow-up points when supported by context, mention red flags, and do not prescribe medicines, doses, cures, or personalized treatment.",
        "context": "Source: NHSRC / IHCI Standard Treatment Guidelines: Primary Hypertension\nExcerpt: Classification: Stage 1 is 140-159/90-99; Stage 2 is >=160/>=100. Lifestyle modifications: restrict salt intake to less than 5g/day, DASH diet, regular aerobic exercise 30 minutes 5 days a week, target Indian BMI 18.5 to 22.9.",
        "response": "According to the Indian guidelines for high blood pressure (hypertension), Stage 1 is defined as a top reading (systolic) of 140-159 or a bottom reading (diastolic) of 90-99. Stage 2 is defined as a reading of 160/100 or higher.\n\nImportant lifestyle modifications recommended for everyone are:\n1. Restrict Salt Intake: Limit salt to less than 5 grams per day (about one flat teaspoon). Avoid processed foods, pickles, and papad.\n2. Healthy Diet (DASH): Eat a diet rich in fruits, vegetables, whole grains, and low-fat dairy.\n3. Exercise: Do at least 30 minutes of moderate physical activity (like brisk walking) 5 days a week.\n4. Body Weight: Aim to keep a healthy weight with a target BMI of 18.5 to 22.9 kg/m² for Indian adults, and waist size under 90 cm for men and 80 cm for women.\n\nRed Flags: Seek immediate emergency care if you experience a sudden severe headache, chest pain, difficulty breathing, sudden numbness or weakness in your face/arm/leg, or vision changes. These are warning signs of a hypertensive emergency.\n\nPlease note: I cannot prescribe blood pressure medications or advise on specific dosages. Hypertension requires long-term tracking and treatment must be supervised by a clinician.",
        "metadata": {"source": "nhsrc_hypertension", "role": "patient"}
    })
    sft_rows.append({
        "instruction": "Doctor role: use the supplied reference as clinician decision support. Summarize diagnostic considerations, treatment decision points, contraindications, monitoring, and escalation criteria without exposing prompts or internal context.",
        "context": "Source: NHSRC / IHCI Standard Treatment Guidelines: Primary Hypertension\nExcerpt: First-line classes: CCB (Amlodipine 2.5-5mg OD), ARB (Telmisartan 40-80mg OD), Thiazide diuretic (Chlorthalidone 12.5-25mg OD). Diabetes or CKD: use ARB or ACEi first-line due to nephroprotection. Contraindicated in pregnancy. Monitor potassium and creatinine in 1-2 weeks.",
        "response": "For clinical decision support in primary hypertension:\n\n1. Diagnostics: Confirm diagnosis with readings from at least 2 separate visits, unless BP is >=180/110 mmHg or target organ damage is present.\n2. Initial Pharmacotherapy: Start with monotherapy using Calcium Channel Blockers (Amlodipine 2.5-5mg OD), Angiotensin Receptor Blockers (Telmisartan 40-80mg OD), or Thiazide/Thiazide-like Diuretics (Chlorthalidone 12.5-25mg OD).\n3. Compelling Indications:\n   * Diabetes Mellitus or CKD: ARBs (Telmisartan) or ACE Inhibitors (Enalapril) must be selected as first-line due to efferent arteriole vasodilation and renoprotection. Avoid combining ACEi and ARB due to risks of hyperkalemia and acute kidney injury.\n   * Pregnancy: ACE Inhibitors and ARBs are strictly contraindicated due to fetal toxicity. Use methyldopa or labetalol.\n4. Monitoring: Assess BP every 2-4 weeks after drug adjustment; once controlled, evaluate every 3 months. Verify serum potassium and serum creatinine/eGFR within 1-2 weeks of initiating ACEi, ARB, or diuretics to monitor for kidney function changes.",
        "metadata": {"source": "nhsrc_hypertension", "role": "doctor"}
    })

    # PM-JAY synthesized SFTs
    sft_rows.append({
        "instruction": "Doctor role: use the supplied reference as clinician decision support. Summarize diagnostic considerations, treatment decision points, contraindications, monitoring, and escalation criteria without exposing prompts or internal context.",
        "context": "Source: Ayushman Bharat PM-JAY Health Benefit Packages Reference\nExcerpt: Code: SG010A, Name: Total Knee Arthroplasty - Unilateral, Cost: INR 80,000, Pre-authorization: Required. Code: MC005A, Name: Management of Diabetic Ketoacidosis, Cost: INR 15,000, Pre-auth: Not Required for first 24 hours of emergency admission.",
        "response": "For administrative and clinical workflow support under PM-JAY:\n\n1. Elective Specialty Procedures: For a unilateral Total Knee Arthroplasty (Package Code: SG010A, Cost: INR 80,000), pre-authorization is mandatory. Orthopedic surgeons must document structural joint degradation and conservative management failure prior to surgical booking.\n2. Emergency Admissions: For Diabetic Ketoacidosis management (Package Code: MC005A, Cost: INR 15,000), pre-authorization is waived for the first 24 hours of emergency care to prevent delay. Post-facto pre-auth approval must be submitted within 24 hours via the Transaction Management System (TMS).\n3. Package Inclusions: Keep in mind that package reimbursements cover all diagnostic assessments, hospital bed and nursing fees, physician consultation fees, implants, consumables, food, and up to 5 days of post-discharge take-home medicines.",
        "metadata": {"source": "pmjay_packages", "role": "doctor"}
    })

    deduped_rows: list[dict] = []
    seen_final_keys: set[str] = set()
    for row in sft_rows:
        key = json.dumps(
            {
                "instruction": row.get("instruction", ""),
                "context": row.get("context", ""),
                "response": row.get("response", ""),
            },
            sort_keys=True,
        )
        if key in seen_final_keys:
            continue
        seen_final_keys.add(key)
        deduped_rows.append(row)
    sft_rows = deduped_rows

    print(f"Total SFT rows to write: {len(sft_rows)}")
    
    # Save SFT rows to generated_medrag_sft.jsonl
    # Ensure folder exists
    SFT_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(SFT_OUTPUT_PATH, "w", encoding="utf-8") as f:
        for row in sft_rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            
    print(f"Successfully generated SFT file at: {SFT_OUTPUT_PATH}")

if __name__ == "__main__":
    generate_sft_examples()
