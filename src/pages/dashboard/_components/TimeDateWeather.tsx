import { useEffect, useState } from "react";
import { Cloud, CloudRain, Sun, Wind, Droplets } from "lucide-react";
// PATCH (home-page2): realistic Meteocons "fill" weather icons (MIT, Bas Milius,
// public/weather/*.svg, static files, no dependency) + a real 5-day forecast.

const CITY = "Atlanta";

async function geoLookup(
  q: string,
): Promise<{ lat: number; lon: number; name: string } | null> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  const hit = data?.results?.[0];
  if (!hit) return null;
  const parts = [hit.name, hit.admin1, hit.country].filter(Boolean);
  return {
    lat: hit.latitude,
    lon: hit.longitude,
    name: parts.join(", "),
  };
}

async function fetchWeatherData(lat: number, lon: number): Promise<any> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,uv_index,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    forecast_days: "6",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "auto",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
  return response.json();
}

/** Meteocons icon for a WMO weather code (open-meteo). */
export function meteoconFor(code: number, isDay = true): string {
  const dn = isDay ? "day" : "night";
  let name: string;
  if (code === 0) name = `clear-${dn}`;
  else if (code === 1 || code === 2) name = `partly-cloudy-${dn}`;
  else if (code === 3) name = `overcast-${dn}`;
  else if (code === 45 || code === 48) name = `fog-${dn}`;
  else if ([51, 53, 55].includes(code)) name = "drizzle";
  else if ([56, 57, 66, 67].includes(code)) name = "sleet";
  else if ([61, 63].includes(code)) name = "rain";
  else if (code === 65 || code === 82) name = "extreme-rain";
  else if (code === 80 || code === 81) name = isDay ? "partly-cloudy-day-rain" : "rain";
  else if ([71, 73, 77].includes(code)) name = "snow";
  else if (code === 75 || code === 86) name = "extreme-snow";
  else if (code === 85) name = isDay ? "partly-cloudy-day-snow" : "snow";
  else if (code === 95) name = `thunderstorms-${dn}-rain`;
  else if (code === 96 || code === 99) name = "hail";
  else name = "cloudy";
  return `/weather/${name}.svg`;
}

function WeatherIcon({ code, isDay = true, size, title }: { code: number; isDay?: boolean; size: number; title?: string }) {
  return (
    <img
      src={meteoconFor(code, isDay)}
      alt={title || "weather"}
      title={title}
      width={size}
      height={size}
      draggable={false}
      data-weather-icon=""
      style={{ width: size, height: size, filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.55))" }}
    />
  );
}

type Day = { date: string; code: number; hi: number; lo: number };

function conditionFromCode(code: number): {
  text: string;
  emoji: string;
  icon: React.ReactNode;
} {
  if (code === 0) return { text: "Clear", emoji: "☀️", icon: <Sun size={48} className="text-yellow-400 drop-shadow-[0_0_20px_rgba(255,200,0,0.6)]" /> };
  if ([1, 2, 3].includes(code)) {
    if (code === 1) return { text: "Partly Cloudy", emoji: "🌤️", icon: <Cloud size={48} className="text-yellow-400" /> };
    if (code === 2) return { text: "Mostly Cloudy", emoji: "☁️", icon: <Cloud size={48} className="text-white/60" /> };
    return { text: "Overcast", emoji: "☁️", icon: <Cloud size={48} className="text-white/50" /> };
  }
  if ([45, 48].includes(code)) return { text: "Fog", emoji: "🌫️", icon: <Cloud size={48} className="text-white/40" /> };
  if ([51, 53, 55, 56, 57].includes(code)) return { text: "Drizzle", emoji: "🌧️", icon: <CloudRain size={48} className="text-blue-400" /> };
  if ([61, 63, 65, 66, 67].includes(code)) return { text: "Rain", emoji: "🌧️", icon: <CloudRain size={48} className="text-blue-400 drop-shadow-[0_0_20px_rgba(100,150,255,0.6)]" /> };
  if ([71, 73, 75, 77].includes(code)) return { text: "Snow", emoji: "❄️", icon: <CloudRain size={48} className="text-blue-300" /> };
  if ([80, 81, 82].includes(code)) return { text: "Rain Showers", emoji: "🌧️", icon: <CloudRain size={48} className="text-blue-400" /> };
  if ([85, 86].includes(code)) return { text: "Snow Showers", emoji: "❄️", icon: <CloudRain size={48} className="text-blue-300" /> };
  if ([95, 96, 99].includes(code)) return { text: "Thunderstorm", emoji: "⛈️", icon: <CloudRain size={48} className="text-yellow-400 drop-shadow-[0_0_20px_rgba(255,200,0,0.6)]" /> };
  return { text: "Unknown", emoji: "☁️", icon: <Cloud size={48} className="text-white/50" /> };
}

