
from app.llm_service import generate_answer


context = """
Dependency Injection is a design pattern
used in Spring Framework.

It allows objects to receive their dependencies
from an external source instead of creating
them directly.

Spring IoC Container manages the dependencies.
"""

question = "What is Dependency Injection?"

answer = generate_answer(
    question=question,
    context=context
)

print("\n========== LLM ANSWER ==========")
print(answer)
