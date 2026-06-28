import json
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
SOURCES_DIR = BASE_DIR / "apps" / "api" / "training" / "sources"
MANIFEST_PATH = BASE_DIR / "apps" / "api" / "training" / "rag_source_manifest.json"

OSTEOARTHRITIS_TEXT = """Title: NHSRC Standard Treatment Guidelines: Management of Osteoarthritis Knee
Publisher: National Health Systems Resource Centre / Ministry of Health and Family Welfare, India
Scope: Clinical decision support and patient education for knee osteoarthritis.

1. Background
Osteoarthritis (OA) of the knee is a degenerative joint disease and a leading cause of mobility impairment in the adult Indian population. It is characterized by progressive loss of articular cartilage, osteophyte formation, subchondral bone remodeling, and secondary synovitis.

2. Diagnosis and Assessment
- Clinical Diagnosis: Can be made without imaging in patients aged 50 years or older who present with activity-related knee joint pain, morning stiffness lasting less than 30 minutes, crepitus on active motion, bony enlargement, and no palpable warmth.
- Radiographic Diagnosis: Standing anteroposterior and lateral view X-rays of the knee. Key radiographic findings include joint space narrowing, subchondral sclerosis, subchondral cysts, and marginal osteophytes (Kellgren-Lawrence grading system).
- Red Flags: Severe local swelling, erythema, high fever, inability to bear weight (suspect septic arthritis, gout flare, or major structural fracture requiring emergency orthopedic review).

3. Stepwise Treatment Workflow
Step 1: Non-Pharmacological Management (Core Treatments)
- Patient Education: Emphasize that osteoarthritis is manageable. Explain joint protection strategies.
- Exercise: Core treatment for all patients. Recommend low-impact aerobic exercise (walking, swimming, cycling) and quadriceps/hamstring strengthening exercises. Encourage at least 150 minutes of moderate activity per week.
- Weight Reduction: Strongly advised for overweight or obese patients (BMI > 23 kg/m² in India) to reduce mechanical load on the knee joints.
- Orthoses and Assistive Devices: Walking canes held in the contralateral hand. Lateral wedge insoles for varus deformities, patellar taping, or soft knee sleeves.

Step 2: First-line Pharmacological Therapy (Symptomatic Relief)
- Topical Agents: Recommend Topical NSAIDs (e.g., Diclofenac 1% to 2% gel, applied 3-4 times daily) as first-line therapy, especially for patients with mild-to-moderate pain or those with high GI/cardiovascular risks.
- Paracetamol (Acetaminophen): Can be used as an adjunct, starting at 500mg to 1000mg, up to a maximum of 3g per day. Caution in patients with chronic liver disease or alcohol dependence.

Step 3: Second-line Pharmacological Therapy (Moderate-to-Severe Pain)
- Oral NSAIDs: Consider if topical agents and paracetamol are inadequate. Select the lowest effective dose for the shortest duration.
  * Ibuprofen: 400mg to 800mg three times daily.
  * Naproxen: 250mg to 500mg twice daily.
  * Diclofenac: 50mg two to three times daily.
- Gastrointestinal Protection: Always co-prescribe a Proton Pump Inhibitor (e.g., Omeprazole 20mg once daily or Pantoprazole 40mg once daily) for elderly patients (>60 years) or those with a history of peptic ulcer disease.
- Monitoring: Regular assessment of blood pressure, renal function (Serum Creatinine/eGFR), and signs of fluid retention, particularly in patients with hypertension, chronic kidney disease (CKD), or heart failure.

Step 4: Advanced and Interventional Treatments
- Intra-articular Corticosteroid Injections: Indicated for acute, severe pain flare-ups associated with joint effusion. Provides short-term relief (typically 1 to 4 weeks). Limit to 3-4 injections per year per joint to avoid cartilage acceleration decay.
- Surgical Referral (Total Knee Arthroplasty): Refer for orthopedic evaluation for Total Knee Arthroplasty (TKA) if the patient has severe joint pain, structural damage, marked functional limitation, and poor response to conservative therapies.

4. Patient Safety and Education Policy
- Patient mode: Provide education on weight management, knee exercises, and when to seek urgent care. Refuse to prescribe oral NSAIDs or recommend specific doses to patient accounts.
- Doctor mode: Act as clinician decision support. Detail the risk-benefit profile of oral NSAIDs, the necessity of PPI co-prescription, and renal/cardiovascular safety monitoring."""

