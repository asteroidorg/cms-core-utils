// Pure JSX layout + param parsing for OG images. Rendered by the host's
// next/og (or satori) route. No hooks, no "use client".

import type { AsteroidOgImagePalette } from "./seo.config";

export type OgImageVariant = "article" | "listing";

export interface OgImageContentParams {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  siteName?: string;
  palette: AsteroidOgImagePalette;
  variant?: OgImageVariant;
}

export interface ParsedOgImageParams extends OgImageContentParams {
  variant: OgImageVariant;
}

const DEFAULT_PALETTE: AsteroidOgImagePalette = {
  background: "#0C0D10",
  foreground: "#FFFFFF",
  accent: "#EDB435",
  accentMuted: "rgba(237,180,53,0.22)",
  mutedText: "rgba(255,255,255,0.65)",
};

export function parseOgImageSearchParams(
  searchParams: URLSearchParams,
): ParsedOgImageParams {
  const palette: AsteroidOgImagePalette = {
    background: searchParams.get("bg") ?? DEFAULT_PALETTE.background,
    foreground: searchParams.get("fg") ?? DEFAULT_PALETTE.foreground,
    accent: searchParams.get("accent") ?? DEFAULT_PALETTE.accent,
    accentMuted: searchParams.get("accentMuted") ?? DEFAULT_PALETTE.accentMuted,
    mutedText: searchParams.get("muted") ?? DEFAULT_PALETTE.mutedText,
  };

  return {
    title: searchParams.get("title")?.trim() || "Articles",
    subtitle: searchParams.get("subtitle")?.trim() || undefined,
    eyebrow: searchParams.get("eyebrow")?.trim() || undefined,
    siteName: searchParams.get("siteName")?.trim() || undefined,
    variant: searchParams.get("type") === "listing" ? "listing" : "article",
    palette,
  };
}

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}

/** Satori only supports hex/rgb; convert rgba() for OG rendering. */
function toSatoriColor(color: string): string {
  const rgbaMatch = color.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
  );
  if (!rgbaMatch) return color;

  const [, r, g, b, a = "1"] = rgbaMatch;
  const hex = [r, g, b]
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("");
  const alpha = Math.round(parseFloat(a) * 255)
    .toString(16)
    .padStart(2, "0");

  return `#${hex}${alpha}`;
}

/** JSX layout consumed by `next/og` ImageResponse and compatible OG endpoints. */
export function OgImageContent({
  title,
  subtitle,
  eyebrow,
  siteName,
  palette,
  variant = "article",
}: OgImageContentParams) {
  const displayTitle = truncateText(title, 120);
  const displaySubtitle = subtitle ? truncateText(subtitle, 160) : undefined;
  const displayEyebrow =
    eyebrow?.trim() || (variant === "listing" ? "Articles" : "Article");
  const background = toSatoriColor(palette.background);
  const foreground = toSatoriColor(palette.foreground);
  const accent = toSatoriColor(palette.accent);
  const accentMuted = toSatoriColor(palette.accentMuted ?? palette.accent);
  const mutedText = toSatoriColor(palette.mutedText ?? palette.foreground);

  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        background,
        color: foreground,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ height: 6, background: accent }} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flex: 1,
          padding: "66px 80px 72px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 18px",
            borderRadius: 999,
            border: `1px solid ${accentMuted}`,
            color: accent,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 0,
            textTransform: "uppercase",
            alignSelf: "flex-start",
          }}
        >
          {displayEyebrow}
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
          <div
            style={{
              fontSize: displayTitle.length > 70 ? 52 : 64,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: 0,
              color: foreground,
            }}
          >
            {displayTitle}
          </div>

          {displaySubtitle ? (
            <div
              style={{
                marginTop: 24,
                fontSize: 28,
                lineHeight: 1.4,
                color: mutedText,
                maxWidth: 900,
              }}
            >
              {displaySubtitle}
            </div>
          ) : null}
        </div>

        {siteName ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 24,
              fontWeight: 700,
              color: accent,
            }}
          >
            <span>{siteName}</span>
            <div
              style={{
                width: 72,
                height: 4,
                borderRadius: 999,
                background: accent,
              }}
            />
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
      </div>
    </div>
  );
}
