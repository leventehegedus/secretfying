// PreToolUse: block edits to env files and lockfiles (lockfiles change only via pnpm).
import { basename } from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const file = JSON.parse(input).tool_input?.file_path ?? "";
const name = basename(file);

const isEnv = name.startsWith(".env") && name !== ".env.example";
const isLock = name === "pnpm-lock.yaml" || name === "package-lock.json" || name === "yarn.lock";
if (isEnv || isLock) {
  console.error(
    `Blocked: ${name} must not be edited by Claude (${isEnv ? "secrets" : "use pnpm"}).`,
  );
  process.exit(2);
}
