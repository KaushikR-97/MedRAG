from dataclasses import dataclass

from qdrant_client import QdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchAny, MatchValue
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder, SentenceTransformer

from app.core.config import settings


@dataclass(frozen=True)
class RetrievedChunk:
    id: str
    title: str
    score: float
    text: str


class HybridMedicalRetriever:
    def __init__(
        self,
        *,
        qdrant: QdrantClient | None = None,
        embedder: SentenceTransformer | None = None,
        reranker: CrossEncoder | None = None,
    ) -> None:
        self.qdrant = qdrant or self._build_qdrant()
        self.embedder = embedder or self._build_embedder()
        self.reranker = reranker or self._build_reranker()

    def _build_qdrant(self) -> QdrantClient | None:
        if not settings.qdrant_url:
            return None
        return QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)

    def _build_embedder(self) -> SentenceTransformer | None:
        if not settings.qdrant_url:
            return None
        # BGE-M3 is the default text embedding model. It gives the RAG layer a
        # stronger multilingual baseline for Indian medical records while the
        # existing BM25 path preserves exact-match recall for drugs and labs.
        return SentenceTransformer(settings.embedding_model)

    def _build_reranker(self) -> CrossEncoder | None:
        if not settings.qdrant_url or not settings.reranker_model:
            return None
        try:
            return CrossEncoder(settings.reranker_model)
        except Exception:
            return None

    def retrieve(
        self,
        query: str,
        *,
        patient_id: str | None,
        top_k: int = 5,
        language: str = "en",
        source_types: list[str] | None = None,
    ) -> list[RetrievedChunk]:
        if not query.strip():
            return []
        dense = self._dense_search(
            query,
            patient_id=patient_id,
            language=language,
            source_types=source_types or ["guideline", "verified_patient_document"],
            top_k=top_k * 2,
        )
        sparse = self._bm25_search(query, dense, top_k=top_k * 2)
        fused = self._rrf([dense, sparse])
        return self._rerank(query, fused)[:top_k]

class GraphMedicalRetriever:
    """Graph-based UMLS/SNOMED-CT clinical relation maps simulator."""
    def retrieve_relations(self, query: str) -> list[RetrievedChunk]:
        text = query.lower()
        chunks = []
        
        # 1. Metformin / Diabetes relation
        if "diabetes" in text or "metformin" in text:
            chunks.append(
                RetrievedChunk(
                    id="snomed-44054006-diab",
                    title="SNOMED-CT Concept relation: Diabetes Mellitus",
                    score=1.0,
                    text=(
                        "UMLS Concept Map details:\n"
                        "- [SNOMED-44054006] Type 2 Diabetes Mellitus -> TreatedBy -> [RxNorm-86509] Metformin HCl.\n"
                        "- Contraindications: Renal impairment (e.g. eGFR < 30 mL/min/1.73m2), acute metabolic acidosis.\n"
                        "- Traditional Herb cautions: Co-administering Metformin with hypoglycemic herbs like Neem or Bitter Melon increases risk of additive hypoglycemia."
                    )
                )
            )
            
        # 2. Gout / Uric Acid / Zyloric relation
        if any(kw in text for kw in ["gout", "uric acid", "zyloric", "allopurinol"]):
            chunks.append(
                RetrievedChunk(
                    id="snomed-90560007-gout",
                    title="SNOMED-CT Concept relation: Gouty Arthritis",
                    score=1.0,
                    text=(
                        "UMLS Concept Map details:\n"
                        "- [SNOMED-90560007] Gout -> Pathophysiology -> Elevated Serum Uric Acid (Hyperuricemia).\n"
                        "- Treatment: Allopurinol (Zyloric 100) works as a Xanthine Oxidase Inhibitor to reduce uric acid synthesis.\n"
                        "- Traditional Herb Cautions: Ayurvedic herbs like Turmeric (Curcumin) can assist with anti-inflammatory support in gout, but do not replace xanthine oxidase inhibitors for lowering uric acid levels."
                    )
                )
            )
            
        # 3. Dengue relation
        if "dengue" in text:
            chunks.append(
                RetrievedChunk(
                    id="snomed-38362002-dengue",
                    title="SNOMED-CT Concept relation: Dengue Virus Disease",
                    score=1.0,
                    text=(
                        "UMLS Concept Map details:\n"
                        "- [SNOMED-38362002] Dengue -> Pathology -> Severe thrombocytopenia (Platelets < 100,000 cells/mcL).\n"
                        "- Contraindications: NSAIDs (Aspirin, Ibuprofen) are contraindicated in Dengue due to increased hemorrhage risk. Acetaminophen (Paracetamol) is the preferred analgesic.\n"
                        "- Traditional Herb cautions: Carica Papaya leaf extract has been used traditionally to support platelet count, but requires close clinical monitoring."
                    )
                )
            )
            
        return chunks


