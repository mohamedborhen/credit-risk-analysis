# 🚀 FinScore: Redefining SME Credit in Tunisia

![FinScore Banner](https://img.shields.io/badge/FinScore-Alternative_Credit_Scoring-teal?style=for-the-badge&logo=rocket)
![Next.js](https://img.shields.io/badge/Next.js_14-black?style=for-the-badge&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![AI-Powered](https://img.shields.io/badge/AI--Powered-Groq_LLaMA_3.3-indigo?style=for-the-badge&logo=openai)

**FinScore** is a state-of-the-art alternative credit scoring platform specifically designed for the Tunisian economic ecosystem. By combining traditional financial metrics with alternative behavioral signals and AI-powered web enrichment, FinScore provides a 360° risk assessment for SMEs.

---

## ✨ Core Features

### 🏛️ Banker Intelligence Portal
- **Dual-Model Scoring**: Uses a stacking ensemble of Gradient Boosting and Random Forest models to predict default probability with high precision.
- **SHAP Explainability**: Transparent "AI Influence Matrix" showing exactly which factors (turnover, social footprint, RNE status) shifted the score.
- **What-If Simulator**: Real-time modeling of future scenarios to see how business decisions impact creditworthiness.

### 🏪 Investor Marketplace
- **Verified Listings**: A searchable directory of Tunisian SMEs with live FinScore evaluations.
- **Lead Generation System**: A credit-based workflow allowing investors/banks to "unlock" direct contact information (email/phone) for high-potential SMEs.
- **Credit Economy**: Integrated credit management for secure, subscription-based lead access.

### 🏢 SME Dashboard
- **Comprehensive Assessment**: Module-based data entry covering Financials, Employment (CNSS), and Behavioral footprints.
- **Marketplace Control**: PMEs can toggle their visibility to "Public" or "Private" to control their exposure to investors.
- **AI-Powered Chatbot**: A dedicated assistant to help SMEs understand their score drivers and improve their credit profile.

### 🤖 AI Enrichment (Groq)
- **Automatic Scraper**: Uses LLaMA 3.3 via the Groq API to crawl and extract public company data (sector, employees, LinkedIn followers) to pre-fill assessments.
- **Validation Engine**: Cross-references alternative data to ensure logic consistency (e.g., expenses < turnover).

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 14 (App Router), Tailwind CSS, Framer Motion, Lucide Icons, Recharts |
| **Backend** | FastAPI, SQLAlchemy (ORM), Pydantic, Uvicorn |
| **Database** | SQLite (Production-ready relational schema) |
| **AI/ML** | Groq API (LLaMA 3.3), Scikit-Learn (Stacked Dual-Model), SHAP |
| **Security** | JWT Authentication, Role-Based Access Control (PME vs. BANK) |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- [Groq API Key](https://console.groq.com/) (for AI enrichment features)

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
```
Create a `.env` file in the `backend/` directory:
```env
DATABASE_URL=sqlite:///./finscore.db
GROQ_API_KEY=your_key_here
SECRET_KEY=your_jwt_secret
```
Run the server:
```bash
uvicorn main:app --reload
```

### 2. Frontend Setup
```bash
cd v2-pme-frontend
npm install
```
Run the development server:
```bash
npm run dev
```

---

## 📂 Project Structure

```text
├── backend/
│   ├── core/           # Database & Security config
│   ├── models/         # SQLAlchemy ORM models
│   ├── routers/        # API Endpoints (Auth, Marketplace, Scoring, Enrich)
│   ├── schemas/        # Pydantic validation models
│   └── main.py         # Entry point
├── v2-pme-frontend/
│   ├── src/app/        # Next.js Pages (Marketplace, Dashboard, Pricing)
│   ├── src/components/ # Reusable UI Components
│   └── src/lib/        # API clients & state management
└── finscore.db         # Local SQLite Database
```

---

## 📈 Roadmap
- [x] Multi-role authentication (PME/Banker)
- [x] Credit-based lead generation system
- [x] Groq AI enrichment pipeline
- [x] SHAP explanation integration
- [ ] Stripe Payment Gateway integration for credit purchase
- [ ] Multi-lingual support (English/French/Arabic)
- [ ] Mobile App (React Native)

---

## 📄 License
© 2026 FinScore. Developed for the Tunisian SME ecosystem.
