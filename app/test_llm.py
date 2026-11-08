
from app.llm_service import generate_answer, LLMUnavailableError


context = """
Dependency Injection is a design pattern
used in Spring Framework.

It allows objects to receive their dependencies
from an external source instead of creating
them directly.

Spring IoC Container manages the dependencies.
"""

question = "What is Dependency Injection?"

try:
    answer = generate_answer(
        question=question,
        context=context
    )

    print("\n========== LLM ANSWER ==========")
    print(answer)
except LLMUnavailableError as exc:
    print("\n========== LLM UNAVAILABLE ==========")
    print(exc)
