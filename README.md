# FrugalRoute Backend

FrugalRoute is a confidence-gated LLM cascade router with a learned, per-task-type routing policy using the **Gemini API**. It decided which model tier (`fast` | `mid` | `frontier`) is actually needed for a given query to save costs while maintaining a target quality bar.

## Tech Stack
- **Runtime**: Node.js 20+
- **Language**: TypeScript (Strict Mode)
- **Framework**: Fastify
- **Database**: PostgreSQL (via Drizzle ORM)
- **LLM API**: Google Gen AI SDK (`@google/genai`)

## Model Tier Mappings
- **fast**: `gemini-2.5-flash` ($0.075 / 1M input, $0.30 / 1M output tokens)
- **mid**: `gemini-1.5-pro` ($1.25 / 1M input, $5.00 / 1M output tokens)
- **frontier**: `gemini-2.5-pro` ($1.25 / 1M input, $5.00 / 1M output tokens)

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
GEMINI_API_KEY=your_gemini_api_key
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
   - `GEMINI_API_KEY`: Your Google Gemini API Key.
   - The database URL `DATABASE_URL` is automatically wired from the PostgreSQL resource.
4. Render will run `npm install && npm run build` to build, and `npm start` to run. The server runs migrations programmatically on startup.
