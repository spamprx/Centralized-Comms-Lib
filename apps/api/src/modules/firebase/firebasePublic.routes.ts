import { Router, type Request, type Response } from "express";
import { getFirebaseClientEnv } from "../../config/firebaseEnv";

const router = Router();

router.get("/firebase-config", (_req: Request, res: Response) => {
  const firebase = getFirebaseClientEnv();
  if (!firebase) {
    res.status(503).json({ error: "Firebase messaging is not configured" });
    return;
  }
  res.status(200).json(firebase);
});

router.get("/firebase-messaging-sw.js", (_req: Request, res: Response) => {
  const firebase = getFirebaseClientEnv();
  if (!firebase) {
    res
      .status(503)
      .type("application/javascript")
      .send("/* Firebase messaging is not configured */");
    return;
  }
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://www.gstatic.com; connect-src 'self';",
  );
  res.setHeader("Service-Worker-Allowed", "/");
  res.type("application/javascript").send(`self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const API_CONFIG_ENDPOINT = "/api/v1/firebase-config";
let messagingReady = null;

async function ensureMessaging() {
  if (messagingReady) return messagingReady;
  messagingReady = (async () => {
    const response = await fetch(API_CONFIG_ENDPOINT, { credentials: "same-origin" });
    if (!response.ok) {
      throw new Error("Failed to load Firebase config");
    }
    const payload = await response.json();
    importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");
    firebase.initializeApp(payload.config);
    return firebase.messaging();
  })().catch((err) => {
    messagingReady = null;
    throw err;
  });
  return messagingReady;
}

ensureMessaging().catch(() => undefined);

self.addEventListener("push", (event) => {
  if (!event.data) return;
  event.waitUntil((async () => {
    try {
      await ensureMessaging();
    } catch (_) {
      // Messaging init failed; allow default push handling fallback.
    }
    let payload = null;
    try {
      payload = event.data.json();
    } catch (_) {
      try {
        payload = { notification: { body: event.data.text() } };
      } catch (_) {
        payload = null;
      }
    }

    const notification = payload && typeof payload === "object" ? payload.notification : null;
    const data = payload && typeof payload === "object" ? payload.data : null;
    const title =
      (notification && typeof notification.title === "string" && notification.title.trim()) ||
      (data && typeof data.title === "string" && data.title.trim()) ||
      "New update";
    const body =
      (notification && typeof notification.body === "string" && notification.body.trim()) ||
      (data && typeof data.body === "string" && data.body.trim()) ||
      "";
    if (!body) return;

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      client.postMessage({
        type: "push-received",
        payload: {
          title,
          body,
          data: typeof data === "object" && data ? data : {},
        },
      });
    }
    const hasVisibleClient = windows.some((client) => client.visibilityState === "visible");
    if (!hasVisibleClient) {
      await self.registration.showNotification(title, {
        body,
        data: typeof data === "object" && data ? data : {},
      });
    }
  })());
});`);
});

export default router;
