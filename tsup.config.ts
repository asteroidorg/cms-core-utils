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
    ...shared,
    entry: { next: "src/next.ts" },
    clean: false,
    external: [...shared.external, "next"],
  },
  {
    ...shared,
    entry: { server: "src/server.ts" },
    clean: false,
    // `next` and the package's own client subpath stay external so the
    // client island keeps its own "use client" module boundary.
    external: [...shared.external, "next", "server-only", "@asteroidcms/core-utils/client"],
  },
]);
