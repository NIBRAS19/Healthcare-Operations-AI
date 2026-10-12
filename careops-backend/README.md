# CareOps AI - Backend (Node + Express + MongoDB)

API for the CareOps AI frontend. ESM, Express 4, Mongoose 8. Matches the endpoints in the frontend's `src/api/client.js`.

## Run
```
npm install
cp .env.example .env      # set MONGO_URI and a 32+ char JWT_SECRET
npm run seed              # synthetic demo org/users/cases; prints a one-time demo password
npm run dev               # http://localhost:5000
```
Frontend: set `VITE_USE_MOCK=false`, then sign in as `amina@demo.example` (Ops admin), `omar@demo.example` (Team lead), `sara@demo.example` (Compliance) or `yusuf@demo.example` (IT admin).

## Endpoints (all under /api, session cookie required except auth/health)
| Area | Routes |
|---|---|
| Auth | POST /auth/login, /auth/logout, /auth/logout-all, /auth/accept-invite; GET /auth/me |
| Cases | GET /cases, /cases/:ref, /cases/:ref/summary; POST /cases, /cases/bulk-assign, /cases/:ref/assign, /cases/:ref/status, /cases/:ref/documents (multipart `files`), /cases/:ref/summary/approve |
| Documents | GET /documents, /documents/:ref/fields, /documents/:ref/file; PATCH /documents/:ref/fields/:fieldId (accept/reject/edit); POST /documents/:ref/reprocess |
| Tasks | GET/POST /tasks, PATCH /tasks/:ref |
| Audit | GET /audit, /audit/verify, /audit/export |
| Admin | GET/POST /users, PATCH /users/:id; GET /integrations, POST /integrations/:id/pause; GET /workflows; GET /reports/summary |

## How the PRD's requirements are covered
- **RBAC on every route** (`middleware/auth.js`): role -> permission map; denied attempts are audited. IT admins get no case/document content.
- **Tenant isolation:** every query filters by `orgId`; optional per-user site scope. Missing and not-yours both return 404.
- **Audit:** hash-chained, append-only (model hooks block update/delete), `GET /audit/verify` detects tampering. Also restrict DB user permissions in production.
- **Sessions:** httpOnly SameSite=Strict cookie, short expiry, revocation via `tokenVersion`. Login locks after 5 failures, generic error text, constant-time compare.
- **Uploads:** content sniffing (PDF/JPEG/PNG), 20 MB cap, SHA-256 duplicate detection, random storage keys, streamed download after an authz check.
- **AI safety:** all AI sits behind `services/ai.js`. With AI off, fields are "Not detected" and staff enter them manually. Fields can only be accepted if they have a source snippet. Edits keep the original value plus revisions. Summaries are built only from evidence-backed fields. "Approved" only follows a human approving.
- **Data minimisation:** `patientRef` must be a token (no spaces), no names; logs never include request bodies.

## Not built yet (needs your decisions)
- **MFA (TOTP) and SSO/OIDC** - PRD P0. Login returns `mfa:false`; add a challenge step before issuing the cookie.
- **Real OCR/LLM provider** (`services/ai.js`), **malware scanner** (`services/files.js`; production refuses uploads until set) and **object storage + encryption at rest** (files go to local disk; use encrypted volumes or S3/KMS).
- Retention/deletion jobs, notifications, workflow-template editing, integration connectors, email delivery of invites.
- Automated tests (permissions at API and DB level, tenant isolation, wrong-case handling) and independent security testing before any real patient data.
- Frontend: the Create case page only sends file names today; it must POST the files to `/cases/:ref/documents` as FormData.
