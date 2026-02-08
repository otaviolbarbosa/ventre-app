import admin from "firebase-admin";

function getFirebaseAdmin() {
  if (admin.apps.length > 0) return admin;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });

  return admin;
}

export async function sendPushNotification(
  token: string,
  payload: { title: string; body: string; data?: Record<string, string> },
) {
  const firebaseAdmin = getFirebaseAdmin();

  return firebaseAdmin.messaging().send({
    token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data,
    webpush: {
      fcmOptions: {
        link: payload.data?.url || "/home",
      },
    },
  });
}

export async function sendMulticastNotification(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
) {
  if (tokens.length === 0) return { successCount: 0, failureCount: 0, invalidTokens: [] };

  const firebaseAdmin = getFirebaseAdmin();

  const response = await firebaseAdmin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data,
    webpush: {
      fcmOptions: {
        link: payload.data?.url || "/home",
      },
    },
  });

  const invalidTokens: string[] = [];
  response.responses.forEach((resp, idx) => {
    if (
      !resp.success &&
      resp.error &&
      (resp.error.code === "messaging/registration-token-not-registered" ||
        resp.error.code === "messaging/invalid-registration-token")
    ) {
      const token = tokens[idx];
      if (token) invalidTokens.push(token);
    }
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens,
  };
}
