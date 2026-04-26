# Database Analyzer

Ask natural language questions about SQL databases and get SQL queries, results, and explanations.

## How it works

1. Connect to a database
2. The schema is introspected and embedded into a vector store
3. When you ask a question, relevant schema parts are retrieved
4. An LLM generates SQL based on the retrieved schema
5. The SQL is executed and results are returned
6. The LLM explains the results in natural language

This RAG approach ensures only relevant schema information is used, keeping prompts efficient even for large databases.

## Setup

### Prerequisites
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- [Ollama](https://ollama.ai) for local LLM

### Installation

```bash
git clone https://github.com/udaygarg13/db-analyzer
cd db-analyzer

# Install dependencies
uv sync
cd apps/frontend && npm install && cd ..
```

### Running

Start the backend:
```bash
uv run db-analyzer
```

Start the frontend:
```bash
cd apps/frontend && npm start
```

Open http://localhost:3000 in your browser.

## Using Ollama

To run entirely locally with Ollama:

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Start the server: `ollama serve`
3. Pull the required models:
   ```bash
   ollama pull llama3
   ollama pull nomic-embed-text
   ```
4. Enter the model name in the app sidebar

## Usage

1. Upload a `.db` file or enter a database connection string
2. Click Connect to index the schema
3. Ask questions in natural language
4. View the generated SQL, results, and explanations

## Tech stack

- **Backend**: Python, FastAPI, SQLAlchemy, ChromaDB
- **Frontend**: React, Vite, Tailwind CSS
- **LLM**: Ollama
- **Package manager**: uv

## Supported databases

SQLite, PostgreSQL, MySQL, and any SQLAlchemy-compatible database.
