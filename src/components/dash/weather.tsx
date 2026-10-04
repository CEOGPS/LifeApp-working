import { useEffect, useState } from "react";
import { Droplets, Sun, Wind } from "lucide-react";
import { fmtDate, fmtTime } from "./format";

type Day = { date: string; code: number; hi: number; lo: number };
type Now = {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
  location: string;
  code: number;
  isDay: boolean;
  days: Day[];
};

function iconFor(code: number, isDay = true) {
  const dn = isDay ? "day" : "night";
  let name = "cloudy";
  if (code === 0) name = `clear-${dn}`;
  else if (code === 1 || code === 2) name = `partly-cloudy-${dn}`;
  else if (code === 3) name = `overcast-${dn}`;
  else if (code === 45 || code === 48) name = `fog-${dn}`;
  else if ([51, 53, 55].includes(code)) name = "drizzle";
  else if ([61, 63, 65, 80, 81, 82].includes(code)) name = "rain";
  else if ([71, 73, 75, 77, 85, 86].includes(code)) name = "snow";
  else if ([95, 96, 99].includes(code)) name = "thunderstorms-day-rain";
  return `/weather/${name}.svg`;
}

function labelFor(code: number) {
  if (code === 0) return "Clear";
  if (code === 1) return "Partly cloudy";
  if (code === 2) return "Mostly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Cloudy";
}

export function WeatherClock() {
  const [time, setTime] = useState(() => new Date());
  const [weather, setWeather] = useState<Now | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({
      latitude: "33.749",
      longitude: "-84.388",
      current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,uv_index,is_day",
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      forecast_days: "6",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      timezone: "America/New_York",
    });
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
      .then((response) => response.json())
      .then((data) => {
        const cur = data?.current;
        const daily = data?.daily;
        if (!cur) return;
        const days: Day[] = Array.isArray(daily?.time)
          ? daily.time.slice(1, 6).map((date: string, index: number) => ({
              date,
              code: daily.weather_code[index + 1],
              hi: Math.round(daily.temperature_2m_max[index + 1]),
              lo: Math.round(daily.temperature_2m_min[index + 1]),
            }))
          : [];
        setWeather({
          temperature: Math.round(cur.temperature_2m),
          condition: labelFor(cur.weather_code),
          humidity: cur.relative_humidity_2m,
          windSpeed: Math.round(cur.wind_speed_10m),
          uvIndex: Math.round(cur.uv_index || 0),
          location: "Atlanta, Georgia, United States",
          code: cur.weather_code,
          isDay: cur.is_day !== 0,
          days,
        });
      })
      .catch(() => setWeather(null));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="font-display text-5xl tracking-widest text-white">{fmtTime(time)}</p>
        <p className="mt-1 font-display text-sm tracking-[0.2em] text-white/40">{time.toLocaleDateString("en-US", { weekday: "long" })}</p>
        <p className="text-base text-white/60">{fmtDate(time)}</p>
      </div>
      <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">
        {weather ? (
          <>
            <div className="flex items-center justify-center gap-6">
              <img src={iconFor(weather.code, weather.isDay)} alt="" width={84} height={84} />
              <div className="text-center">
                <p className="font-display text-5xl">{weather.temperature}°F</p>
                <p className="text-sm text-white/60">{weather.condition}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-around border-t border-white/10 pt-4">
              <p className="text-center text-sm"><Droplets size={12} className="mx-auto text-blue-2" />Humidity<span className="mt-1 block font-display text-xl">{weather.humidity}%</span></p>
              <p className="text-center text-sm"><Wind size={12} className="mx-auto text-green" />Wind<span className="mt-1 block font-display text-xl">{weather.windSpeed} mph</span></p>
              <p className="text-center text-sm"><Sun size={12} className="mx-auto glow-amber" />UV<span className="mt-1 block font-display text-xl">{weather.uvIndex}</span></p>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1 border-t border-white/10 pt-3">
              {weather.days.map((day) => (
                <div key={day.date} className="flex flex-col items-center">
                  <span className="text-ember font-display text-[11px]">{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span>
                  <img src={iconFor(day.code)} alt="" width={32} height={32} />
                  <span className="text-xs">{day.hi}° <span className="text-white/35">{day.lo}°</span></span>
                </div>
              ))}
            </div>
            <p className="text-ember mt-3 text-center font-display text-[11px]">{weather.location} · Open-Meteo</p>
          </>
        ) : (
          <p className="text-center text-sm text-white/50">Loading Atlanta weather</p>
        )}
      </div>
    </div>
  );
}
