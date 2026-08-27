# Aura Reflections & Gemini Journal

A production-ready, user-authenticated personal reflection and stream-of-consciousness journaling application powered by **Gemini 3.6 Flash** and **Cloud Firestore**.

---

## 🏛️ System Architecture

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **User Identity** | Firebase Authentication | Secure federated login via Google Sign-In (zero password storage). |
| **Backend Database** | Cloud Firestore | User-isolated document storage for reflections, chats, and action items under `/users/{userId}/*`. |
| **AI Thought Partner** | Gemini 3.6 Flash API | Multi-turn conversational reflections, cognitive challenge prompts, and structured JSON synthesis. |
| **Secret Management** | Google Cloud Secret Manager / Env | Secure server-side isolation of `GEMINI_API_KEY`. |
| **Backend Runtime** | Express.js (Node.js) | Server proxy implementing resilient model fallback ladders and PII scrubbing. |

---

## 🔒 Security Architecture & Firestore Rules

All journal data is strictly owner-isolated using the following Cloud Firestore Security Rules:

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

## ⚡ Gemini Fallback Ladder

To prevent downtime from rate limits (`429`) or temporary model spikes (`503`), the server utilizes a resilient automated fallback ladder:

1. **Primary**: `gemini-3.6-flash`
2. **High-Availability**: `gemini-3.1-flash-lite`
3. **Dynamic Alias**: `gemini-flash-latest`
4. **Deep Reasoning**: `gemini-3.7-flash`

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

## 🧪 Verification Walkthrough

1. **Authentication**: Open the app and log in with Google Sign-In or Guest Preview.
2. **Journaling**: Click on inspiration starters or compose freeform reflections.
3. **Gemini Dialogue**: Ask Aura probing questions to unpack your thoughts in real-time.
4. **Structured Synthesis**: Click **Synthesize with Gemini** to generate an executive summary, key takeaways, and prioritized action items.
5. **Interactive Actions**: Check off completed action items directly in the UI.
6. **Archive & Search**: Filter entries by sentiment, tags, and search keywords in the History tab.