SINUSITIS_TEXT = """Title: NHSRC Standard Treatment Guidelines: Acute Sinusitis
Publisher: National Health Systems Resource Centre / Ministry of Health and Family Welfare, India
Scope: Clinical guidance for diagnosis and treatment of acute sinusitis in primary care.

1. Definition and Etiology
Acute sinusitis is defined as symptomatic inflammation of the nasal cavity and the paranasal sinuses lasting less than 4 weeks. Most cases are triggered by viral upper respiratory tract infections (common cold), with only 0.5% to 2% progressing to secondary acute bacterial sinusitis (ABRS).

2. Clinical Diagnosis
Key symptoms include nasal congestion, purulent nasal discharge, facial pain, pressure, or fullness (often unilateral and worsening when bending forward), headache, hyposmia, and maxillary dental pain.
- Viral Rhinosinusitis: Symptoms last less than 10 days, typically peaking around day 3-5 and gradually improving.
- Acute Bacterial Rhinosinusitis (ABRS): Suspect ABRS if any of the following are met:
  * Persistent Symptoms: Symptoms last 10 or more days without clinical improvement.
  * Double Sickening: Initial improvement followed by worsening of nasal discharge, congestion, fever, or headache within 10 days of onset.
  * Severe Symptoms: High fever (>= 39°C) accompanied by purulent nasal discharge and severe facial pain for at least 3 consecutive days.

3. Red Flags and Emergency Referral Criteria
Hypothesize complications if any of the following signs are met. Refer immediately to tertiary care (ENT or neurosurgery):
- Orbital signs: Periorbital edema, erythema, proptosis, double vision (diplopia), restricted eye movements, or decreased visual acuity.
- Intranasal or facial signs: Severe swelling of the forehead or face (Pott's puffy tumor).
- Neurological signs: Severe headache, neck stiffness, photophobia, altered mental status, or focal neurological deficits (suspect meningitis, subdural empyema, or cavernous sinus thrombosis).

4. Treatment Plan
Step 1: Supportive and Symptomatic Care (All patients)
- Hydration and Steam Inhalation: Helps liquefy thick secretions.
- Saline Nasal Irrigation: Buffered isotonic saline nasal sprays or rinses 2-3 times daily to clear secretions.
- Analgesics: Paracetamol 500mg-1000mg every 6 hours or Ibuprofen 400mg every 8 hours as needed for facial pain and fever.
- Decongestants: Short-term topical nasal decongestants (e.g., Oxymetazoline 0.05% nasal spray, 1-2 sprays per nostril twice daily) for a maximum of 3-5 consecutive days to prevent rhinitis medicamentosa (rebound congestion). Oral decongestants (e.g., Pseudoephedrine) may be considered but avoided in patients with severe hypertension or ischemic heart disease.

Step 2: Antibiotic Therapy (Indicated only for confirmed ABRS)
- First-line Antibiotic: Amoxicillin 500mg three times daily (or 875mg twice daily) for 5-7 days in adults.
- Alternative First-line (for high resistance risk or failure after 72 hours): Amoxicillin-Clavulanate (Co-Amoxiclav) 625mg (500/125) three times daily or 1000mg (875/125) twice daily for 5-7 days.
- Penicillin-allergic Patients:
  * Doxycycline: 100mg twice daily for 5-7 days.
  * Levofloxacin: 500mg once daily for 5 days.
- Note: Avoid macrolides (Azithromycin) due to high rates of pneumococcal resistance in India unless no alternatives exist.

5. Patient Safety and Education
- Patient Mode: Counsel on steam inhalation, hydration, nasal saline washes, and short-term spray use. Warn against taking leftover antibiotics. If fever exceeds 39°C or orbital swelling occurs, direct to urgent care.
- Doctor Mode: Support antibiotic stewardship. Advise deferring antibiotics for the first 10 days unless bacterial diagnostic criteria are met."""

