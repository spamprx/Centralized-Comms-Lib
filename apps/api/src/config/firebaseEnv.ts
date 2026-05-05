type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

type FirebaseClientEnv = {
  config: FirebasePublicConfig;
  vapidKey: string;
};

function requiredEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export function getFirebaseClientEnv(): FirebaseClientEnv | null {
  const apiKey = requiredEnv("FIREBASE_API_KEY");
  const authDomain = requiredEnv("FIREBASE_AUTH_DOMAIN");
  const projectId = requiredEnv("FIREBASE_PROJECT_ID");
  const storageBucket = requiredEnv("FIREBASE_STORAGE_BUCKET");
  const messagingSenderId = requiredEnv("FIREBASE_MESSAGING_SENDER_ID");
  const appId = requiredEnv("FIREBASE_APP_ID");
  const vapidKey = requiredEnv("FIREBASE_WEB_PUSH_VAPID_KEY");

  if (
    !apiKey ||
    !authDomain ||
    !projectId ||
    !storageBucket ||
    !messagingSenderId ||
    !appId ||
    !vapidKey
  ) {
    return null;
  }

  const measurementId = requiredEnv("FIREBASE_MEASUREMENT_ID");
  return {
    config: {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
      ...(measurementId ? { measurementId } : {}),
    },
    vapidKey,
  };
}
