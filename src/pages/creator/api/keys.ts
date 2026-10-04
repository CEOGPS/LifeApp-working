/**
 * Resolve creative API keys: Integrations vault (unlocked) first, then VITE_ env.
 */
import {
  getDecryptedKey,
  isKeyEncryptionUnlocked,
  serviceIdOf,
} from "@/platform/integrations/integrationsSupabase";

export type CreativeService =
  | "replicate"
  | "stability"
  | "elevenlabs"
  | "runway"
  | "luma"
  | "did"
  | "huggingface"
  | "openai"
  | "nvidia";

export const SERVICE_CATALOG: Record<
  CreativeService,
  { catalogName: string; envVite: string[]; vaultIds: string[] }
> = {
  replicate: {
    catalogName: "Replicate",
    envVite: ["VITE_REPLICATE_API_KEY"],
    vaultIds: ["replicate"],
  },
  stability: {
    catalogName: "Stability AI",
    envVite: ["VITE_STABILITY_AI_API_KEY"],
    vaultIds: ["stability-ai", "stability"],
  },
  elevenlabs: {
    catalogName: "ElevenLabs",
    envVite: ["VITE_ELEVENLABS_API_KEY"],
    vaultIds: ["elevenlabs", "elevenlabs-voice"],
  },
  runway: {
    catalogName: "Runway",
    envVite: ["VITE_RUNWAY_API_KEY"],
    vaultIds: ["runway", "runwav"],
  },
  luma: {
    catalogName: "Luma",
    envVite: ["VITE_LUMA_API_KEY"],
    vaultIds: ["luma", "luma-ai"],
  },
  did: {
    catalogName: "D-ID",
    envVite: ["VITE_DID_API_KEY"],
    vaultIds: ["d-id", "did"],
  },
  huggingface: {
    catalogName: "Hugging Face",
    envVite: ["VITE_HUGGINGFACE_API_KEY", "VITE_HF_TOKEN"],
    vaultIds: ["hugging-face", "huggingface"],
  },
  openai: {
    catalogName: "OpenAI",
    envVite: ["VITE_OPENAI_API_KEY"],
    vaultIds: ["openai"],
  },
  nvidia: {
    catalogName: "NVIDIA NIM",
    envVite: ["VITE_NVIDIA_API_KEY", "VITE_NVAPI_KEY"],
    vaultIds: ["nvidia-nim", "nvidia", "nvapi"],
  },
};

function envKey(names: string[]): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};
  for (const n of names) {
    const v = (env[n] || "").trim();
    if (v) return v;
  }
  return "";
}

export async function resolveKey(service: CreativeService): Promise<{
  key: string | null;
  source: "vault" | "env" | null;
}> {
  const meta = SERVICE_CATALOG[service];
  if (isKeyEncryptionUnlocked()) {
    for (const id of meta.vaultIds) {
      const k = (await getDecryptedKey(id).catch(() => null))?.trim();
      if (k) return { key: k, source: "vault" };
    }
    const slug = serviceIdOf(meta.catalogName);
    const k2 = (await getDecryptedKey(slug).catch(() => null))?.trim();
    if (k2) return { key: k2, source: "vault" };
  }
  const fromEnv = envKey(meta.envVite);
  if (fromEnv) return { key: fromEnv, source: "env" };
  return { key: null, source: null };
}

export async function resolveCreativeKeys(): Promise<
  Partial<Record<CreativeService, string>>
> {
  const out: Partial<Record<CreativeService, string>> = {};
  await Promise.all(
    (Object.keys(SERVICE_CATALOG) as CreativeService[]).map(async (s) => {
      const { key } = await resolveKey(s);
      if (key) out[s] = key;
    }),
  );
  return out;
}

export function missingKeyMessage(service: CreativeService): string {
  const name = SERVICE_CATALOG[service].catalogName;
  const envName = SERVICE_CATALOG[service].envVite[0];
  return (
    "Connect " +
    name +
    " in Integrations (unlock vault + save API key), or set " +
    envName +
    " for local dev."
  );
}
