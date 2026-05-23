import { useAsteroidCMSConfig } from "../provider/context";

/**
 * Build a canonical media URL from an asset id. Pass `cmsUrl` explicitly when
 * calling outside of React (e.g. SSR loaders, scripts). Inside components,
 * prefer `useCmsImage()`.
 */
export function cmsImage(
  id: string | undefined,
  options: { cmsUrl: string; mediaPath?: string },
): string {
  if (!id) return "";
  const base = options.cmsUrl.replace(/\/+$/, "");
  const path = (options.mediaPath ?? "/media/canonical").replace(/^\/?/, "/");
  return `${base}${path}/${id}`;
}

/** Hook variant that pulls `cmsUrl`/`mediaPath` from the provider. */
export function useCmsImage(): (id?: string) => string {
  const { cmsUrl, mediaPath } = useAsteroidCMSConfig();
  return (id?: string) => cmsImage(id, { cmsUrl, mediaPath });
}
