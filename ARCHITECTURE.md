# Architecture Note

## Scope choices

I prioritized a solid end-to-end product slice over advanced collaboration features:

- Document CRUD with a usable rich-text editor
- File import into the editing workflow
- Share-by-user behavior with clear owned/shared separation
- Persistence that survives refresh without external infrastructure

## System design

### Frontend (`frontend/`)
- React + Vite single-page app
- Sidebar for user switching, document lists, and file import
- Main editor surface built with `contentEditable` and formatting controls
- API integration for document CRUD and sharing

### Backend (`backend/`)
- Express REST API
- JSON-based storage in `backend/data/db.json`
- Seeded demo users to keep auth scope lightweight
- File upload endpoint for `.txt` / `.md` imports

## Data model

```json
{
  "users": [{ "id": "u1", "name": "Alice Johnson" }],
  "documents": [{
    "id": "doc-id",
    "title": "Quarterly Plan",
    "content": "<p>Stored as HTML</p>",
    "ownerId": "u1",
    "sharedWith": ["u2"],
    "updatedAt": "ISO timestamp"
  }]
}
```

## Tradeoffs

- Used HTML persistence instead of a heavier editor framework to stay fast and focused.
- Used local JSON storage instead of Postgres/Supabase to keep setup friction low for reviewers.
- Did not implement true real-time multi-user cursors or presence due to timebox.
