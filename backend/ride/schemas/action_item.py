from pydantic import BaseModel, Field


class ActionItemOutput(BaseModel):
    """Structured output for a single actionable business requirement derived from an obligation."""

    description: str = Field(
        description=(
            "Clear, actionable business requirement derived from this regulatory obligation. "
            "State what engineering work must be done, not just what the regulation says."
        )
    )


ACTION_ITEM_PROMPT = (
    "You are a regulatory compliance analyst at a fintech company. "
    "Given the following regulatory obligation and its verbatim source quote, "
    "generate a clear, actionable business action item. "
    "The action item must describe what engineering or business work needs to happen -- "
    "not merely restate the regulation. Be specific about what systems or processes "
    "need to change.\n\n"
    "Obligation: {obligation_text}\n\n"
    "Source Quote: {source_quote}\n\n"
    "Generate the action item description."
)
