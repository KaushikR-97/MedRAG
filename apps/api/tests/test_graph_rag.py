import pytest
from app.rag.retriever import GraphMedicalRetriever, HybridMedicalRetriever

def test_graph_medical_retriever_relations() -> None:
    retriever = GraphMedicalRetriever()
    
    # Test diabetes matching
    diab_chunks = retriever.retrieve_relations("patient has type 2 diabetes mellitus")
    assert len(diab_chunks) == 1
    assert "SNOMED-44054006" in diab_chunks[0].text
    assert "Metformin" in diab_chunks[0].text
    
    # Test gout matching
    gout_chunks = retriever.retrieve_relations("explain gout and uric acid")
    assert len(gout_chunks) == 1
    assert "SNOMED-90560007" in gout_chunks[0].text
    assert "Allopurinol" in gout_chunks[0].text

    # Test no match
    none_chunks = retriever.retrieve_relations("some random query about fever")
    assert len(none_chunks) == 0

def test_hybrid_medical_retriever_graph_injection() -> None:
    # Instantiate with None to skip actual Qdrant connection in unit test,
    # ensuring it runs offline and tests the fallback retrieval flow.
    retriever = HybridMedicalRetriever(qdrant=None, embedder=None, reranker=None)
    
    # When we search, the Graph RAG relations should be injected at the top
    results = retriever.retrieve_many(
        queries=["What is the relation between diabetes and metformin?"],
        patient_id="test-patient-id"
    )
    
    # The output should contain the SNOMED diabetes concept chunk
    assert len(results) >= 1
    assert results[0].id == "snomed-44054006-diab"
    assert "SNOMED-44054006" in results[0].text
