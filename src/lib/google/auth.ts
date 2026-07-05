import { GoogleAuth } from "google-auth-library";
import fs from "fs";
import path from "path";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function loadCredentials() {
  // v10 #6.1: Vercel's filesystem is read-only at runtime and credentials.json
  // must never be committed to the repo — the whole service-account JSON is
  // base64-encoded into a single env var instead (see the README/deploy notes
  // for the PowerShell/bash one-liner that produces this value).
  const base64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (base64) {
    return JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (email && key) {
    return {
      client_email: email,
      private_key: key.replace(/\\n/g, "\n"),
    };
  }

  // Local dev only — reads the gitignored credentials.json file directly.
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS_PATH ?? "./credentials.json";
  const fullPath = path.isAbsolute(credPath) ? credPath : path.join(process.cwd(), credPath);
  const raw = fs.readFileSync(fullPath, "utf-8");
  return JSON.parse(raw);
}

let authClient: GoogleAuth | null = null;

export function getGoogleAuth(): GoogleAuth {
  if (!authClient) {
    const credentials = loadCredentials();
    authClient = new GoogleAuth({ credentials, scopes: SCOPES });
  }
  return authClient;
}
