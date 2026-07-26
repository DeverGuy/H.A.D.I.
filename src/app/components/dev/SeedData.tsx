import { useState } from "react";
import { collection, writeBatch, doc } from "firebase/firestore";
import { db } from "../../lib/firestore";
import { allGems } from "../../data/gems";
import { allPlaces } from "../../data/places";
import { Button } from "../ui/button";

export function SeedData() {
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSeed = async () => {
    setSeeding(true);
    setResult("Seeding started...");
    
    try {
      const batch = writeBatch(db);
      
      // Seed Gems
      for (const gem of allGems) {
        const gemRef = doc(collection(db, "gems"), gem.id.toString());
        batch.set(gemRef, gem);
      }

      // Seed Places (if they exist)
      for (const place of allPlaces) {
        const placeRef = doc(collection(db, "places"), place.id);
        batch.set(placeRef, place);
      }

      await batch.commit();
      setResult("Successfully seeded all gems and places to Firestore!");
    } catch (err: any) {
      console.error(err);
      setResult(`Failed to seed: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="p-4 bg-yellow-100 border border-yellow-400 rounded-lg shadow-md my-4 flex flex-col items-start gap-2">
      <h3 className="text-lg font-bold text-yellow-800">Dev Tool: Seed Firestore</h3>
      <p className="text-sm text-yellow-700">Click below to upload the hardcoded gems and places to your Firebase Firestore database.</p>
      <Button 
        onClick={handleSeed} 
        disabled={seeding}
        className="bg-yellow-600 hover:bg-yellow-700 text-white"
      >
        {seeding ? "Seeding..." : "Seed Data Now"}
      </Button>
      {result && <p className="text-sm font-medium text-black mt-2">{result}</p>}
    </div>
  );
}
