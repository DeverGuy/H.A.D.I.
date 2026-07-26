import type { WeatherData, WeatherCondition } from "./types";

// Mysuru Coordinates
const LAT = 12.2958;
const LON = 76.6394;

export async function fetchLiveWeather(): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,precipitation,weather_code,is_day&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const current = data.current;

    if (!current) return null;

    return {
      condition: mapWmoToCondition(current.weather_code),
      temperature: current.temperature_2m,
      precipitationChance: current.precipitation > 0 ? 100 : 0, // Simplified since precipitation is mm, not %
      uvIndex: current.is_day ? 5 : 0 // Approximated
    };
  } catch (e) {
    console.error("Failed to fetch live weather", e);
    return null;
  }
}

// Maps standard WMO Weather Codes to our HADI types
function mapWmoToCondition(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "partly_cloudy";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77].includes(code)) return "light_rain";
  if ([80, 81, 82, 85, 86].includes(code)) return "heavy_rain";
  if ([95, 96, 99].includes(code)) return "heavy_thunderstorm";
  return "clear"; // Fallback
}

export function getWeatherMatchReason(gemWeatherType: string, currentCondition: WeatherCondition): { match: boolean, reason: string } {
  if (currentCondition === "heavy_rain" || currentCondition === "heavy_thunderstorm") {
    if (gemWeatherType === "INDOOR_SAFE") return { match: true, reason: "☔ Perfect for Rainy Weather" };
    if (gemWeatherType === "OUTDOOR_EXPOSED") return { match: false, reason: "⚠️ Not recommended in heavy rain" };
  }
  
  if (currentCondition === "clear" || currentCondition === "partly_cloudy") {
    if (gemWeatherType === "OUTDOOR_EXPOSED") return { match: true, reason: "☀️ Great weather for outdoor exploring" };
  }
  
  return { match: true, reason: "👍 Good to visit" };
}

export function calculateSuitabilityMultiplier(weather: WeatherData, profile: any): number {
  if (profile.idealConditions.includes(weather.condition)) return 1.5;
  if (profile.riskConditions.includes(weather.condition)) return 0.5;
  return 1.0;
}

export function getWeatherChoicePrompt(condition: WeatherCondition): string {
  if (condition === "clear" || condition === "partly_cloudy") return "☀️ Sunny day! Perfect for outdoor gems.";
  if (condition === "light_rain") return "🌦️ Light rain. Don't forget your umbrella.";
  if (condition === "heavy_rain" || condition === "heavy_thunderstorm") return "☔ Heavy rain! Better explore indoor gems.";
  return "Enjoy your exploration!";
}
