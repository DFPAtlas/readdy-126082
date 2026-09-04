// ============================================================================
// Wallboard — office weather source.
//
// Smallest clean integration point: Open-Meteo (free, no API key, CORS-open).
// City-level coordinates come from `WALLBOARD_LOCATION`. No live values are
// invented — on any failure the strip simply reports "Weather unavailable".
//
// If a more precise office source becomes available (Home Assistant, Met
// Office, a private weather endpoint), swap `fetchWallboardWeather` here and
// the rest of the strip is unaffected.
// ============================================================================

import { WALLBOARD_LOCATION } from '@/pages/ai-operations/wallboard/wallboardLocation';

export type WallboardWeatherSource = 'live' | 'unavailable';

export interface WallboardWeather {
  condition: string | null;
  temperature: number | null;
  high: number | null;
  low: number | null;
  updatedAt: Date | null;
  sourceStatus: WallboardWeatherSource;
}

// WMO weather-interpretation codes → human-readable condition text.
const WMO_CONDITIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Light freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
};

function unavailable(): WallboardWeather {
  return {
    condition: null,
    temperature: null,
    high: null,
    low: null,
    updatedAt: null,
    sourceStatus: 'unavailable',
  };
}

// Module-level snapshot of the most recent weather result. Shared read-only
// surface for the diagnostics layer — the Office Info Strip continues to own
// its own timer/state and is unaffected.
let weatherSnapshot: WallboardWeather = unavailable();

/** Synchronous read of the last weather fetch result (for diagnostics only). */
export function getWallboardWeatherSnapshot(): WallboardWeather {
  return weatherSnapshot;
}

export async function fetchWallboardWeather(): Promise<WallboardWeather> {
  const { latitude, longitude, timezone } = WALLBOARD_LOCATION;
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latitude}` +
    `&longitude=${longitude}` +
    `&current=temperature_2m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&forecast_days=1` +
    `&timezone=${encodeURIComponent(timezone)}`;

  let result: WallboardWeather;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      result = unavailable();
    } else {
      const json = (await res.json()) as {
        current?: { temperature_2m?: number; weather_code?: number };
        daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
      };

      const temperature = typeof json.current?.temperature_2m === 'number' ? json.current.temperature_2m : null;
      const code = json.current?.weather_code;
      const high = typeof json.daily?.temperature_2m_max?.[0] === 'number' ? json.daily.temperature_2m_max[0] : null;
      const low = typeof json.daily?.temperature_2m_min?.[0] === 'number' ? json.daily.temperature_2m_min[0] : null;

      result = {
        condition: code != null ? (WMO_CONDITIONS[code] ?? 'Unknown') : null,
        temperature,
        high,
        low,
        updatedAt: new Date(),
        sourceStatus: 'live',
      };
    }
  } catch {
    result = unavailable();
  }

  weatherSnapshot = result;
  return result;
}