HYPERTENSION_TEXT = """Title: NHSRC / IHCI Standard Treatment Guidelines: Primary Hypertension
Publisher: National Health Systems Resource Centre / India Hypertension Control Initiative (IHCI)
Scope: Screening, diagnosis, and medical management of primary hypertension in adults.

1. Classification of Blood Pressure (BP)
Blood pressure readings should be taken after the patient has rested for at least 5 minutes, in a sitting position, with the arm supported at heart level.
- Normal: Systolic < 120 mmHg and Diastolic < 80 mmHg.
- Prehypertension: Systolic 120-139 mmHg or Diastolic 80-89 mmHg.
- Stage 1 Hypertension: Systolic 140-159 mmHg or Diastolic 90-99 mmHg.
- Stage 2 Hypertension: Systolic >= 160 mmHg or Diastolic >= 100 mmHg.

2. Diagnostic Protocol
- Confirm diagnosis of hypertension with at least two separate blood pressure readings on two or more visits spaced 1-2 weeks apart.
- Immediate diagnosis is made on a single visit if BP is >= 180/110 mmHg, or if the patient presents with hypertensive crisis (target organ damage like stroke, acute coronary syndrome, pulmonary edema, or aortic dissection).

3. Management Protocol
Step 1: Lifestyle Modifications (All Patients)
- Dietary Sodium: Restrict salt intake to less than 5g per day (approx. one teaspoon). Avoid processed and salty foods.
- DASH Diet: Emphasize intake of fresh fruits, vegetables, whole grains, low-fat dairy products, and reduce saturated fat intake.
- Physical Activity: At least 30 minutes of moderate-intensity aerobic exercise (e.g., brisk walking, jogging, cycling) 5 days per week.
- Weight Control: Maintain a healthy body weight. In India, target BMI is 18.5 to 22.9 kg/m², and waist circumference <90 cm for men and <80 cm for women.
- Cessation of Tobacco and Alcohol: Strongly advise quitting smoking/tobacco chewing and limiting alcohol intake.

Step 2: Pharmacological Treatment
- Initiation Criteria:
  * Stage 1 Hypertension: If BP remains >= 140/90 mmHg after 3 months of strict lifestyle modification, or start immediately if the patient has high cardiovascular risk, diabetes, coronary artery disease, or CKD.
  * Stage 2 Hypertension: Initiate lifestyle modifications and pharmacological therapy immediately.
- First-line Antihypertensive Drug Classes (Monotherapy):
  * Calcium Channel Blockers (CCBs): Amlodipine 2.5mg to 5mg once daily (maximum 10mg). Side effects include pedal edema.
  * Angiotensin Receptor Blockers (ARBs): Telmisartan 40mg once daily (range 40-80mg) or Losartan 50mg once daily.
  * Thiazide/Thiazide-like Diuretics: Chlorthalidone 12.5mg once daily or Hydrochlorothiazide 12.5mg once daily.
  * ACE Inhibitors (ACEis): Enalapril 5mg once daily (range 5-20mg). Side effect includes dry cough.

Step 3: Combination Therapy and Special Populations
- If BP is not controlled on monotherapy after 4 weeks, titrate to maximum dose or add a second drug from a different class (e.g., CCB + ARB).
- Compelling Indications:
  * Diabetes Mellitus or Chronic Kidney Disease (CKD): Start with an ARB (Telmisartan) or ACE Inhibitor (Enalapril) as first-line due to their nephroprotective properties (dilates efferent arteriole, reduces albuminuria). Contraindicated in pregnancy.
  * Coronary Artery Disease / Post-Myocardial Infarction: Beta-blockers (e.g., Metoprolol Succinate 25-50mg once daily) and ACE inhibitors/ARBs are first-line.
- Monitoring: Evaluate the patient every 2-4 weeks after drug initiation or dose titration. Once BP is controlled, check every 3 months. Check Serum Potassium and Serum Creatinine (to monitor eGFR) within 1-2 weeks of starting ACEi, ARB, or diuretics.

4. Patient Safety and Guidelines
- Patient Mode: Counsel on reducing salt, eating fruits/veg, exercising daily. Emphasize that hypertension is a silent killer and requires long-term compliance. Reject queries asking to stop medication when feeling fine. Refuse prescribing specific anti-hypertensives.
- Doctor Mode: Support medication selection. Detail compelling indications, drug-drug combinations (avoid ACEi + ARB combinations due to risk of hyperkalemia and acute renal injury), and safety monitoring protocols."""

