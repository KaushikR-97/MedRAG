# MedRAG India Dataset Sourcing And Model Plan

This project should train and evaluate on licensed, de-identified, source-traceable
data only. Do not train on raw patient uploads, production chat logs, prescriptions,
or hospital records unless they have been formally de-identified, consented, and
approved for model development.

## Dataset Tiers

### Tier 1: Use First For RAG And Evaluation

These sources are best for near-term investor demos and closed pilots because they
are authoritative and can be cited or audited.

| Source | Use | India relevance | Launch note |
| --- | --- | --- | --- |
| MoHFW / NHSRC standard treatment workflows | RAG guideline corpus, doctor decision-support grounding, evaluation references | High | Prefer RAG ingestion over fine-tuning so updates remain auditable. Verify each document license before redistribution. |
| ICMR guidelines and consensus documents | RAG guideline corpus, patient education references, clinical eval references | High | Use excerpts with source metadata. Avoid implying ICMR endorsement. |
| National Health Portal disease education pages | Patient education corpus and plain-language response style | High | Good for patient-facing education and lifestyle guidance. |
| PM-JAY Health Benefit Packages | Coverage matching, hospital package support, benefit explanation | High | Use as structured reference data, not as clinical treatment truth. |
| ABDM / NHA consent and health data policy docs | Consent, privacy, audit workflow grounding | High | Use for app policy guidance and compliance explanations, not medical answers. |
| CDSCO / MDR 2017 public guidance | Regulatory positioning and warning labels | High | Required for SaMD/CDSS positioning review. |

### Tier 2: Indian Public Health And Operations Data

These sources improve matching, public-health dashboards, business analytics, and
hospital operations, but they are not enough for diagnosis or prescribing.

| Source | Use | India relevance | Launch note |
| --- | --- | --- | --- |
| data.gov.in health datasets | Public health dashboards, facility/epidemiology examples | High | Check dataset-level license and freshness before use. |
| HMIS / NHM public aggregate data | Population trends, district-level operational demos | High | Aggregate only; not patient-level training. |
| NFHS / DHS India | Demographic and risk-factor context | High | Useful for population statistics and patient education personalization. |
| Clinical Trials Registry - India | Trial awareness and evidence discovery | High | Do not use as treatment recommendation source without guideline/evidence review. |

### Tier 3: Imaging And Specialty Datasets

These can be used for feature demos and model evaluation, but licensing and clinical
scope must be reviewed carefully.

| Source | Use | India relevance | Launch note |
| --- | --- | --- | --- |
| IDRiD diabetic retinopathy dataset | Imaging pipeline demo/evaluation | High | Check challenge/data-use terms before commercial training. |
| MIMIC-IV / MIMIC-CXR | General clinical NLP and pipeline evaluation | Non-Indian but high quality | Requires credentialing and data-use agreement. Good for engineering validation, not India-specific launch claims. |
| MedQA / PubMedQA / MultiMedQA-style public benchmarks | Medical QA regression testing | Global | Use for evaluation only unless license allows training. |
| Synthea synthetic EHR | Workflow and consent testing | Synthetic, not Indian | Good for demos and tests; not clinical truth. |

## Recommended Training Strategy

1. Keep clinical facts in RAG.
   Fine-tuning should teach response format, role boundaries, Indian terminology,
   and citation discipline. It should not memorize treatment facts.

2. Build a source registry before ingestion.
   Every source must have: URL, publisher, retrieval date, license/access status,
   intended use, PHI status, and whether commercial use is allowed.

3. Produce three model datasets.
   - `rag_corpus`: chunked guideline/reference text with citation metadata.
   - `sft_style`: instruction examples teaching style and role behavior.
   - `eval_cases`: locked test questions with expected safety/quality criteria.

4. Separate patient and doctor behavior.
   - Patient: education, report explanation, lifestyle, red flags, clinician follow-up.
   - Doctor: clinician decision support, differentials, treatment options, dose-safety,
     contraindications, monitoring, and escalation.

5. Never train on unreviewed PHI.
   Patient-uploaded PDFs can be used for per-user RAG after consent, but not for
   model training unless de-identified and approved.

## Dataset Acquisition Backlog

| Priority | Task | Output |
| --- | --- | --- |
| P0 | Collect 20-50 official Indian guideline PDFs/pages across common primary-care, chronic disease, maternal-child health, infectious disease, and emergency topics | `data/source_registry/india_guidelines.json` |
| P0 | Collect PM-JAY package references and normalize package names, codes, specialties, eligibility notes | `data/source_registry/pmjay_packages.json` |
| P0 | Create 200 locked eval cases split by patient/doctor/admin/hospital role | `apps/api/training/clinical_quality_cases.jsonl` |
| P1 | Create 1,000-3,000 SFT style examples from source-grounded guideline excerpts | `apps/api/training/medrag_sft.jsonl` |
| P1 | Add 100 document-ingestion eval PDFs/images using synthetic or licensed samples | `data/eval_documents/` |
| P2 | Add imaging datasets only after license review | `data/source_registry/imaging_sources.json` |

## Launch Gate Targets

Investor demo can be considered ready when:
- 95% of core scripted flows pass on a fresh Lightning deployment.
- AI eval pass rate is at least 85% on locked demo cases.
- No patient answer contains medicine doses or personalized prescribing.
- No doctor answer exposes prompts, hidden context, or repeated gibberish.
- Document ingestion has visible job state and retry path.

Closed clinical pilot can be considered ready when:
- AI eval pass rate is at least 90% on clinician-reviewed cases.
- 100% of urgent/red-flag cases escalate.
- 100% of patient prescription requests stay educational.
- Audit, consent, access request, prescription, and document-view paths are logged.
- Backup, restore, monitoring, and incident response runbooks are tested.
