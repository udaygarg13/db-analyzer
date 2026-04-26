from __future__ import annotations

import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db_analyzer.indexer import index_schema
from db_analyzer.query import run_query
from db_analyzer.schema import introspect

sessions: dict[str, dict[str, Any]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    sessions.clear()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectRequest(BaseModel):
    session_id: str
    db_url: str
    db_type: str
    model: str = "llama3"


class QueryRequest(BaseModel):
    session_id: str
    question: str
    stream: bool = False


@app.post("/api/upload")
async def upload_file(
    file: UploadFile,
    session_id: str = Form(...),
    db_type: str = Form("sqlite"),
    model: str = Form("llama3"),
) -> dict:
    try:
        temp_dir = Path(tempfile.gettempdir())
        if not file.filename:
            raise ValueError("Uploaded file has no filename")

        temp_path = temp_dir / file.filename

        with open(temp_path, "wb") as buffer:
            buffer.write(await file.read())

        db_url = f"sqlite:///{temp_path}"

        return {
            "success": True,
            "db_url": db_url,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/connect")
async def connect(request: ConnectRequest) -> dict:
    try:
        schema = introspect(request.db_url)
        collection = index_schema(schema)

        sessions[request.session_id] = {
            "schema": schema,
            "collection": collection,
            "db_url": request.db_url,
            "model": request.model,
            "db_label": request.db_type,
        }

        return {
            "success": True,
            "tables": [
                {
                    "name": table.name,
                    "row_count": table.row_count,
                    "columns": [
                        {
                            "name": col.name,
                            "type": col.type,
                            "nullable": col.nullable,
                            "primary_key": col.primary_key,
                            "foreign_key": col.foreign_key,
                        }
                        for col in table.columns
                    ],
                }
                for table in schema.tables
            ],
            "db_label": request.db_type,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/schema/{session_id}")
async def get_schema(session_id: str) -> dict:
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    schema = sessions[session_id]["schema"]
    return {
        "tables": [
            {
                "name": table.name,
                "row_count": table.row_count,
                "columns": [
                    {
                        "name": col.name,
                        "type": col.type,
                        "nullable": col.nullable,
                        "primary_key": col.primary_key,
                        "foreign_key": col.foreign_key,
                    }
                    for col in table.columns
                ],
            }
            for table in schema.tables
        ],
    }


@app.post("/api/query")
async def query(request: QueryRequest) -> dict:
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[request.session_id]

    try:
        result = run_query(
            request.question,
            session["schema"],
            session["collection"],
            model=session["model"],
            stream=request.stream,
        )

        return {
            "question": result.question,
            "sql": result.sql,
            "dataframe": result.dataframe.to_dict(orient="records")
            if result.dataframe is not None
            else None,
            "answer": result.answer if not request.stream else None,
            "error": result.error,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str) -> dict:
    if session_id in sessions:
        del sessions[session_id]
    return {"success": True}


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}
