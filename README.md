# Aura Reflections & Autonomous Action Engine

A production-ready, security-hardened personal reflection studio and autonomous execution engine built with **Google AI Studio**, **Gemini 3.6 Flash / 3.7 Flash**, **Cloud Run**, and **Cloud Firestore**.

---

## 🌟 Submission & Showcase Highlights

### 1. Authenticity & Originality (Beyond Starter Lab)
- **Autonomous Action Engine & Artifact Workbench**: Transforms unstructured reflections and brainstorms into 4 distinct types of typed, ready-to-execute operational artifacts:
  - 📧 **Email Drafts**: Ready-to-send emails with recipient roles, tone selection (**Diplomatic**, **Assertive**, **Direct**), 1-click clipboard copying, and `mailto:` client integration.
  - 💻 **Technical Specs & Code**: Syntax-formatted code blocks (SQL queries, TypeScript interfaces, bash scripts, pseudocode) with 1-click code copying and technical rationale.
  - 📅 **Calendar Time-Blocks**: Focus blocks with agendas, direct Google Calendar web links, and downloadable RFC 5545 `.ics` files.
  - 📊 **Action DAG Checklist**: Interactive directed acyclic graph task lists with time estimates (`estimated_minutes`), priority badges, dependency tags (`Depends on: task-1`), and live Firestore completion synchronization.
- **Dynamic Multi-Turn Reflection Dialogue**: Contextual AI thought partner offering Socratic inquiry and cognitive reframing based on live stream-of-consciousness writing.
- **Interactive Walkthrough Guide**: 11 end-to-end interactive test walkthrough cases (`TC-AUTH-01` through `TC-DAG-11`) built directly into the UI.

### 2. Usability & User Experience
- **Single Sign-On (SSO)**: Federated Google Sign-In via Firebase Auth with zero password friction, plus instant guest sandbox mode with local synchronization.
- **Clean Minimalist Theme**: High-contrast, accessibility-compliant design with responsive mobile/desktop layouts.
- **Search & Filter Archive**: Real-time keyword search, sentiment filtering (`Energized`, `Reflective`, `Focused`, `Stressed`, `Calm`), tag management, and favorites.

### 3. Stability & Reliability
- **4-Tier Resilient Gemini Fallback Ladder**: Catches rate limits (`429`), temporary outages (`503`), and model errors with zero downtime:
  1. `gemini-3.6-flash` (Primary)
  2. `gemini-3.1-flash-lite` (High-Availability Fallback)
  3. `gemini-flash-latest` (Dynamic Alias)
  4. `gemini-3.7-flash` (Deep Reasoning Fallback)
- **Defensive Server & Payload Deserialization**: Order-guaranteed JSON middleware, null-safe payload ingestion, and undefined-stripping prior to database writes.

### 4. Security Hardening & Zero-Hardcoding
- **Server-Side API Key Isolation**: `GEMINI_API_KEY` is strictly confined to the backend and never exposed to client browsers.
- **Owner-Bound Path Isolation**: Firestore rules strictly isolate documents under `/users/{userId}/*` with `request.auth.uid == userId`.
- **Client & Server PII Masking**: Automatic scrubbing of credit cards, SSNs, API tokens, and credentials via `maskPII` before LLM processing.

---

## 🏛️ System Architecture

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **User Identity** | Firebase Authentication | Secure federated login via Google Sign-In (zero password storage). |
| **Backend Database** | Cloud Firestore | User-isolated document storage for reflections, chats, and action items under `/users/{userId}/*`. |
| **AI Thought Partner** | Gemini 3.6 Flash / 3.7 Flash | Multi-turn conversational reflections, cognitive challenge prompts, and structured JSON synthesis. |
| **Secret Management** | Google Cloud Secret Manager / Env | Secure server-side isolation of `GEMINI_API_KEY`. |
| **Backend Runtime** | Express.js (Node.js) + Vite | Server proxy implementing resilient model fallback ladders and PII scrubbing. |

---

## 🔒 Security Architecture & Firestore Rules

All journal data and execution artifacts are strictly owner-isolated using the following Cloud Firestore Security Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /journals/{journalId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

---

## 🚀 Google Cloud Run Deployment Guide

### Prerequisites
1. Install and initialize the [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install).
2. Enable required GCP services:
   ```bash
   gcloud services enable run.googleapis.com \
     secretmanager.googleapis.com \
     firestore.googleapis.com
   ```

### 1. Configure Secret Manager
Create and grant access to the Gemini API Key secret:

```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 2. Deploy to Google Cloud Run
Deploy the application with Secret Manager environment injection:

```bash
gcloud run deploy aura-reflections \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

### 3. Required Campaign Verification Label
Apply the required campaign registration label to verify deployment:

```bash
gcloud run services update aura-reflections \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 🧪 Verification Walkthrough (11 Test Cases)

1. **TC-AUTH-01 (Authentication & SSO)**: Log in via Google Sign-In or Guest Sandbox.
2. **TC-PERSIST-02 (Firestore Isolation)**: Create and save reflections under private user subcollections.
3. **TC-FALLBACK-03 (Gemini Fallback Ladder)**: Automatic multi-model recovery on rate limits or service hiccups.
4. **TC-PROMPTS-04 (Reflection Starters)**: 1-click starter prompts for strategic reframing and daily mental clarity.
5. **TC-DIALOGUE-05 (Socratic AI Partner)**: Multi-turn contextual dialogue with Gemini on live journal entries.
6. **TC-PII-06 (PII Masking)**: Automatic credential and sensitive data masking before LLM ingestion.
7. **TC-WORKBENCH-07 (Action Workbench Drawer)**: Sliding drawer with category filters and tone tuning controls.
8. **TC-EMAIL-08 (Email Synthesis)**: Ready-to-send email drafts with 1-click clipboard copying and mailto trigger.
9. **TC-CODE-09 (Technical Specs)**: Syntax-formatted code and database specs with 1-click copy.
10. **TC-CALENDAR-10 (Calendar Blocks)**: Focus blocks with direct Google Calendar links and RFC 5545 `.ics` downloads.
11. **TC-DAG-11 (Action DAG Checklist)**: Task dependency graphs with time estimates and live Firestore synchronization.

