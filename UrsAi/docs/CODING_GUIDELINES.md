# CODING GUIDELINES

## General

- Use TypeScript everywhere in frontend.
- Use Python type hints everywhere.
- Follow SOLID principles.
- Keep functions under 50 lines whenever possible.
- Avoid duplicate logic.
- Write reusable components.

---

## Frontend

- Feature-based folder structure.
- Server Components where appropriate.
- Client Components only when needed.
- Use React Hook Form.
- Use Zod validation.

---

## Backend

- Service Layer Pattern.
- Repository Pattern.
- Dependency Injection where appropriate.
- Pydantic models.
- Async APIs.

---

## AI

Never call LLM directly from API.

API

↓

AI Service

↓

Prompt Builder

↓

LLM

↓

Output Validator

↓

Response

---

## Database

Never query database directly from routes.

Routes

↓

Service

↓

Repository

↓

Database

---

## Error Handling

Always return

{
  "success": false,
  "message": "",
  "code": ""
}

---

## Logging

Log

- API requests
- AI execution
- Errors
- Simulation execution

Never log passwords or secrets.

---

## Security

JWT

Password Hashing

Rate Limiting

Environment Variables

Input Validation

CORS

HTTPS
