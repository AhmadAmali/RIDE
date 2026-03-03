from pydantic import BaseModel, Field


class ObligationItem(BaseModel):
    """A single compliance obligation extracted from a regulatory document."""

    text: str = Field(description="Clear summary of the obligation in your own words")
    source_quote: str = Field(
        description="Verbatim text from the document that establishes this obligation"
    )
    reasoning: str = Field(
        description="2-3 sentences explaining WHY this text creates a compliance requirement"
    )
    is_ambiguous: bool = Field(
        description="True if language could be interpreted multiple ways or has unclear scope"
    )


class ObligationList(BaseModel):
    """List of obligations extracted from a document chunk."""

    obligations: list[ObligationItem]


EXTRACTION_PROMPT = (  # noqa: E501
    "You are a compliance analyst reviewing a regulatory document.\n\n"
    "Analyze the following excerpt and identify all compliance obligations"
    " -- requirements, prohibitions, or duties that an organization must fulfill.\n\n"
    "For each obligation you identify:\n"
    "1. Write a clear summary in your own words (text field)\n"
    "2. Copy the EXACT verbatim text from the document that establishes this obligation"
    " (source_quote field). The quote must appear word-for-word in the excerpt below.\n"
    "3. Explain in 2-3 sentences WHY this text creates a compliance requirement"
    " -- what regulatory principle it enforces and what the consequence of"
    ' non-compliance would be (reasoning field).'  # noqa: E501
    ' Be substantive: do not just say "this is an obligation."\n'
    "4. Set is_ambiguous to true if the language could be interpreted multiple ways,"
    " has unclear scope, or requires human judgment to apply correctly (is_ambiguous field)\n\n"
    "Only include genuine obligations."
    " Informational statements, definitions, and recitals are NOT obligations.\n\n"
    "If no obligations are found in this excerpt, return an empty obligations list.\n\n"
    "Document excerpt:\n---\n{chunk}\n---"
)


def chunk_markdown(markdown: str, chunk_chars: int = 16000, overlap_chars: int = 1600) -> list[str]:
    """Split Markdown into overlapping character windows.

    16,000 chars ~ 4,000 tokens. 10% overlap prevents splitting obligations at boundaries.
    Returns at least one chunk even for short documents.
    """
    if len(markdown) <= chunk_chars:
        return [markdown]
    chunks = []
    start = 0
    while start < len(markdown):
        end = start + chunk_chars
        chunks.append(markdown[start:end])
        start += chunk_chars - overlap_chars
    return chunks
