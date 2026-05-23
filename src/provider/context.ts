import { createContext, useContext } from "react";
import type { ResolvedAsteroidCMSConfig } from "./types";

export const AsteroidCMSContext = createContext<ResolvedAsteroidCMSConfig | null>(null);

export function useAsteroidCMSConfig(): ResolvedAsteroidCMSConfig {
  const ctx = useContext(AsteroidCMSContext);
  if (!ctx) {
    throw new Error(
      "useAsteroidCMSConfig must be used inside <AsteroidCMSProvider>. " +
        "Wrap your app with <AsteroidCMSProvider cmsUrl=... apiKey=... />.",
    );
  }
  return ctx;
}
