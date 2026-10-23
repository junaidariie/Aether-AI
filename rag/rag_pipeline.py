import os
import math
import logging
import uuid
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv
from sentence_transformers import CrossEncoder
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_community.retrievers import BM25Retriever
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter


load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

INDEX_NAME = "bot"


class RagPipeline:

    def __init__(
        self,
        index_name=INDEX_NAME,
        embedding_model="BAAI/bge-base-en-v1.5",
        reranker_model="cross-encoder/ms-marco-MiniLM-L-12-v2"
    ):
        api_key = os.getenv("PINECONE_API_KEY")

        if not api_key:
            raise ValueError("PINECONE_API_KEY not found in environment variables.")

        self.pc = Pinecone(api_key=api_key)
        self.index_name = index_name
        self.bm25_retriever = None
        self.cached_docs = []

        self._ensure_index()

        logger.info("Loading embedding model...")
        self.embeddings = HuggingFaceEmbeddings(model_name=embedding_model)
        logger.info("Embedding model loaded successfully.")

        logger.info(
            f"Loading CrossEncoder reranker model ({reranker_model})..."
        )
        self.cross_encoder = CrossEncoder(reranker_model)
        logger.info("CrossEncoder reranker loaded successfully.")

    def _ensure_index(self):
        try:
            existing_indexes = self.pc.list_indexes().names()

            if self.index_name not in existing_indexes:
                logger.info(f"Creating Pinecone index: {self.index_name}")

                self.pc.create_index(
                    name=self.index_name,
                    dimension=768,
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud="aws",
                        region="us-east-1"
                    )
                )

                logger.info("Pinecone index created successfully.")

            else:
                logger.info(
                    f"Pinecone index '{self.index_name}' already exists."
                )

        except Exception:
            logger.exception("Error ensuring index existence.")

    def _vector_store(self):
        return PineconeVectorStore(
            index=self.pc.Index(self.index_name),
            embedding=self.embeddings
        )

    def _load_docs(self, pdf_path: str):
        try:
            logger.info(f"Loading PDF: {pdf_path}")

            loader = PyPDFLoader(pdf_path)
            documents = loader.load()

            logger.info(f"Loaded {len(documents)} pages.")

            return documents

        except Exception as e:
            logger.exception("Error loading PDF.")
            raise e

    def _split_docs(self, docs, chunk_size=1000, chunk_overlap=250):
        try:
            logger.info("Splitting documents into chunks...")

            splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )

            split_documents = splitter.split_documents(docs)

            logger.info(f"Generated {len(split_documents)} chunks.")

            return split_documents

        except Exception:
            logger.exception("Error splitting documents.")
            return []

    def _add_docs(self, split_docs):
        try:
            logger.info("Uploading chunks to Pinecone...")

            vectorstore = self._vector_store()

            ids = [doc.metadata["vector_id"] for doc in split_docs]
            vectorstore.add_documents(split_docs, ids=ids)

            logger.info("Documents uploaded to Pinecone successfully.")

        except Exception:
            logger.exception("Error uploading documents.")
            raise

    def _create_bm25(self, split_docs=None, k=10):
        try:
            logger.info("Creating BM25 retriever...")

            docs = split_docs if split_docs is not None else self.cached_docs

            if not docs:
                logger.warning(
                    "No documents available to initialize BM25 retriever."
                )
                return

            self.bm25_retriever = BM25Retriever.from_documents(docs)

            self.bm25_retriever.k = k

            logger.info("BM25 retriever ready.")

        except Exception:
            logger.exception("Error creating BM25 retriever.")

    def _dense_retriever(self, owner_id: str, k=10):
        vectorstore = self._vector_store()

        return vectorstore.as_retriever(
            search_kwargs={"k": k, "filter": {"owner_id": owner_id}}
        )

    def _hybrid_retrieve(
        self,
        query: str,
        owner_id: str,
        dense_k=10,
        sparse_k=10,
        rrf_k=60,
        rrf_top_k=15
    ):
        try:

            # ==========================================
            # DENSE RETRIEVAL
            # ==========================================

            dense_docs = []

            try:
                dense_docs = self._dense_retriever(
                    owner_id=owner_id,
                    k=dense_k
                ).invoke(query)

                logger.info(
                    f"Dense retrieval returned {len(dense_docs)} documents."
                )

            except Exception:
                logger.warning(
                    "Dense retrieval failed or unavailable."
                )

            # ==========================================
            # BM25 RETRIEVAL
            # ==========================================

            bm25_docs = []

            owner_docs = [
                doc for doc in self.cached_docs
                if doc.metadata.get("owner_id") == owner_id
            ]
            owner_retriever = (
                BM25Retriever.from_documents(owner_docs)
                if owner_docs
                else None
            )

            if owner_retriever:

                try:
                    owner_retriever.k = sparse_k

                    bm25_docs = owner_retriever.invoke(query)

                    logger.info(
                        f"BM25 retrieval returned {len(bm25_docs)} documents."
                    )

                except Exception:
                    logger.warning(
                        "BM25 retrieval execution failed."
                    )

            # ==========================================
            # RECIPROCAL RANK FUSION
            # ==========================================

            rrf_scores = {}
            document_map = {}
            retrieval_sources = {}
            retrieval_ranks = {}

            # ------------------------------------------
            # Dense ranking contribution
            # ------------------------------------------

            for rank, doc in enumerate(dense_docs, start=1):

                doc_text = doc.page_content.strip()

                if doc_text not in document_map:
                    document_map[doc_text] = doc

                if doc_text not in rrf_scores:
                    rrf_scores[doc_text] = 0.0

                if doc_text not in retrieval_sources:
                    retrieval_sources[doc_text] = []

                if doc_text not in retrieval_ranks:
                    retrieval_ranks[doc_text] = {}

                rrf_scores[doc_text] += 1 / (rrf_k + rank)

                if "dense" not in retrieval_sources[doc_text]:
                    retrieval_sources[doc_text].append("dense")

                retrieval_ranks[doc_text]["dense"] = rank

            # ------------------------------------------
            # BM25 ranking contribution
            # ------------------------------------------

            for rank, doc in enumerate(bm25_docs, start=1):

                doc_text = doc.page_content.strip()

                if doc_text not in document_map:
                    document_map[doc_text] = doc

                if doc_text not in rrf_scores:
                    rrf_scores[doc_text] = 0.0

                if doc_text not in retrieval_sources:
                    retrieval_sources[doc_text] = []

                if doc_text not in retrieval_ranks:
                    retrieval_ranks[doc_text] = {}

                rrf_scores[doc_text] += 1 / (rrf_k + rank)

                if "bm25" not in retrieval_sources[doc_text]:
                    retrieval_sources[doc_text].append("bm25")

                retrieval_ranks[doc_text]["bm25"] = rank

            # ------------------------------------------
            # Sort documents using RRF score
            # ------------------------------------------

            ranked_documents = sorted(
                rrf_scores.items(),
                key=lambda x: x[1],
                reverse=True
            )

            fused_docs = []

            for doc_text, rrf_score in ranked_documents[:rrf_top_k]:

                doc = document_map[doc_text]

                doc.metadata["rrf_score"] = round(
                    float(rrf_score),
                    6
                )

                doc.metadata["retrieval_sources"] = retrieval_sources[
                    doc_text
                ]

                doc.metadata["dense_rank"] = retrieval_ranks[
                    doc_text
                ].get("dense")

                doc.metadata["bm25_rank"] = retrieval_ranks[
                    doc_text
                ].get("bm25")

                fused_docs.append(doc)

            logger.info(
                f"RRF fusion produced {len(fused_docs)} candidates."
            )

            return fused_docs

        except Exception:
            logger.exception(
                "Error during internal hybrid retrieval layer."
            )

            return []

    def _rerank(self, query: str, docs: list, top_k=7):

        if not docs:
            return []

        try:

            logger.info(
                f"Reranking {len(docs)} documents using CrossEncoder..."
            )

            pairs = [
                (query, doc.page_content)
                for doc in docs
            ]

            scores = self.cross_encoder.predict(pairs)

            ranked_docs = []

            for score, doc in zip(scores, docs):

                # Sigmoid transformation only maps the score
                # into a 0-1 range. It is NOT a calibrated probability.

                if score >= 0:
                    rerank_score = float(
                        1 / (1 + math.exp(-score))
                    )
                else:
                    exp_score = math.exp(score)

                    rerank_score = float(
                        exp_score / (1 + exp_score)
                    )

                # ------------------------------------------
                # Store reranking metadata
                # ------------------------------------------

                doc.metadata["rerank_score"] = round(
                    rerank_score,
                    4
                )

                doc.metadata["rerank_raw_score"] = round(
                    float(score),
                    6
                )

                ranked_docs.append(
                    (rerank_score, doc)
                )

            # Sort by descending reranker score

            ranked_docs.sort(
                key=lambda x: x[0],
                reverse=True
            )

            logger.info(
                f"CrossEncoder reranking completed. "
                f"Returning top {top_k} documents."
            )

            return [
                doc
                for _, doc in ranked_docs[:top_k]
            ]

        except Exception:
            logger.exception(
                "Error occurred during CrossEncoder reranking phase."
            )

            return docs[:top_k]

    # ==========================================
    # PUBLIC INTERFACES
    # ==========================================

    def ingest_pdf(
        self,
        pdf_path: str,
        chunk_size=1000,
        chunk_overlap=250,
        filename: str | None = None,
        document_id: str | None = None,
        *,
        owner_id: str,
    ) -> dict:
        """Load, split, and index a PDF."""

        try:
            logger.info("Starting ingestion for: %s", pdf_path)

            raw_docs = self._load_docs(pdf_path)

            if not raw_docs:
                return {
                    "success": False,
                    "message": "No readable pages were found in the PDF.",
                    "chunks": 0,
                }

            document_id = document_id or str(uuid.uuid4())
            display_name = filename or os.path.basename(pdf_path)
            for page_number, doc in enumerate(raw_docs):
                doc.metadata["source"] = display_name
                doc.metadata["filename"] = display_name
                doc.metadata["document_id"] = document_id
                doc.metadata["owner_id"] = owner_id
                doc.metadata["page"] = doc.metadata.get("page", page_number)

            split_chunks = self._split_docs(
                raw_docs,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            )

            if not split_chunks:
                return {
                    "success": False,
                    "message": "No document chunks were generated.",
                    "chunks": 0,
                }

            for chunk_number, doc in enumerate(split_chunks):
                doc.metadata["vector_id"] = f"{document_id}-{chunk_number}"

            self._add_docs(split_chunks)

            self.cached_docs.extend(split_chunks)
            self._create_bm25(self.cached_docs)

            if self.bm25_retriever is None:
                logger.warning("BM25 retriever was not initialized.")

            logger.info("Ingestion completed for: %s", pdf_path)

            return {
                "success": True,
                "message": "PDF ingestion completed.",
                "document_id": document_id,
                "filename": display_name,
                "pages": len(raw_docs),
                "chunks": len(split_chunks),
            }

        except Exception as exc:
            logger.exception("Failed to ingest PDF: %s", pdf_path)

            return {
                "success": False,
                "message": f"PDF ingestion failed: {exc}",
                "chunks": 0,
            }

    def list_documents(self, owner_id: str) -> list[dict]:
        """Return unique uploaded documents and their indexed chunk counts."""
        index = self.pc.Index(self.index_name)
        documents = {}

        for id_batch in index.list():
            for offset in range(0, len(id_batch), 1000):
                response = index.fetch(ids=id_batch[offset:offset + 1000])
                for vector in response.vectors.values():
                    metadata = vector.metadata or {}
                    if metadata.get("owner_id") != owner_id:
                        continue
                    source = str(metadata.get("source") or metadata.get("filename") or "Unknown document")
                    document_id = metadata.get("document_id")
                    if not document_id:
                        continue
                    key = str(document_id)
                    filename = str(metadata.get("filename") or source)

                    item = documents.setdefault(key, {
                        "id": key,
                        "filename": filename,
                        "chunks": 0,
                        "pages": set(),
                    })
                    item["chunks"] += 1
                    page = metadata.get("page")
                    if page is not None:
                        item["pages"].add(str(page))

        return sorted(
            [
                {
                    **item,
                    "pages": len(item["pages"]),
                }
                for item in documents.values()
            ],
            key=lambda item: item["filename"].casefold(),
        )

    def delete_document(self, document_id: str, owner_id: str) -> None:
        """Delete one indexed document without affecting other uploads."""
        metadata_filter = {
            "document_id": document_id,
            "owner_id": owner_id,
        }

        self.pc.Index(self.index_name).delete(filter=metadata_filter)
        self.cached_docs = [
            doc for doc in self.cached_docs
            if not (
                doc.metadata.get("document_id") == document_id
                and doc.metadata.get("owner_id") == owner_id
            )
        ]
        self.bm25_retriever = None
        if self.cached_docs:
            self._create_bm25(self.cached_docs)

    def delete_documents(self, owner_id: str):
        """Delete documents belonging to one owner from the index and local caches."""
        self.pc.Index(self.index_name).delete(filter={"owner_id": owner_id})
        self.cached_docs = [
            doc for doc in self.cached_docs
            if doc.metadata.get("owner_id") != owner_id
        ]
        self.bm25_retriever = None
        if self.cached_docs:
            self._create_bm25(self.cached_docs)

    def retrieve(
        self,
        query: str,
        owner_id: str,
        dense_k=10,
        sparse_k=10,
        rrf_k=60,
        rrf_top_k=15,
        top_k=7
    ) -> dict:
        """Executes full search stack and formats context with high-fidelity score mapping."""

        try:

            logger.info(
                f"Processing retrieval query: '{query}'"
            )

            # ==========================================
            # DENSE + BM25 + RRF FUSION
            # ==========================================

            candidate_docs = self._hybrid_retrieve(
                query=query,
                owner_id=owner_id,
                dense_k=dense_k,
                sparse_k=sparse_k,
                rrf_k=rrf_k,
                rrf_top_k=rrf_top_k
            )

            if not candidate_docs:
                return {
                    "success": True,
                    "has_documents": False,
                    "query": query,
                    "context": "",
                    "sources": [],
                    "documents": [],
                    "count": 0,
                }

            # ==========================================
            # CROSS-ENCODER RERANKING
            # ==========================================

            final_docs = self._rerank(
                query,
                candidate_docs,
                top_k=top_k
            )

            # ==========================================
            # CONSTRUCT CONTEXT
            # ==========================================

            context = "\n\n".join(
                [
                    doc.page_content
                    for doc in final_docs
                ]
            )

            # ==========================================
            # EXTRACT SOURCE METADATA
            # ==========================================

            sources = [
                {
                    "source": doc.metadata.get(
                        "source",
                        "Unknown"
                    ),

                    "page": doc.metadata.get(
                        "page",
                        0
                    ) + 1,

                    "rrf_score": doc.metadata.get(
                        "rrf_score",
                        0.0
                    ),

                    "rerank_score": doc.metadata.get(
                        "rerank_score",
                        0.0
                    ),

                    "retrieval_sources": doc.metadata.get(
                        "retrieval_sources",
                        []
                    ),

                    "dense_rank": doc.metadata.get(
                        "dense_rank",
                        None
                    ),

                    "bm25_rank": doc.metadata.get(
                        "bm25_rank",
                        None
                    )
                }

                for doc in final_docs
            ]

            return {
                "success": True,
                "has_documents": bool(final_docs),
                "query": query,
                "context": context,
                "sources": sources,
                "documents": final_docs,
                "count": len(final_docs)
            }

        except Exception:
            logger.exception(
                "Error triggered inside main retrieval execution channel."
            )

            return {
                "success": False,
                "has_documents": False,
                "query": query,
                "context": "",
                "sources": [],
                "documents": [],
                "count": 0
            }