PMJAY_PACKAGES_TEXT = """Title: Ayushman Bharat PM-JAY Health Benefit Packages Reference
Publisher: National Health Authority (NHA), Government of India
Scope: Administrative, specialty, and pricing rules for public health benefit packages in India.

1. Overview
The Pradhan Mantri Jan Arogya Yojana (PM-JAY) provides free health cover of up to INR 5 Lakhs per family per year for secondary and tertiary care hospitalization to over 12 crore poor and vulnerable families. Services are structured as predefined Health Benefit Packages (HBP).

2. Selected Standard Packages and Pricing (HBP 2.2 / HBP 2022)
- Specialty: Cardiology & Cardiothoracic Surgery
  * Package Code: MC001A, Name: Medical Management of Acute Myocardial Infarction (Conservative), Cost: INR 25,000, Pre-authorization: Required.
  * Package Code: SG002B, Name: Coronary Artery Bypass Grafting (CABG), Cost: INR 1,20,000, Pre-authorization: Required, Minimum Ward Stay: 7 days.
  * Package Code: SG003A, Name: Single Chamber Permanent Pacemaker Implantation, Cost: INR 45,000, Pre-authorization: Required.

- Specialty: Orthopaedics
  * Package Code: SG010A, Name: Total Knee Arthroplasty - Unilateral (Knee Replacement), Cost: INR 80,000, Pre-authorization: Required, Includes implant cost, surgical fee, and 10 days post-op ward stay.
  * Package Code: SG011A, Name: Surgical Management of Fracture Neck of Femur (Hemiarthroplasty), Cost: INR 35,000, Pre-authorization: Required.

- Specialty: General Medicine
  * Package Code: MC005A, Name: Management of Diabetic Ketoacidosis, Cost: INR 15,000, Pre-authorization: Not Required for first 24 hours of emergency admission, post-facto approval required.
  * Package Code: MC006A, Name: Management of Severe Dengue with Shock, Cost: INR 18,000, Pre-authorization: Not Required.

- Specialty: Ophthalmology
  * Package Code: SG020A, Name: Cataract Surgery with Foldable IOL (Unilateral), Cost: INR 7,500, Pre-authorization: Not Required, must be uploaded with pre-op and post-op slit lamp photos.

3. General Administrative and Pre-authorization Rules
- Pre-authorization: Required for most tertiary care procedures. Enrolled hospitals must submit diagnostic reports, clinical indications, and package selection via the TMS portal.
- Package Inclusions: Package cost is inclusive of admission charges, nursing charges, bed charges, surgeon/physician fees, anesthesia, implants, surgical consumables, medicines, food during hospital stay, and post-discharge medicines for 5 days.
- Double Package Rule: If two surgical procedures are performed during the same session, the highest-priced package is reimbursed at 100%, the second at 50%, and the third at 25%."""

def main():
    # Ensure sources directory exists
    SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    
    # Save the files
    (SOURCES_DIR / "nhsrc_osteoarthritis.txt").write_text(OSTEOARTHRITIS_TEXT.strip(), encoding="utf-8-sig")
    (SOURCES_DIR / "nhsrc_sinusitis.txt").write_text(SINUSITIS_TEXT.strip(), encoding="utf-8-sig")
    (SOURCES_DIR / "nhsrc_hypertension.txt").write_text(HYPERTENSION_TEXT.strip(), encoding="utf-8-sig")
    (SOURCES_DIR / "pmjay_packages.txt").write_text(PMJAY_PACKAGES_TEXT.strip(), encoding="utf-8-sig")
    
    print("Standard clinical guidelines and PM-JAY packages successfully written to apps/api/training/sources/")

if __name__ == "__main__":
    main()
