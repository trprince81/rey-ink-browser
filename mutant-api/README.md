# MUTANT License API

Standalone Vercel API for MUTANT. No Supabase or Firebase.

Endpoints Vercel:
- GET /api/plans
- POST /api/generate
- POST /api/validate

POST /api/generate body: {"email":"cliente@correo.com","profiles":35,"duration_months":3}

Plans: 5=$13, 10=$20, 35=$30, 50=$50, 100=$70, 500=$150, 1000=$350 per month.
Durations: 1, 3, 6, 12 months. Total = monthly price × duration.

Licenses are self-contained and include the customer email, profile limit, duration and expiration. /api/validate verifies the license and expiration without a database.
