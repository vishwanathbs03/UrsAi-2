# DATABASE DESIGN

Version 1.0

---

## Tables

### Users

- id
- name
- email
- password_hash
- created_at

---

### Businesses

- id
- user_id
- business_name
- industry
- business_type
- country
- employee_count
- annual_revenue

---

### Products

- id
- business_id
- product_name
- category
- hs_code

---

### Certifications

- id
- business_id
- certification_name
- issued_date
- expiry_date

---

### MRI_Scans

- id
- business_id
- export_score
- compliance_score
- trust_score
- growth_score
- sustainability_score
- opportunity_score
- overall_score
- created_at

---

### Recommendations

- id
- scan_id
- priority
- title
- description
- expected_impact
- estimated_duration

---

### Simulations

- id
- business_id
- simulation_type
- input_data
- result
- created_at