class HybridMedicalRetriever:
    def __init__(
        self,
        *,
        qdrant: QdrantClient | None = None,
        embedder: SentenceTransformer | None = None,
        reranker: CrossEncoder | None = None,
    ) -> None:
        self.qdrant = qdrant or self._build_qdrant()
        self.embedder = embedder or self._build_embedder()
        self.reranker = reranker or self._build_reranker()

    def _build_qdrant(self) -> QdrantClient | None:
        if not settings.qdrant_url:
            return None
        return QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)

    def _build_embedder(self) -> SentenceTransformer | None:
        if not settings.qdrant_url:
            return None
        return SentenceTransformer(settings.embedding_model)

    def _build_reranker(self) -> CrossEncoder | None:
        if not settings.qdrant_url or not settings.reranker_model:
            return None
        try:
            return CrossEncoder(settings.reranker_model)
        except Exception:
            return None

    def retrieve(
        self,
        query: str,
        *,
        patient_id: str | None,
        top_k: int = 5,
        language: str = "en",
        source_types: list[str] | None = None,
    ) -> list[RetrievedChunk]:
        if not query.strip():
            return []
        dense = self._dense_search(
            query,
            patient_id=patient_id,
            language=language,
            source_types=source_types or ["guideline", "verified_patient_document"],
            top_k=top_k * 2,
        )
        sparse = self._bm25_search(query, dense, top_k=top_k * 2)
        fused = self._rrf([dense, sparse])
        return self._rerank(query, fused)[:top_k]

    def retrieve_many(
        self,
        queries: list[str],
        *,
        patient_id: str | None,
        top_k: int = 5,
        language: str = "en",
        source_types: list[str] | None = None,
    ) -> list[RetrievedChunk]:
        rankings = [
            self.retrieve(
                query,
                patient_id=patient_id,
                top_k=top_k,
                language=language,
                source_types=source_types,
            )
            for query in queries
            if query.strip()
        ]
        fused = self._rrf(rankings)
        
        # Inject Graph RAG SNOMED-CT concepts
        graph_retriever = GraphMedicalRetriever()
        graph_chunks = []
        for q in queries:
            graph_chunks.extend(graph_retriever.retrieve_relations(q))
            
        seen = set()
        unique_graph_chunks = []
        for gc in graph_chunks:
            if gc.id not in seen:
                seen.add(gc.id)
                unique_graph_chunks.append(gc)
                
        final_results = unique_graph_chunks + fused
        return final_results[:top_k]

    def _dense_search(
        self,
        query: str,
        *,
        patient_id: str | None,
        language: str,
        source_types: list[str],
        top_k: int,
    ) -> list[RetrievedChunk]:
        if self.qdrant is None or self.embedder is None:
            db_chunks = []
            if patient_id:
                try:
                    from app.db.session import SessionLocal
                    from app.models.document import MedicalDocument
                    with SessionLocal() as db:
                        docs = db.query(MedicalDocument).filter(
                            MedicalDocument.patient_id == patient_id,
                            MedicalDocument.verified_text != ""
                        ).all()
                        for doc in docs:
                            db_chunks.append(
                                RetrievedChunk(
                                    id=doc.id,
                                    title=doc.original_filename,
                                    score=0.95,
                                    text=doc.verified_text,
                                )
                            )
                except Exception:
                    pass
            return self._fallback_chunks(query) + db_chunks

        query_vector = self.embedder.encode(query).tolist()
        must = [
            FieldCondition(key="language", match=MatchValue(value=language)),
            FieldCondition(key="source_type", match=MatchAny(any=source_types)),
        ]
        if patient_id:
            must.append(
                FieldCondition(
                    key="visibility",
                    match=MatchAny(any=["public", f"patient:{patient_id}"]),
                )
            )
        qfilter = Filter(must=must)
        try:
            hits = self._query_qdrant(query_vector=query_vector, qfilter=qfilter, top_k=top_k)
        except Exception:
            return self._fallback_chunks(query)
        return [
            RetrievedChunk(
                id=str(hit.id),
                title=str((hit.payload or {}).get("title", "Untitled source")),
                score=float(hit.score or 0),
                text=str((hit.payload or {}).get("parent_text") or (hit.payload or {}).get("text", "")),
            )
            for hit in hits
        ]

    def _query_qdrant(self, *, query_vector: list[float], qfilter: Filter, top_k: int):
        if hasattr(self.qdrant, "query_points"):
            response = self.qdrant.query_points(
                collection_name=settings.qdrant_collection,
                query=query_vector,
                query_filter=qfilter,
                limit=top_k,
                with_payload=True,
            )
            return response.points
        return self.qdrant.search(
            collection_name=settings.qdrant_collection,
            query_vector=query_vector,
            query_filter=qfilter,
            limit=top_k,
            with_payload=True,
        )

    def _bm25_search(self, query: str, candidates: list[RetrievedChunk], *, top_k: int) -> list[RetrievedChunk]:
        if not candidates:
            return []
        tokenized = [candidate.text.lower().split() for candidate in candidates]
        bm25 = BM25Okapi(tokenized)
        scores = bm25.get_scores(query.lower().split())
        ranked = sorted(zip(candidates, scores, strict=False), key=lambda item: item[1], reverse=True)
        return [
            RetrievedChunk(
                id=chunk.id,
                title=chunk.title,
                score=float(score),
                text=chunk.text,
            )
            for chunk, score in ranked[:top_k]
        ]

    def _rrf(self, lists: list[list[RetrievedChunk]], k: int = 60) -> list[RetrievedChunk]:
        scores: dict[str, float] = {}
        chunks: dict[str, RetrievedChunk] = {}
        for ranking in lists:
            for rank, chunk in enumerate(ranking, start=1):
                chunks[chunk.id] = chunk
                scores[chunk.id] = scores.get(chunk.id, 0.0) + 1.0 / (k + rank)
        return [
            RetrievedChunk(id=chunks[cid].id, title=chunks[cid].title, score=score, text=chunks[cid].text)
            for cid, score in sorted(scores.items(), key=lambda item: item[1], reverse=True)
        ]

    def _rerank(self, query: str, candidates: list[RetrievedChunk]) -> list[RetrievedChunk]:
        if self.reranker is None or not candidates:
            return candidates
        pairs = [(query, candidate.text) for candidate in candidates]
        scores = self.reranker.predict(pairs)
        return [
            RetrievedChunk(id=chunk.id, title=chunk.title, score=float(score), text=chunk.text)
            for chunk, score in sorted(zip(candidates, scores, strict=False), key=lambda item: item[1], reverse=True)
        ]

    def _fallback_chunks(self, query: str) -> list[RetrievedChunk]:
        return [
            RetrievedChunk(
                id="safety-baseline",
                title="Clinical safety baseline",
                score=0.82,
                text=(
                    "Use retrieved clinical guidelines and verified patient documents. "
                    "If symptoms suggest an emergency, recommend urgent care instead of self-care. "
                    f"Original query: {query}"
                ),
            )
        ]
