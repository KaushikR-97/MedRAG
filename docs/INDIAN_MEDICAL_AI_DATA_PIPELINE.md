# Indian Medical AI Data Pipeline

This is the execution path for making the assistant more India-first and doctor-grade without training on unsafe or unlicensed data.

## Source Strategy

Use `data/source_registry/indian_medical_ai_sources.json` as the auditable source registry. It prioritizes:

- ICMR STWs for India-specific clinical workflows across common primary-care, emergency, chronic disease, paediatric, obstetric, infectious, and specialty topics.
- ICMR guidelines for antimicrobial stewardship, diabetes, cancer, lab practice, ethics, and AI-in-healthcare guardrails.
- ICMR-NIN dietary guidance for Indian food habits, lifestyle counselling, salt/fat/sugar, pregnancy/child/elder nutrition, and food safety.
- NCDC and IDSP for seasonal diseases, outbreak context, dengue/malaria/influenza/heat/rabies/snakebite public-health grounding.
- CDSCO for Indian drug-regulatory, banned-drug, prescribing-information, adverse-event, and fixed-dose-combination guardrails.
- PM-JAY, Janaushadhi, and data.gov.in only for availability, affordability, coverage, admin, and aggregate context, not treatment truth.

## Build The RAG Manifest

```bash
python scripts/build_indian_rag_manifest.py --validate-only
python scripts/build_indian_rag_manifest.py --include-p1
```

This writes `apps/api/training/indian_rag_source_manifest.json`.

## Ingest Approved Sources

```bash
cd apps/api
python training/ingest_rag_sources.py --manifest training/indian_rag_source_manifest.json --dry-run
python training/ingest_rag_sources.py --manifest training/indian_rag_source_manifest.json --dry-run --continue-on-error
python training/ingest_rag_sources.py --manifest training/indian_rag_source_manifest.json
```

Before production ingestion, replace broad index URLs with document-level PDF/page URLs where possible and store document title, publisher, publication date, retrieval date, license/access status, and clinical domain.
This is especially important for PDF-viewer pages such as NIN dietary guidelines, which can validate as reachable but return only viewer text unless the direct PDF URL is captured.
Use `--continue-on-error` during source QA because some Indian government portals intermittently time out; unresolved failures should be moved to a manual-download queue with the same metadata.

## Fine-Tuning Boundary

Do not fine-tune changing treatment facts, doses, outbreak facts, drug bans, or regulatory alerts into the base model. Use fine-tuning for:

- senior-doctor answer structure
- Indian clinical terminology
- patient vs doctor role boundaries
- citation discipline
- safe refusal for patient-prescribing requests
- missing-data and prescription-safety checklists
- synthetic doctor-patient interaction style

Synthetic interaction data should be generated from cited guideline excerpts, labelled as synthetic, and reviewed by clinicians before training.

## Quality Gates

Doctor answers should include:

- working diagnosis and severity
- important differentials
- missing patient details
- investigations
- India-relevant generic treatment options only when source-grounded
- contraindications and drug interactions
- pregnancy/lactation, renal, hepatic, allergy, comorbidity, current-medicine checks
- monitoring and follow-up
- urgent escalation criteria
- citations

Patient answers should include:

- plain-language explanation
- lifestyle and Indian food-habit advice when source-grounded
- questions to ask the doctor
- red flags and follow-up
- no personalized prescriptions, doses, or Schedule H self-medication advice

Seasonal/outbreak answers should include:

- location and date caveat
- source date
- testing or public-health reporting guidance when relevant
- urgent danger signs
- no unsupported claim that an outbreak exists locally
