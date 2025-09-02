# Frontend Auth + Upload Test

1) Configure frontend/.env
   VITE_API_BASE_URL=http://localhost:8080
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id

2) Firebase Console:
   - Enable Authentication → Sign-in methods: Google and/or Email/Password
   - Add http://localhost:5173 to Authorized domains

3) Backend .env (dev):
   PORT=8080
   CORS_ORIGIN=http://localhost:5173
   FIREBASE_PROJECT_ID=...
   FIREBASE_CLIENT_EMAIL=...
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   S3_BUCKET=...
   S3_REGION=...
   AWS_ACCESS_KEY_ID=...        # dev only
   AWS_SECRET_ACCESS_KEY=...    # dev only
   KMS_KEY_ID=...

4) S3 CORS (see infra/aws/s3-cors.json). Apply in S3 console.

5) Run:
   # terminal A
   cd backend && npm i && npm run dev
   # terminal B
   cd ../frontend && npm i && npm run dev
   Open http://localhost:5173

6) Flow:
   - Sign in
   - Choose a small file
   - Click "Presign & Upload"
   - Expect: "✅ Uploaded: s3://<key>"
