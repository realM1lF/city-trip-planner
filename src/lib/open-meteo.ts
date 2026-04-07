/** Open-Meteo (https://open-meteo.com) — kein API-Key; Attribution im UI. */

const OPEN_METEO_FETCH_TIMEOUT_MS = 18_000;
const OPEN_METEO_MAX_ATTEMPTS = 3;

/** Archiv (Vergangenheit). */
const OPEN_METEO_ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1/archive";
/**
 * Vorhersage: eigener Host — `api.open-meteo.com` liefert häufig 502/504 (nginx),
 * das Historical-Forecast-Gateway ist in der Praxis stabiler und gleiches JSON.
 */
const OPEN_METEO_FORECAST_BASE =
  "https://historical-forecast-api.open-meteo.com/v1/forecast";
/** Fallback, falls das Historical-Gateway ausfällt. */
const OPEN_METEO_FORECAST_FALLBACK_BASE = "https://api.open-meteo.com/v1/forecast";

/** Kalendertag in Europe/Berlin (wie Open-Meteo `timezone`) — auch auf dem Server korrekt. */
export function berlinCalendarDateISO(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (y && m && day) return `${y}-${m}-${day}`;
  return localDateISO(d);
}

export type DayWeatherSnapshot = {
  date: string;
  weatherCode: number;
  tempMin: number;
  tempMax: number;
  /** Nur Vorhersage; bei Archiv null */
  precipChanceMax: number | null;
};

export function localDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dailyIndex(times: string[], wanted: string): number {
  return times.indexOf(wanted);
}

function parseDailyPayload(
  json: unknown,
  dateISO: string
): DayWeatherSnapshot | null {
  if (!json || typeof json !== "object") return null;
  const rec = json as Record<string, unknown>;
  const daily = rec.daily;
  if (!daily || typeof daily !== "object") return null;
  const drec = daily as Record<string, unknown>;
  const time = drec.time;
  if (!Array.isArray(time) || time.length === 0) return null;
  const idx = dailyIndex(time as string[], dateISO);
  if (idx < 0) return null;

  const codeRaw = drec.weather_code ?? drec.weathercode;
  const tMin = drec.temperature_2m_min;
  const tMax = drec.temperature_2m_max;
  const precip = drec.precipitation_probability_max;
  if (!Array.isArray(codeRaw) || !Array.isArray(tMin) || !Array.isArray(tMax)) {
    return null;
  }
  const weatherCode = codeRaw[idx];
  const tempMin = tMin[idx];
  const tempMax = tMax[idx];
  if (
    typeof weatherCode !== "number" ||
    typeof tempMin !== "number" ||
    typeof tempMax !== "number"
  ) {
    return null;
  }
  let precipChanceMax: number | null = null;
  if (Array.isArray(precip) && typeof precip[idx] === "number") {
    precipChanceMax = precip[idx] as number;
  }
  return {
    date: dateISO,
    weatherCode,
    tempMin,
    tempMax,
    precipChanceMax,
  };
}

async function fetchOpenMeteoJson(url: string): Promise<unknown> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < OPEN_METEO_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 450 * attempt));
    }
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(OPEN_METEO_FETCH_TIMEOUT_MS),
      });
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        lastError = new Error(`Ungültige Antwort (HTTP ${res.status})`);
        if (
          attempt < OPEN_METEO_MAX_ATTEMPTS - 1 &&
          (res.status === 502 || res.status === 503 || res.status === 504)
        ) {
          continue;
        }
        throw lastError;
      }
      if (typeof json === "object" && json !== null) {
        const o = json as Record<string, unknown>;
        if (o.error === true && typeof o.reason === "string") {
          throw new Error(o.reason);
        }
      }
      const retryableHttp =
        res.status === 502 || res.status === 503 || res.status === 504;
      if (retryableHttp && attempt < OPEN_METEO_MAX_ATTEMPTS - 1) {
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return json;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const isClientErr = lastError.message.startsWith("HTTP 4");
      if (isClientErr) throw lastError;
      if (attempt < OPEN_METEO_MAX_ATTEMPTS - 1) {
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error("Open-Meteo-Abruf fehlgeschlagen");
}

export async function fetchDayWeatherOpenMeteo(
  lat: number,
  lng: number,
  dateISO: string
): Promise<DayWeatherSnapshot | null> {
  const today = berlinCalendarDateISO();
  const useArchive = dateISO < today;

  if (useArchive) {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      start_date: dateISO,
      end_date: dateISO,
      timezone: "Europe/Berlin",
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
    });
    const url = `${OPEN_METEO_ARCHIVE_BASE}?${params.toString()}`;
    const json = await fetchOpenMeteoJson(url);
    return parseDailyPayload(json, dateISO);
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    forecast_days: "16",
    timezone: "Europe/Berlin",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  });
  const query = params.toString();

  let lastErr: Error | null = null;
  for (const base of [
    OPEN_METEO_FORECAST_BASE,
    OPEN_METEO_FORECAST_FALLBACK_BASE,
  ]) {
    try {
      const json = await fetchOpenMeteoJson(`${base}?${query}`);
      return parseDailyPayload(json, dateISO);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("Open-Meteo Vorhersage nicht erreichbar");
}

/** Kurzbeschreibung gemäß WMO-Wettercode (Open-Meteo). */
export function weatherCodeSummaryDe(code: number): string {
  if (code === 0) return "Klar";
  if (code === 1) return "Überwiegend klar";
  if (code === 2) return "Teilweise bewölkt";
  if (code === 3) return "Bewölkt";
  if (code === 45 || code === 48) return "Nebel";
  if (code >= 51 && code <= 55) return "Nieselregen";
  if (code === 56 || code === 57) return "Gefrierender Niesel";
  if (code >= 61 && code <= 65) return "Regen";
  if (code === 66 || code === 67) return "Gefrierender Regen";
  if (code >= 71 && code <= 77) return "Schnee";
  if (code >= 80 && code <= 82) return "Regenschauer";
  if (code === 85 || code === 86) return "Schneeschauer";
  if (code >= 95 && code <= 99) return "Gewitter";
  return "Wechselhaft";
}
