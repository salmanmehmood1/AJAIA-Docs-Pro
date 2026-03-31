# Ajaia Docs

A lightweight collaborative document editor built for the Ajaia full-stack assessment using **React + Node.js**.

## What is included

- ✅ Create, rename, edit, save, and reopen documents
- ✅ Basic rich-text formatting with bold, italic, underline, headings, and lists
- ✅ Import `.txt` and `.md` files into editable documents
- ✅ Simple sharing model with seeded users and owned/shared document views
- ✅ Local persistence via a JSON datastore that survives refreshes
- ✅ One automated backend test for document creation + sharing

## Tech stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Persistence:** Local JSON file at `backend/data/db.json`

## Seeded users

Use the user switcher in the UI to demo sharing:

- `Alice Johnson` (`u1`)
- `Bob Smith` (`u2`)
- `Carol Lee` (`u3`)

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start the app

#### Run both together

```bash
npm run dev
```

#### Run frontend and backend separately

```bash
npm run dev:backend
npm run dev:frontend
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

The frontend also supports `VITE_API_URL`, so it can point to a deployed backend during production.

### 3. Run the test

```bash
npm test
```

## Product notes

- File import is intentionally scoped to **`.txt` and `.md`** for a clean demo flow.
- Shared collaborators can open and edit documents; only the owner can grant access to others.
- Rich-text formatting is stored as HTML so formatting is preserved after refresh.

## Deployment note

### Frontend on Vercel

Deploy the `frontend/` folder to Vercel and set:

```bash
VITE_API_URL=https://your-backend-url.com
```

### Backend hosting

The current backend uses `backend/data/db.json` for persistence, so it is best hosted on **Render**, **Railway**, or another Node host with a persistent filesystem. If you later want the backend on Vercel too, switch the JSON store to a real database first.
