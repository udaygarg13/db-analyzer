from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Generator

import ollama
import pandas as pd
from sqlalchemy import create_engine, text

from db_analyzer.indexer import retrieve_schema_chunks
from db_analyzer.schema import SchemaInfo, get_full_schema_text


SQL_SYSTEM = """You are an expert SQL analyst. Your job is to write a single, correct SQL query that answers the user's question.

Rules:
- Output ONLY the raw SQL query. No markdown, no explanation, no backticks.
- Use standard SQL compatible with the dialect specified.
- Never use DROP, DELETE, UPDATE, INSERT, ALTER, CREATE, or TRUNCATE — read-only queries only.
- If the question cannot be answered from the schema, output: CANNOT_ANSWER
- Use table and column names exactly as they appear in the schema.
- For aggregations, always use clear aliases (e.g. AS total_revenue).
- Never use REGEXP_LIKE, ILIKE, or other dialect-specific functions unless the dialect explicitly supports them.
- For SQLite, use LIKE for pattern matching instead of regex functions.
"""

ANSWER_SYSTEM = """You are a helpful data analyst explaining query results to a non-technical business user.

Given a question, the SQL query that was run, and the results, provide:
1. A clear, concise answer in plain English (2-4 sentences).
2. Any notable patterns, outliers, or follow-up insights worth mentioning.

Do not repeat the SQL. Do not use jargon. Be specific with numbers."""


@dataclass
class QueryResult:
    question: str
    sql: str
    dataframe: pd.DataFrame | None
    answer: str | Generator
    error: str | None = None
    schema_chunks_used: list[dict] = field(default_factory=list)


def _detect_dialect(db_url: str) -> str:
    if db_url.startswith("sqlite"):
        return "SQLite"
    if db_url.startswith("postgresql") or db_url.startswith("postgres"):
        return "PostgreSQL"
    if db_url.startswith("mysql"):
        return "MySQL"
    return "SQL"


def generate_sql(
    question: str,
    schema: SchemaInfo,
    collection,
    model: str = "llama3",
) -> tuple[str, list[dict]]:
    chunks = retrieve_schema_chunks(question, collection, top_k=5)
    retrieved_context = "\n\n".join(c["text"] for c in chunks)
    full_ddl = get_full_schema_text(schema)
    dialect = _detect_dialect(schema.db_url)

    user_msg = f"""Database dialect: {dialect}

Full schema (DDL):
{full_ddl}

Relevant schema details:
{retrieved_context}

Question: {question}"""

    response = ollama.chat(
        model=model,
        messages=[
            {"role": "system", "content": SQL_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        options={"temperature": 0},
    )
    sql = response["message"]["content"].strip()

    return _extract_sql(sql), chunks


def _extract_sql(text: str) -> str:
    fenced = re.search(r"```(?:sql)?\s*\n?(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if fenced:
        return fenced.group(1).strip()

    match = re.search(r"((?:WITH|SELECT)\s+.+)", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return text.strip()


def execute_sql(sql: str, db_url: str) -> pd.DataFrame:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        rows = result.fetchall()
        cols = list(result.keys())
    return pd.DataFrame(rows, columns=cols)


def generate_answer(
    question: str,
    sql: str,
    df: pd.DataFrame,
    model: str = "llama3",
    stream: bool = False,
) -> str | Generator:
    data_str = (
        df.head(50).to_string(index=False) if not df.empty else "(no rows returned)"
    )
    row_note = (
        f"\n(Showing {min(len(df), 50)} of {len(df)} rows)" if len(df) > 50 else ""
    )

    user_msg = f"""Question: {question}

SQL executed:
{sql}

Results:
{data_str}{row_note}"""

    messages = [
        {"role": "system", "content": ANSWER_SYSTEM},
        {"role": "user", "content": user_msg},
    ]

    if stream:

        def _stream():
            response = ollama.chat(
                model=model,
                messages=messages,
                options={"temperature": 0.3},
                stream=True,
            )
            for chunk in response:
                if chunk["done"]:
                    break
                if "content" in chunk.get("message", {}):
                    yield chunk["message"]["content"]

        return _stream()
    else:
        response = ollama.chat(
            model=model,
            messages=messages,
            options={"temperature": 0.3},
        )
        return response["message"]["content"].strip()


def run_query(
    question: str,
    schema: SchemaInfo,
    collection,
    model: str = "llama3",
    stream: bool = False,
) -> QueryResult:
    try:
        sql, chunks = generate_sql(question, schema, collection, model)
    except Exception as e:
        return QueryResult(
            question=question,
            sql="",
            dataframe=None,
            answer="",
            error=f"SQL generation failed: {e}",
        )

    if sql == "CANNOT_ANSWER":
        return QueryResult(
            question=question,
            sql=sql,
            dataframe=None,
            answer="I couldn't find enough information in the schema to answer that question.",
            error=None,
        )
    try:
        df = execute_sql(sql, schema.db_url)
    except Exception as e:
        return QueryResult(
            question=question,
            sql=sql,
            dataframe=None,
            answer="",
            error=f"SQL execution error: {e}",
            schema_chunks_used=chunks,
        )

    answer = generate_answer(question, sql, df, model, stream=stream)

    return QueryResult(
        question=question,
        sql=sql,
        dataframe=df,
        answer=answer,
        schema_chunks_used=chunks,
    )
