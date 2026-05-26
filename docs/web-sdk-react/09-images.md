---
title: Images
description: Resolve CMS asset IDs into canonical media URLs with cmsImage (pure function) or useCmsImage (hook), and integrate with Next.js Image.
order: 9
---

# Images

CMS entries store images as asset IDs — short opaque strings. The SDK ships two helpers that resolve them into canonical URLs.

| Use this | Where | Import from |
| --- | --- | --- |
| `cmsImage(id, opts)` | Loaders, scripts, server code — anywhere without React context. | `@asteroidcms/core-utils` |
| `useCmsImage()` | React components under `<AsteroidCMSProvider>`. | `@asteroidcms/core-utils/client` |

Both build the same URL: `${cmsUrl}${mediaPath}/${id}`.

---

## `cmsImage` — pure function

Use when you can't (or don't want to) read the provider context.

```ts
import { cmsImage } from "@asteroidcms/core-utils";

const url = cmsImage("64f1a2b3c4d5e6f7a8b9c0d1", {
  cmsUrl: "https://cms.example.com",
});
// → "https://cms.example.com/media/canonical/64f1a2b3c4d5e6f7a8b9c0d1"
```

### Behavior

| Input | Result |
| --- | --- |
| Trailing slash on `cmsUrl` | Trimmed automatically. |
| `mediaPath` without leading slash | Forced to start with `/`. Defaults to `/media/canonical`. |
| Falsy `id` | Returns `""` — convenient for conditional rendering. |

---

## `useCmsImage` — hook

Reads `cmsUrl` and `mediaPath` from the provider. Returns a stable function.

```tsx
"use client";

import { useCmsImage } from "@asteroidcms/core-utils/client";

export function Gallery({ ids }: { ids: string[] }) {
  const cmsImage = useCmsImage();

  return (
    <ul className="grid grid-cols-3 gap-2">
      {ids.map((id) => (
        <li key={id}>
          <img src={cmsImage(id)} alt="" loading="lazy" />
        </li>
      ))}
    </ul>
  );
}
```

---

## Pairing with Next.js `<Image>`

```tsx
import Image from "next/image";
import { useCmsImage } from "@asteroidcms/core-utils/client";

export function Hero({ heroId }: { heroId: string }) {
  const cmsImage = useCmsImage();
  return (
    <Image
      src={cmsImage(heroId)}
      alt="Hero"
      width={1200}
      height={630}
      priority
    />
  );
}
```

Add your CMS host to `next.config.js` so the image optimizer can fetch it:

```js
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cms.example.com", pathname: "/media/**" },
    ],
  },
};
```

For server-rendered images where you can't call hooks, use the pure function:

```tsx
import { cmsImage } from "@asteroidcms/core-utils";
import Image from "next/image";

<Image
  src={cmsImage(heroId, { cmsUrl: process.env.CMS_API_BASE_URL! })}
  alt="Hero"
  width={1200}
  height={630}
/>;
```

---

## Customizing the media path

If your CMS exposes resized variants on a different path:

```tsx
<AsteroidCMSProvider
  cmsUrl="https://cms.example.com"
  apiKey={key}
  mediaPath="/cdn/v2"
>
  {children}
</AsteroidCMSProvider>
```

All `useCmsImage()` calls below the provider now build URLs like `https://cms.example.com/cdn/v2/<id>`.

To override per-call without changing the provider:

```ts
cmsImage(id, { cmsUrl: "https://cms.example.com", mediaPath: "/cdn/preview" });
```

---

## Wrapping for project-specific behavior

If your app passes a mix of asset IDs, full URLs, and local paths, write a thin wrapper:

```ts
// lib/resolve-asset.ts
import { cmsImage } from "@asteroidcms/core-utils";
import { ENV } from "@/config/env";

const CANONICAL = "/media/canonical/";

export function resolveAsset(value?: string | null): string {
  if (!value) return "";
  const v = value.trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith(CANONICAL)) return `${ENV.CMS_API_BASE_URL}${v}`;
  if (v.startsWith("/")) return v;                       // local static asset
  return cmsImage(v, { cmsUrl: ENV.CMS_API_BASE_URL! }); // bare asset id
}
```

This keeps the rendering site simple (`<img src={resolveAsset(post.cover)} />`) and isolates path-shape decisions in one file.

---

## Comparison: `cmsImage` vs. `useCmsImage`

| | `cmsImage` | `useCmsImage` |
| --- | --- | --- |
| **Type** | Pure function | React hook |
| **Needs provider** | No — pass `cmsUrl` explicitly | Yes — reads from context |
| **Works on server** | Yes | No (client only) |
| **Best for** | Build scripts, SSR, loaders | Client Components |

---

## FAQ

**What if the asset ID doesn't exist?**
The URL is still built — the CMS will return a 404. Handle this in your `<img>` `onError` handler or with a fallback image.

**Can I use this for non-image assets (PDFs, videos)?**
Yes. `cmsImage` just builds a URL — the CMS serves whatever the asset is. The name is a misnomer inherited from the original use case.

**Does `useCmsImage` re-render when the provider changes?**
Only if `cmsUrl` or `mediaPath` changes, which is rare. The returned function is stable across renders.