export default function TimeDateWeather() {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState<{
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    uvIndex: number;
    emoji: string;
    icon: React.ReactNode;
    location: string;
    code: number;
    isDay: boolean;
    days: Day[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchWeather = async () => {
      setLoading(true);
      setError(null);

      try {
        const geo = await geoLookup(CITY);
        if (!geo) throw new Error("Could not locate city");

        const data = await fetchWeatherData(geo.lat, geo.lon);
        const cur = data?.current;
        if (!cur) throw new Error("No weather data");

        if (!cancelled) {
          const cond = conditionFromCode(cur.weather_code);
          const d = data?.daily;
          const days: Day[] = Array.isArray(d?.time)
            ? d.time.slice(1, 6).map((t: string, i: number) => ({
                date: t,
                code: d.weather_code[i + 1],
                hi: Math.round(d.temperature_2m_max[i + 1]),
                lo: Math.round(d.temperature_2m_min[i + 1]),
              }))
            : [];
          setWeather({
            temperature: Math.round(cur.temperature_2m),
                        condition: cond.text,
                        humidity: cur.relative_humidity_2m,
                        windSpeed: Math.round(cur.wind_speed_10m),
                        uvIndex: Math.round(cur.uv_index || 0),
                        emoji: cond.emoji,
                        icon: cond.icon,
                        location: geo.name,
                        code: cur.weather_code,
                        isDay: cur.is_day !== 0,
                        days,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch weather");
          console.warn("[TimeDateWeather] Weather fetch failed:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const hours24 = time.getHours();
    const mins = time.getMinutes().toString().padStart(2, "0");
    const secs = time.getSeconds().toString().padStart(2, "0");
    const dayName = days[time.getDay()];
    const dateStr = `${months[time.getMonth()]} ${time.getDate()}, ${time.getFullYear()}`;

    // Convert to 12-hour format
    const ampm = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;
    const hours = hours12.toString().padStart(2, "0");

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Time - Large digital signage style */}
            <div className="text-center">
              <div className="font-display text-6xl text-white/95 tracking-widest text-glow">
                {hours}:{mins}
                <span className="text-3xl text-primary/90 ml-1">{secs}</span>
                <span className="text-xl text-primary/70 ml-2">{ampm}</span>
              </div>
        <div className="text-sm text-white/40 tracking-[0.2em] font-display mt-1">
          {dayName}
        </div>
        <div className="text-base text-white/60 tracking-wider mt-0.5">
          {dateStr}
        </div>
      </div>

      {/* Weather - Digital signage style with large emoji */}
      <div className="glass-crimson rounded-lg p-4">
        {loading && !weather ? (
          <div className="flex items-center justify-center gap-3">
            <img src="/weather/clear-day.svg" alt="" width={36} height={36} />
            <div className="text-white/60 text-sm">Loading weather...</div>
          </div>
        ) : error && !weather ? (
          <div className="flex items-center justify-center gap-3 text-center">
            <img src="/weather/cloudy.svg" alt="" width={36} height={36} />
            <div>
              <div className="text-white/40 text-sm">Weather unavailable</div>
              <div className="text-[10px] text-white/20 mt-1">{error}</div>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-[10px] text-primary/60 hover:text-primary font-display tracking-wider underline"
              >
                Retry
              </button>
            </div>
          </div>
        ) : weather ? (
          <>
            <div className="flex items-center justify-center gap-6">
              <WeatherIcon code={weather.code} isDay={weather.isDay} size={96} title={weather.condition} />
              <div className="text-center">
                <div className="text-5xl text-white/95 font-display">{weather.temperature}°F</div>
                <div className="text-sm text-white/60 capitalize mt-1">{weather.condition}</div>
              </div>
            </div>

            <div className="flex justify-around mt-4 border-t border-white/5 pt-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Droplets size={12} className="text-blue-400" />
                  <span className="text-[11px] text-white/40">Humidity</span>
                </div>
                <div className="text-xl text-white/80 font-display">{weather.humidity}%</div>
              </div>
              <div className="text-center">
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <Wind size={12} className="text-teal-400" />
                                <span className="text-[11px] text-white/40">Wind</span>
                              </div>
                              <div className="text-xl text-white/80 font-display">{weather.windSpeed} mph</div>
                            </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Sun size={12} className="text-orange-400" />
                  <span className="text-[11px] text-white/40">UV</span>
                </div>
                <div className="text-xl text-white/80 font-display">{weather.uvIndex}</div>
              </div>
            </div>

            {weather.days.length > 0 && (
              <div className="grid grid-cols-5 gap-1 mt-3 border-t border-white/5 pt-3">
                {weather.days.map((d) => (
                  <div key={d.date} className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-white/40 font-display tracking-wider">
                      {new Date(d.date + "T12:00:00").toLocaleDateString([], { weekday: "short" }).toUpperCase()}
                    </span>
                    <WeatherIcon code={d.code} size={36} title={conditionFromCode(d.code).text} />
                    <span className="text-[11px] text-white/75">{d.hi}°<span className="text-white/30"> {d.lo}°</span></span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 text-center">
              <div className="text-[11px] text-white/30 font-display tracking-wider">{weather.location} · Open-Meteo</div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <img src="/weather/clear-day.svg" alt="" width={36} height={36} />
            <div>
              <div className="text-2xl text-white/80 font-display">--°F</div>
              <div className="text-[10px] text-white/30 tracking-wider">Loading weather</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}