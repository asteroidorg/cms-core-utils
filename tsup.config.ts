import { defineConfig } from "tsup";
import { promises as fs } from "node:fs";
import * as path from "node:path";

const shared = {
  format: ["esm", "cjs"] as const,
  dts: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  injectStyle: false,
  external: ["react", "react-dom", "@apollo/client", "graphql"],
};

const USE_CLIENT = '"use client";\n';

async function prependDirective(file: string) {
  const full = path.resolve("dist", file);
  const original = await fs.readFile(full, "utf8");
  if (original.startsWith('"use client"')) return;
  await fs.writeFile(full, USE_CLIENT + original);
}

export default defineConfig([
  {
    ...shared,
    entry: { index: "src/index.ts" },
    clean: true,
  },
  {
    ...shared,
    entry: { client: "src/client.ts" },
    clean: false,
    // Rollup's treeshake pass strips module-level directives, so esbuild's
    // banner option doesn't survive. Prepend `"use client"` after the build
    // instead — Next.js requires it as the very first directive so it treats
    // this entry as a client module.
    async onSuccess() {
      await Promise.all([
        prependDirective("client.js"),
        prependDirective("client.cjs"),
      ]);
    },
  },
  {
    // Build the Next.js subpath and its standalone client island together in a
    // single tsup pass. They share a re-export edge (`next.ts` re-exports the
    // island), so emitting them from one process keeps the `.d.ts` outputs from
    // racing the other parallel entry builds.
    ...shared,
    entry: { next: "src/next.ts", "next-client": "src/next-client.ts" },
    clean: false,
    // `next` external for both; keep the island external from `next.ts` so this
    // server-context entry re-exports it without absorbing its "use client"
    // boundary.
    external: [...shared.external, "next", "@asteroidcms/core-utils/next-client"],
    // Only the island is a client module — prepend "use client" to it alone,
    // never to the server-context `next.*` output.
    async onSuccess() {
      await Promise.all([
        prependDirective("next-client.js"),
        prependDirective("next-client.cjs"),
      ]);
    },
  },
  {
    ...shared,
    entry: { server: "src/server.ts" },
    clean: false,
    // `next` and the package's own client subpaths stay external so the
    // client islands keep their own "use client" module boundary.
    external: [
      ...shared.external,
      "next",
      "server-only",
      "@asteroidcms/core-utils/client",
      "@asteroidcms/core-utils/next-client",
    ],
  },
]);
