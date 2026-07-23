# PROJECT STRUCTURE

Version: 1.0

Project Name: Atlas AI

---

# Repository Structure

atlas-ai/

├── frontend/
├── backend/
├── database/
├── docs/
├── deployment/
├── README.md

---

# FRONTEND

frontend/

├── app/
│   ├── (auth)/
│   ├── dashboard/
│   ├── business/
│   ├── simulation/
│   ├── reports/
│   └── settings/
│
├── components/
│   ├── common/
│   ├── ui/
│   ├── charts/
│   ├── forms/
│   ├── cards/
│   ├── maps/
│   └── animations/
│
├── features/
│   ├── authentication/
│   ├── business-profile/
│   ├── digital-twin/
│   ├── business-mri/
│   ├── simulation/
│   ├── recommendations/
│   └── reports/
│
├── services/
│
├── hooks/
│
├── lib/
│
├── types/
│
├── constants/
│
└── utils/

---

# BACKEND

backend/

├── app/
│
├── api/
│   ├── auth/
│   ├── business/
│   ├── mri/
│   ├── simulation/
│   ├── recommendation/
│   └── reports/
│
├── services/
│
├── ai/
│   ├── digital_twin/
│   ├── mri_engine/
│   ├── reasoning/
│   ├── simulation/
│   └── recommendations/
│
├── database/
│
├── models/
│
├── repositories/
│
├── schemas/
│
├── middleware/
│
├── utils/
│
└── config/

---

# DATABASE

database/

schema.sql

seed.sql

migrations/

---

# DOCS

Architecture

API

AI

Research

Pitch

---

# DEPLOYMENT

Docker

Docker Compose

CI/CD

Deployment Config

---

# RESPONSIBILITIES

Frontend

- UI
- Forms
- Dashboard
- Maps
- Charts
- Animations

Backend

- APIs
- Authentication
- Business Logic
- AI Integration

AI

- Digital Twin
- MRI
- Simulation
- Decision Brief

Database

- Persistent Storage

Deployment

- Production
