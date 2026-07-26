import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { verifyCheckin, VerifyCheckinInput } from "./engine/checkin";

admin.initializeApp();

export const doCheckin = functions.https.onCall(async (request) => {
  // In a fully secure app (Phase 2), we would fetch stats, recentRecords, 
  // and weather from Firestore using request.auth.uid.
  // For now, we accept them from the client payload to decouple the logic.
  
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to check in."
    );
  }

  const input = request.data as VerifyCheckinInput;

  // Ensure the user is only checking in for themselves
  if (input.stats?.userId !== request.auth.uid) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You cannot check in for another user."
    );
  }

  try {
    const result = verifyCheckin(input);
    return result;
  } catch (error) {
    throw new functions.https.HttpsError(
      "internal",
      error instanceof Error ? error.message : "Checkin verification failed."
    );
  }
});
