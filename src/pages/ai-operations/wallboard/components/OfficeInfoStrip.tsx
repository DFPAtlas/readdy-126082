import { useEffect, useState } from 'react';
import { WALLBOARD_LOCATION } from '@/pages/ai-operations/wallboard/wallboardLocation';
import { fetchWallboardWeather, type WallboardWeather } from '@/pages/ai-operations/wallboard/weather';
import type { WallboardClockFormat } from '@/pages/ai-operations/wallboard/wallboardSettings';

// Weather refreshes far less often than operational metrics (configurable), and
// the clock reuses the page's existing once-per-second `now` — so this strip
// never triggers a full wallboard data reload on its own.
const WEATHER_STALE_MS = 30 * 60 * 1000;

interface OfficeInfoStripProps {
  now: Date;
  clockFormat: WallboardClockFormat;
  weatherIntervalSeconds: number;
}

export default function OfficeInfoStrip({ now, clockFormat, weatherIntervalSeconds }: OfficeInfoStripProps) {
  const [weather, setWeather] = useState<WallboardWeather | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await fetchWallboardWeather();
      if (!cancelled) setWeather(result);
    };
    void load();
    const id = setInterval(() => void load(), weatherIntervalSeconds * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [weatherIntervalSeconds]);

  const tz = WALLBOARD_LOCATION.timezone;
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'short', timeZone: tz }).toUpperCase();
  const day = now.toLocaleDateString('en-GB', { day: '2-digit', timeZone: tz });
  const month = now.toLocaleDateString('en-GB', { month: 'short', timeZone: tz }).toUpperCase();
  const year = now.toLocaleDateString('en-GB', { year: 'numeric', timeZone: tz });
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: clockFormat === '12h', timeZone: tz });

  const hasWeather = weather?.sourceStatus === 'live';
  const stale =
    hasWeather && weather?.updatedAt != null && Date.now() - weather.updatedAt.getTime() > WEATHER_STALE_MS;
  const temp = weather?.temperature != null ? `${Math.round(weather.temperature)}°C` : null;
  const condition = weather?.condition ?? null;
  const range =
    weather?.high != null && weather?.low != null
      ? `H ${Math.round(weather.high)}° / L ${Math.round(weather.low)}°`
      : null;

  return (
    <div className="shrink-0 flex items-center gap-5 px-5 py-1.5 border-b border-background-200/40 bg-background-100/40 text-foreground-600 whitespace-nowrap overflow-hidden">
      <div className="flex items-center gap-2 text-xs font-label">
        <span className="font-semibold text-foreground-300 tabular-nums">
          {weekday} {day} {month} {year}
        </span>
        <span className="text-foreground-300 tabular-nums">{time}</span>
      </div>

      <span className="text-foreground-300/40 select-none">|</span>

      <div className="flex items-center gap-1.5 text-xs font-label">
        <i className="ri-map-pin-2-line w-3.5 h-3.5 flex items-center justify-center text-foreground-500"></i>
        <span className="text-foreground-500">{WALLBOARD_LOCATION.label}</span>
      </div>

      <span className="text-foreground-300/40 select-none">|</span>

      <div className="flex items-center gap-2 text-xs font-label">
        {!hasWeather ? (
          <span className="text-foreground-500">Weather unavailable</span>
        ) : (
          <>
            {temp && <span className="font-semibold text-foreground-300 tabular-nums">{temp}</span>}
            {condition && <span className="uppercase tracking-wide text-foreground-500">{condition}</span>}
            {range && <span className="text-foreground-500 tabular-nums">{range}</span>}
            {stale && (
              <span className="inline-flex items-center gap-1 text-amber-500 font-semibold uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Stale
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}