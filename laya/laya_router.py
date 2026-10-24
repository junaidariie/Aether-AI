from agents_workflow.models import select_model
from laya import Router


print("Loading Laya router (one-time)...")
router = Router(preload=True)
print("Router ready.\n")


QUESTIONS = {
    "task_complexity": {
        "type": "choice",

        "instructions": """
Determine whether the user's request is SIMPLE or COMPLEX.

Choose SIMPLE when the request can be answered reliably with direct,
straightforward reasoning and does not require substantial planning,
multi-step reasoning, deep analysis, or sophisticated code generation.

Choose COMPLEX when the request requires significant reasoning,
multi-step problem solving, detailed analysis, difficult coding,
debugging, architecture design, research and synthesis, mathematical
reasoning, planning, comparing multiple alternatives, handling many
constraints, or sophisticated tool/agent orchestration.

Do NOT classify a request as complex merely because it is long.

Do NOT classify a request as simple merely because it is short.

Judge the actual cognitive and technical difficulty of completing
the requested task correctly.
""",

        "criteria": {
            "simple": """
Examples include:

- Greetings and casual conversation
- Simple factual questions
- Definitions and basic explanations
- Straightforward translations
- Simple rewriting
- Short summaries
- Basic calculations
- Simple SQL queries
- Simple Python snippets
- Basic formatting
- Direct lookups
- Simple troubleshooting with an obvious solution
- Questions requiring little or no multi-step reasoning
""",

            "complex": """
Examples include:

- Multi-step reasoning problems
- Difficult programming or debugging
- Designing software architecture
- Designing AI/ML systems
- RAG or agent architecture decisions
- Complex SQL involving multiple CTEs, joins, and window functions
- Advanced mathematical or logical reasoning
- Research requiring synthesis of multiple pieces of information
- Comparing technical approaches with significant trade-offs
- Complex planning
- Long-form technical analysis
- Difficult optimization problems
- Security architecture
- Complex API/backend design
- Agentic workflows involving multiple tools
- Requests with many interacting constraints
- Problems where an incorrect assumption could substantially
  change the resulting solution
"""
        }
    }
}


def route(user_message: str) -> dict:

    result = router.predict(
        {"body": user_message},
        QUESTIONS
    )

    answer = result["answers"]["task_complexity"]

    task = str(answer["choice"]).strip().lower()
    if task not in {"simple", "complex"}:
        raise ValueError(f"Unexpected Laya task classification: {answer['choice']!r}")
    confidence = round(float(answer["confidence"]), 3)

    model = select_model(task)

    return {
        "model": model.model_id,
        "task": task,
        "confidence": confidence,
    }
