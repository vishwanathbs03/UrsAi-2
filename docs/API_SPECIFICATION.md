# API SPECIFICATION

Version: 1.0

---

# Base URL

/api/v1

---

## Authentication

### Register

POST /auth/register

Request

{
  "name": "",
  "email": "",
  "password": ""
}

Response

{
  "success": true,
  "token": "",
  "userId": ""
}

---

### Login

POST /auth/login

Response

JWT Token

---

## Business

### Create Business

POST /business

Request

{
  "businessName": "",
  "industry": "",
  "products": [],
  "employees": 0,
  "revenue": "",
  "certifications": [],
  "goal": ""
}

Response

{
  "businessId": ""
}

---

### Get Business

GET /business/{id}

---

### Update Business

PUT /business/{id}

---

## Digital Twin

POST /digital-twin/generate

Input

Business ID

Output

{
  "twinId": "",
  "status": "Generated"
}

---

## Business MRI

POST /business-mri/analyze

Input

Business ID

Output

{
  "overallConfidence": 84,
  "countryRecommendations": [],
  "riskSummary": {},
  "opportunitySummary": {},
  "recommendations": []
}

---

## AI Decision Brief

GET /decision-brief/{businessId}

Output

{
  "recommendedCountry": "",
  "confidence": 92,
  "reasons": [],
  "risks": [],
  "roadmap": []
}

---

## Simulation

POST /simulation/run

Request

{
  "businessId": "",
  "changes": {
      "country": "",
      "certification": "",
      "capacityIncrease": 0
  }
}

Response

{
  "newConfidence": 91,
  "difference": 12,
  "explanation": ""
}

---

## Reports

GET /reports/{businessId}

Downloads PDF

---

## Dashboard

GET /dashboard/{businessId}

Returns complete dashboard data
