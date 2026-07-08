# FrugalRoute Backend

FrugalRoute is a confidence-gated LLM cascade router with a learned, per-task-type routing policy using the **Gemini API**. It decided which model tier (`fast` | `mid` | `frontier`) is actually needed for a given query to save costs while maintaining a target quality bar.

## Tech Stack
- **Runtime**: Node.js 20+
- **Language**: TypeScript (Strict Mode)
- **Framework**: Fastify
- **Database**: PostgreSQL (via Drizzle ORM)
- **LLM API**: OpenRouter (OpenAI-compatible, single API key for all tiers)

## Model Tier Mappings
- **fast**: `google/gemma-4-31b-it:free` (free tier, Google Gemma 4 31B)
- **mid**: `openai/gpt-oss-20b:free` (free tier, OpenAI open-source 20B)
- **frontier**: `nvidia/nemotron-3-ultra-550b-a55b:free` (free tier, NVIDIA 550B MoE — most capable free model on OpenRouter)

---

## Local Setup

### 1. Prerequisites
- Node.js 20+ and npm installed
- Running PostgreSQL database instance

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
```

Ensure your `.env` contains:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/frugalroute
OPENROUTER_API_KEY=your_openrouter_api_key
```

### 4. Database Setup
Generate and apply migrations to your local Postgres database:
```bash
# Generate SQL migration files (already generated in src/db/migrations)
npm run db:generate

# Apply migrations programmatically on startup or via:
npm run db:migrate
```

### 5. Run the Server
Run the dev server (uses `tsx watch` for auto-reloading):
```bash
npm run dev
```

The server will run on `http://localhost:3000`.

---

## Testing Endpoints

You can test the entire workflow (register -> route -> feedback -> policy -> savings) using the provided `test.sh` script:
```bash
chmod +x test.sh
./test.sh
```

Or on Windows PowerShell:
```powershell
.\test.ps1
```

---

## API Documentation (Endpoint Contracts)

Refer to [skill.md](file:///c:/Users/Admin/Desktop/FrugalRoute/skill.md) or access `GET /skill.md` at runtime to inspect the full API specifications.

---

## Render Deployment

To deploy this backend to Render:

1. Create a new **Blueprint** service on Render and link it to this repository.
2. Render will automatically parse the `render.yaml` file to provision:
   - A **Managed PostgreSQL** database.
   - A **Web Service** running Node.js.
3. Configure the following environment variables in the Web Service dashboard on Render:
   - `OPENROUTER_API_KEY`: Your OpenRouter API Key (free at openrouter.ai).
4. Render will run `npm install && npm run build` to build, and `npm start` to run. The server runs migrations programmatically on startup.
