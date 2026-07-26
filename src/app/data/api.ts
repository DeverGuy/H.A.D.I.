import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firestore";
import type { GemData, PlaceData } from "../engine/types";
import { allGems } from "./gems"; // Fallback
import { allPlaces } from "./places"; // Fallback

export function useGems() {
  return useQuery({
    queryKey: ["gems"],
    queryFn: async () => {
      try {
        const snap = await getDocs(collection(db, "gems"));
        if (snap.empty) {
          // Fallback to local data if Firestore is empty
          return allGems;
        }
        return snap.docs.map(doc => doc.data() as GemData);
      } catch (e) {
        console.error("Failed to fetch gems from Firestore", e);
        return allGems; // Fallback for local testing without Firebase setup
      }
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

export function usePlaces() {
  return useQuery({
    queryKey: ["places"],
    queryFn: async () => {
      try {
        const snap = await getDocs(collection(db, "places"));
        if (snap.empty) {
          return allPlaces;
        }
        return snap.docs.map(doc => doc.data() as PlaceData);
      } catch (e) {
        console.error("Failed to fetch places from Firestore", e);
        return allPlaces;
      }
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

// Helper for pure engine functions that need to fetch dynamically 
// (or we can just pass the data through arguments, which is preferred)
export async function fetchAllGems(): Promise<GemData[]> {
  try {
    const snap = await getDocs(collection(db, "gems"));
    if (snap.empty) return allGems;
    return snap.docs.map(doc => doc.data() as GemData);
  } catch {
    return allGems;
  }
}
