# Decisions

Short log of choices made while building. Newest last.

## Phase 1: setup

- **TypeScript 6.0, not 7.0.** typescript-eslint 8.x supports `<6.1`; TS 7 (native port) would break linting.
- **React 18.3** as specified, although React 19 is current. Vite 8 + `@vitejs/plugin-react` 6.
- **Node**: `.nvmrc` pins 22 (CI and Docker); `engines` is `>=22` so local Node 24 also works.
- **pnpm 11** with `allowBuilds` in `pnpm-workspace.yaml` for `better-sqlite3` and `esbuild` native builds.
- **`packages/shared` builds to `dist/`** and turbo runs `^build` before typecheck/lint/test, so the api runs
  plain Node in production without a TS loader.
- **jscpd ignores test files** (`*.test.ts(x)`) besides generated shadcn components, migrations and fixtures:
  arrange/act blocks in tests repeat by nature; production code stays under the 3 % gate.
- **Env guard allows `.env.example`**: the PreToolUse hook blocks every other `.env*` file and lockfiles.
- **jCodeMunch** is configured and connected, but its tools were not exposed in the phase 1 session;
  lookups fell back to Grep/Read. Restart the session to pick it up.
