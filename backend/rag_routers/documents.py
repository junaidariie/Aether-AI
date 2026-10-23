import os
import tempfile
import logging
import uuid
from uuid import UUID

from fastapi import APIRouter, UploadFile, File, Header, HTTPException
from pydantic import BaseModel, Field

from agents_workflow.tools import get_rag_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/knowledge-base",
    tags=["Knowledge Base"],
)

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB per PDF


# --------------------------------------------------
# REQUEST SCHEMAS
# --------------------------------------------------

class SearchRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=1,
        max_length=2000,
    )


# --------------------------------------------------
# 1. UPLOAD AND INDEX PDF DOCUMENTS
# --------------------------------------------------

@router.post("/upload")
def upload_documents(
    files: list[UploadFile] = File(...),
    user_id: UUID = Header(alias="X-Knowledge-Base-User"),
):
    """
    Upload one or more PDFs and index their contents.
    """

    if not files:
        raise HTTPException(
            status_code=400,
            detail="Upload at least one PDF.",
        )

    # Validate filenames before processing any files.
    for file in files:
        if (
            not file.filename
            or not file.filename.lower().endswith(".pdf")
        ):
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are supported.",
            )

    results = []

    try:
        rag = get_rag_pipeline()

        with tempfile.TemporaryDirectory() as temp_dir:

            for index, uploaded_file in enumerate(files):
                safe_filename = os.path.basename(uploaded_file.filename)
                pdf_path = os.path.join(
                    temp_dir,
                    f"{index}_{safe_filename}",
                )

                try:
                    # Save the upload while enforcing a size limit.
                    total_size = 0

                    with open(pdf_path, "wb") as destination:
                        while True:
                            chunk = uploaded_file.file.read(1024 * 1024)

                            if not chunk:
                                break

                            total_size += len(chunk)

                            if total_size > MAX_FILE_SIZE:
                                raise HTTPException(
                                    status_code=413,
                                    detail=(
                                        f"{safe_filename} exceeds the "
                                        "20 MB file size limit."
                                    ),
                                )

                            destination.write(chunk)

                    if total_size == 0:
                        results.append({
                            "filename": safe_filename,
                            "success": False,
                            "message": "The uploaded file is empty.",
                            "chunks": 0,
                        })
                        continue

                    # Index the PDF using your existing pipeline.
                    document_id = str(uuid.uuid4())
                    result = rag.ingest_pdf(
                        pdf_path,
                        filename=safe_filename,
                        document_id=document_id,
                        owner_id=str(user_id),
                    )

                    results.append({
                        "filename": safe_filename,
                        **result,
                    })

                except HTTPException:
                    raise

                except Exception as exc:
                    logger.exception(
                        "Failed to process PDF %s",
                        safe_filename,
                    )

                    results.append({
                        "filename": safe_filename,
                        "success": False,
                        "message": "PDF processing failed.",
                        "chunks": 0,
                    })

                finally:
                    uploaded_file.file.close()

        failed = [
            item for item in results
            if not item.get("success", False)
        ]

        return {
            "success": len(failed) == 0,
            "message": (
                "All PDFs were indexed successfully."
                if not failed
                else "Some PDFs could not be indexed."
            ),
            "results": results,
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("Knowledge-base upload failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not initialize or access the knowledge base.",
        ) from exc


# --------------------------------------------------
# 2. GET KNOWLEDGE-BASE STATUS
# --------------------------------------------------

@router.get("/documents")
def list_documents(
    user_id: UUID = Header(alias="X-Knowledge-Base-User"),
):
    """Return each indexed PDF so the frontend can manage individual uploads."""
    try:
        rag = get_rag_pipeline()
        return {
            "success": True,
            "documents": rag.list_documents(str(user_id)),
        }
    except Exception as exc:
        logger.exception("Failed to list knowledge-base documents.")
        raise HTTPException(
            status_code=500,
            detail="Could not list knowledge-base documents.",
        ) from exc


@router.get("/status")
def knowledge_base_status(
    user_id: UUID = Header(alias="X-Knowledge-Base-User"),
):
    """
    Check whether this browser profile has indexed PDFs.
    """

    try:
        rag = get_rag_pipeline()
        has_documents = bool(rag.list_documents(str(user_id)))

        return {
            "success": True,
            "has_documents": has_documents,
            "index_name": rag.index_name,
        }

    except Exception as exc:
        logger.exception("Failed to retrieve knowledge-base status.")

        raise HTTPException(
            status_code=500,
            detail="Could not retrieve knowledge-base status.",
        ) from exc


# --------------------------------------------------
# 3. SEARCH THE KNOWLEDGE BASE
# --------------------------------------------------

@router.post("/search")
def search_documents(
    request: SearchRequest,
    user_id: UUID = Header(alias="X-Knowledge-Base-User"),
):
    """
    Test hybrid retrieval and reranking without using the chat agent.
    """

    query = request.query.strip()

    if not query:
        raise HTTPException(
            status_code=400,
            detail="Query cannot be empty.",
        )

    try:
        rag = get_rag_pipeline()
        result = rag.retrieve(query, owner_id=str(user_id))

        # Return the useful fields instead of serializing Document objects.
        return {
            "success": result.get("success", False),
            "has_documents": result.get("has_documents", False),
            "query": result.get("query", query),
            "context": result.get("context", ""),
            "sources": result.get("sources", []),
            "count": result.get("count", 0),
            "reason": result.get("reason"),
        }

    except Exception as exc:
        logger.exception("Knowledge-base search failed.")

        raise HTTPException(
            status_code=500,
            detail="Knowledge-base search failed.",
        ) from exc


# --------------------------------------------------
# 4. DELETE ALL KNOWLEDGE-BASE DOCUMENTS
# --------------------------------------------------

@router.delete("/documents/{document_id}")
def delete_document(
    document_id: str,
    user_id: UUID = Header(alias="X-Knowledge-Base-User"),
):
    """Delete one PDF and its indexed chunks."""
    if not document_id.strip():
        raise HTTPException(status_code=400, detail="Document ID cannot be empty.")

    try:
        rag = get_rag_pipeline()
        rag.delete_document(document_id, owner_id=str(user_id))
        return {
            "success": True,
            "message": "The document was removed from the knowledge base.",
        }
    except Exception as exc:
        logger.exception("Failed to delete knowledge-base document %s.", document_id)
        raise HTTPException(
            status_code=500,
            detail="Could not delete the selected document.",
        ) from exc


@router.delete("/documents")
def delete_all_documents(
    user_id: UUID = Header(alias="X-Knowledge-Base-User"),
):
    """
    Delete every vector belonging to the current browser profile.

    This is scoped to the current browser profile's owner ID.
    """

    try:
        rag = get_rag_pipeline()

        # This clears the entire configured index, not just one PDF.
        rag.delete_documents(owner_id=str(user_id))

        # Verify that this owner's vectors are gone, without inspecting others.
        has_documents = bool(rag.list_documents(str(user_id)))

        if has_documents:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Some documents remain after the delete operation."
                ),
            )

        return {
            "success": True,
            "message": "All documents were deleted from the knowledge base.",
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("Failed to delete knowledge-base documents.")

        raise HTTPException(
            status_code=500,
            detail="Could not delete knowledge-base documents.",
        ) from exc