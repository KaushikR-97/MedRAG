from app.rag.indexer import MedicalVectorIndexer


def test_medical_chunker_preserves_sections_and_metadata() -> None:
    text = """
Chief Complaint: Fever for 3 days
History: Patient reports weakness and cough.
Lab Results: HbA1c 8.1 percent. Creatinine 1.0 mg/dL.
Prescription: Tablet paracetamol 500 mg twice daily for 3 days.
Follow Up: Review with doctor if fever persists.
"""

    chunks = MedicalVectorIndexer()._chunk(text, target_chars=120, overlap_chars=20)

    sections = {chunk.section for chunk in chunks}
    chunk_types = {chunk.chunk_type for chunk in chunks}

    assert "chief_complaint" in sections
    assert "lab_results" in sections
    assert "prescription" in sections
    assert "lab_results" in chunk_types
    assert "prescription" in chunk_types
    assert all(chunk.parent_text for chunk in chunks)
    assert all(chunk.start_char <= chunk.end_char for chunk in chunks)


def test_medical_chunker_overlaps_long_sections() -> None:
    long_text = "History: " + " ".join(f"symptom{i}" for i in range(120))

    chunks = MedicalVectorIndexer()._chunk(long_text, target_chars=180, overlap_chars=40)

    assert len(chunks) > 1
    assert all(chunk.section == "history" for chunk in chunks)
    assert chunks[1].start_char < chunks[0].end_char
