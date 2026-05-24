---
title: Images
description: Resolve CMS asset ids into canonical media URLs with cmsImage (pure function) or useCmsImage (hook), and integrate with Next.js' Image component.
order: 9
---

# Images

CMS entries store images as asset ids — short opaque strings. The SDK ships two helpers that resolve them into canonical URLs.

| Use this        | Where                                                 | Import from                       |
| --------------- | ----------------------------------------------------- | --------------------------------- |
| `cmsImage(id, opts)` | Loaders, scripts, server code, anywhere without React context. | `@asteroidcms/core-utils`         |
| `useCmsImage()`      | React components under `<AsteroidCMSProvider>`.        | `@asteroidcms/core-utils/client`  |

Both ultimately build the same URL: `${cmsUrl}${mediaPath}/${id}`.

---

## `cmsImage(id, { cmsUrl, mediaPath? })`

Pure function. Use when you can't (or don't want to) read the provider context.

```ts
import { cmsImage } from "@asteroidcms/core-utils";

const url = cmsImage("64f1a2b3c4d5e6f7a8b9c0d1", {
  cmsUrl: "https://cms.example.com",
});
// → "https://cms.example.com/media/canonical/64f1a2b3c4d5e6f7a8b9c0d1"
```

Behavior:

- Trailing slashes on `cmsUrl` are trimmed.
- A leading slash is forced on `mediaPath`. Defaults to `/media/canonical`.
- A falsy `id` returns `""` — convenient for conditional rendering: `<img src={cmsImage(id, opts) || fallback} />`.

---

## `useCmsImage()`

Hook variant that reads `cmsUrl` and `mediaPath` from the provider. Returns a stable function so you can use it many times in one component without re-reading context.

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

Add your CMS host to `next.config.js` under `images.remotePatterns` so the Next image optimizer is allowed to fetch it:

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

For server-rendered images where you can't call hooks, use the pure `cmsImage` with envs:

```tsx
import { cmsImage } from "@asteroidcms/core-utils";

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

To override per-call without changing the provider, fall back to the pure function:

```ts
cmsImage(id, { cmsUrl: "https://cms.example.com", mediaPath: "/cdn/preview" });
```

---

## Wrapping for project-specific behavior

If your app passes a mix of asset ids, already-canonical URLs, and local static paths through the same renderer, write a thin wrapper around `cmsImage`:

```ts
// lib/cms-image.ts
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

That keeps the rendering site simple (`<img src={resolveAsset(post.cover)} />`) and isolates path-shape decisions in one file.

Continue to **[Rich text »](./10-rich-text.md)**.
