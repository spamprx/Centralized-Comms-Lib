import fs from "node:fs";
import path from "node:path";

type FirebaseServiceAccountEnv = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function requireEnv(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw && raw.length > 0 ? raw : null;
}

function parseServiceAccountJson(raw: string): FirebaseServiceAccountEnv | null {
  try {
    const parsed = JSON.parse(raw) as {
      project_id?: unknown;
      client_email?: unknown;
      private_key?: unknown;
    };
    const projectId = typeof parsed.project_id === "string" ? parsed.project_id.trim() : "";
    const clientEmail =
      typeof parsed.client_email === "string" ? parsed.client_email.trim() : "";
    const privateKeyRaw =
      typeof parsed.private_key === "string" ? parsed.private_key.trim() : "";
    if (projectId && clientEmail && privateKeyRaw) {
      return {
        projectId,
        clientEmail,
        privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function getFirebaseServiceAccountEnv(): FirebaseServiceAccountEnv | null {
  const candidatePaths = [
    requireEnv("FIREBASE_SERVICE_ACCOUNT_JSON_PATH"),
    "/run/secrets/firebase-admin.json",
  ].filter((v): v is string => Boolean(v));
  for (const p of candidatePaths) {
    try {
      const absolutePath = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
      const fileContent = fs.readFileSync(absolutePath, "utf8");
      const parsed = parseServiceAccountJson(fileContent);
      if (parsed) return parsed;
    } catch {
      // Try next candidate source.
    }
  }

  const jsonBlob = requireEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (jsonBlob) {
    const parsed = parseServiceAccountJson(jsonBlob);
    if (parsed) return parsed;
  }

  const projectId =
    requireEnv("FIREBASE_SERVICE_ACCOUNT_PROJECT_ID") ??
    requireEnv("FIREBASE_PROJECT_ID");
  const clientEmail = requireEnv("FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL");
  const privateKeyRaw = requireEnv("FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY");
  if (!projectId || !clientEmail || !privateKeyRaw) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
  };
}
