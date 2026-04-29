# 📘 PCD - Projet de Conception et de Développement
## Modèle de Structure pour le Rapport Académique

Conçu pour documenter formellement l'architecture et la réalisation du "FinScore Platform". 

---

### **Remerciements**
Dédicaces et remerciements adressés à l'encadreur, aux professeurs, et toute personne ayant contribué au succès du projet.

### **Introduction Générale**
- Présentation du contexte économique et technologique (Digitalisation des PME).
- Problématique : La difficulté d'évaluation des risques liés aux PME tunisiennes et l'absence de données standardisées.
- Objectif du projet : Création d'une plateforme d'évaluation et de mise en relation dynamique entre investisseurs et PME.
- Plan du rapport.

---

### **Chapitre 1 : Contexte et État de l'art**
1. **Introduction**
2. **Le M-Marketing et la Digitalisation**
   - Étude sur l'évolution du Mobile Marketing et l'impact sur l'économie.
   - Les concepts du ciblage des PME via des plateformes unifiées.
3. **Le Scoring Financier (Credit Risk Scoring)**
   - Algorithmes traditionnels vs Intelligence Artificielle.
   - L'importance des données alternatives (Comportementales, sectorielles, CNSS).
4. **Étude de l'existant**
   - Analyse des solutions concurrentes ou existantes sur le marché tunisien/international.
   - Limites de l'existant justifiant la création de FinScore.
5. **Conclusion du chapitre**

---

### **Chapitre 2 : Spécification et Conception**
1. **Introduction**
2. **Spécification des Besoins**
   - **Besoins Fonctionnels** (Ex: Inscription, Algorithme de calcul, Scraping de données Groq, Unlock Contacts via crédits).
   - **Besoins Non-Fonctionnels** (Ex: Sécurité JWT, Performance, Responsive Design UX/UI).
3. **Modélisation du Système (UML)**
   - Diagramme des Cas d'Utilisation (Use Cases - PME vs Banker/Investisseur).
   - Diagramme de Séquence (Flux d'authentification ou Flux d'enrichissement IA Groq).
   - Diagramme de Classes (Spécification de la persistance - Utilisateurs, Profils PME, Logs de simulations).
4. **Architecture Globale**
   - Choix d'une architecture orientée API (REST).
   - Séparation stricte Frontend (React) / Backend (FastAPI).
5. **Conclusion du chapitre**

---

### **Chapitre 3 : Réalisation et Validation**
1. **Introduction**
2. **Environnement Technologique et Outils**
   - **Backend** : Python, FastAPI, SQLAlchemy, SQLite.
   - **Frontend** : Next.js, React, TailwindCSS, Framer Motion.
   - **Intelligence Artificielle** : Groq API (Modèle LLM Llama-3 70B).
   - **Architecture DevOps** : Docker (préparation), Git/GitHub.
3. **Implémentation des Fonctionnalités Clés**
   - Démonstration des interfaces (Captures d'écran : Dashboard Investisseur, Marketplace, Scraper Automatisé).
   - Gestion avancée d'état et Mapping des données en React.
4. **Validation et Tests**
   - Description des scénarios tests fonctionnels (Ex: Résolution du "Hallucination Loop" ou Mismatch des clés).
   - Bilan des tests unitaires et intégrés.
5. **Conclusion du chapitre**

---

### **Conclusion Générale et Perspectives**
- Bilan général du projet par rapport aux objectifs initiaux.
- Limitations rencontrées et compétences acquises.
- **Perspectives d'avenir** : 
  - Migration vers PostgreSQL/Production.
  - Déploiement Cloud (Docker Hub / AWS).
  - Web Scraping en temps réel (Puppeteer/Selenium) pour remplacer/renforcer les données simulées.

### **Webographie / Bibliographie**
Liste des références théoriques, APIs utilisées (Doc Groq, Doc FastAPI) et articles de recherche sur le risk management.
