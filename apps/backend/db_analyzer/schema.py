from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pandas as pd
from sqlalchemy import create_engine, inspect, text


@dataclass
class ColumnInfo:
    name: str
    type: str
    nullable: bool
    primary_key: bool
    foreign_key: str | None = None


@dataclass
class TableInfo:
    name: str
    columns: list[ColumnInfo] = field(default_factory=list)
    sample_rows: list[dict[str, Any]] = field(default_factory=list)
    row_count: int = 0


@dataclass
class SchemaInfo:
    tables: list[TableInfo] = field(default_factory=list)
    db_url: str = ""


def introspect(db_url: str, sample_rows: int = 3) -> SchemaInfo:
    """
    Connect to a database and return a full SchemaInfo object.

    Supports any SQLAlchemy URL:
      - SQLite:    sqlite:///path/to/file.db
      - PostgreSQL: postgresql://user:pass@host/db
      - MySQL:      mysql+pymysql://user:pass@host/db
    """
    engine = create_engine(db_url)
    insp = inspect(engine)
    schema = SchemaInfo(db_url=db_url)

    table_names = insp.get_table_names()

    dialect = engine.dialect
    quote = dialect.identifier_preparer.quote

    with engine.connect() as conn:
        for table_name in table_names:
            raw_cols = insp.get_columns(table_name)
            pk_cols = set(
                insp.get_pk_constraint(table_name).get("constrained_columns", [])
            )
            fk_map: dict[str, str] = {}
            for fk in insp.get_foreign_keys(table_name):
                for local_col, ref_col in zip(
                    fk["constrained_columns"], fk["referred_columns"]
                ):
                    fk_map[local_col] = f"{fk['referred_table']}.{ref_col}"

            columns = [
                ColumnInfo(
                    name=col["name"],
                    type=str(col["type"]),
                    nullable=col.get("nullable", True),
                    primary_key=col["name"] in pk_cols,
                    foreign_key=fk_map.get(col["name"]),
                )
                for col in raw_cols
            ]

            try:
                count_result = conn.execute(
                    text(f"SELECT COUNT(*) FROM {quote(table_name)}")
                )
                row_count = count_result.scalar() or 0
            except Exception:
                row_count = 0

            samples = []
            try:
                result = conn.execute(
                    text(f"SELECT * FROM {quote(table_name)} LIMIT {sample_rows}")
                )
                rows = result.fetchall()
                col_names = list(result.keys())
                for row in rows:
                    samples.append(dict(zip(col_names, row)))
            except Exception:
                pass

            schema.tables.append(
                TableInfo(
                    name=table_name,
                    columns=columns,
                    sample_rows=samples,
                    row_count=row_count,
                )
            )

    return schema


def table_to_text(table: TableInfo) -> str:
    """
    Convert a TableInfo into a rich text chunk suitable for embedding.
    """
    lines = [
        f"Table: {table.name}",
        f"Row count: {table.row_count:,}",
        "",
        "Columns:",
    ]

    for col in table.columns:
        flags = []
        if col.primary_key:
            flags.append("PRIMARY KEY")
        if not col.nullable:
            flags.append("NOT NULL")
        if col.foreign_key:
            flags.append(f"FK → {col.foreign_key}")
        flag_str = f"  [{', '.join(flags)}]" if flags else ""
        lines.append(f"  - {col.name} ({col.type}){flag_str}")

    if table.sample_rows:
        lines.append("")
        lines.append("Sample data:")
        try:
            df = pd.DataFrame(table.sample_rows)
            lines.append(df.to_string(index=False))
        except Exception:
            for row in table.sample_rows:
                lines.append(f"  {row}")

    return "\n".join(lines)


def schema_to_chunks(schema: SchemaInfo) -> list[dict]:
    """
    Convert a full SchemaInfo into a list of embeddable chunks.
    Returns [{"id": str, "text": str, "metadata": dict}]
    """
    chunks = []

    for table in schema.tables:
        chunks.append(
            {
                "id": f"table::{table.name}",
                "text": table_to_text(table),
                "metadata": {
                    "type": "table",
                    "table": table.name,
                },
            }
        )

    overview_lines = ["Database overview — all tables and columns:", ""]
    for table in schema.tables:
        col_names = ", ".join(c.name for c in table.columns)
        overview_lines.append(f"  {table.name} ({table.row_count:,} rows): {col_names}")

    chunks.append(
        {
            "id": "overview::all_tables",
            "text": "\n".join(overview_lines),
            "metadata": {"type": "overview"},
        }
    )

    return chunks


def get_full_schema_text(schema: SchemaInfo) -> str:
    """Return a compact DDL-style summary for inclusion in SQL generation prompts."""
    lines = []
    for table in schema.tables:
        col_defs = []
        for col in table.columns:
            parts = [col.name, col.type]
            if col.primary_key:
                parts.append("PRIMARY KEY")
            if not col.nullable:
                parts.append("NOT NULL")
            if col.foreign_key:
                parts.append(f"REFERENCES {col.foreign_key}")
            col_defs.append("  " + " ".join(parts))
        lines.append(f"CREATE TABLE {table.name} (\n" + ",\n".join(col_defs) + "\n);")
    return "\n\n".join(lines)
