import { useEffect, type ReactNode } from "react";
import { Shell } from "./shell";
import { useMemory } from "./memory";

export function Frame({ active, children }: { active: string; children: ReactNode }) {
  const { data, update, status } = useMemory();
  useEffect(() => {
    void import("@/lib/lifeos/env-keys").then(({ loadEnvKeys }) => loadEnvKeys()).then((rows) => {
      if (!rows?.length) return;
      update((prev) => {
        const keys = [...prev.keys];
        for (const row of rows) {
          const found = keys.find((item) => item.name === row.name);
          if (found?.value) continue;
          if (found) found.value = row.value;
          else keys.unshift({ id: row.name, name: row.name, value: row.value });
        }
        return { ...prev, keys };
      });
    }).catch(() => undefined);
  }, [update]);
  return (
    <Shell
      active={active}
      banner={data.banner}
      logo={data.logo}
      onBanner={(banner) => update((prev) => ({ ...prev, banner }))}
      onLogo={(logo) => update((prev) => ({ ...prev, logo }))}
      status={status}
    >
      {children}
    </Shell>
  );
}
