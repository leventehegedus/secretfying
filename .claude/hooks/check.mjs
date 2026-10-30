// PostToolUse: typecheck and eslint --fix only the package that owns the edited file.
import { execSync } from "node:child_process";
import { relative } from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const file = JSON.parse(input).tool_input?.file_path ?? "";
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const rel = relative(root, file);
const pkg = rel.match(/^(apps|packages)\/([^/]+)\//);
if (!pkg || !/\.(ts|tsx)$/.test(rel)) process.exit(0);

const dir = `${pkg[1]}/${pkg[2]}`;
const run = (cmd) => {
  try {
    execSync(cmd, { cwd: root, stdio: "pipe" });
    return "";
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
};
const errors = [
  run(`pnpm exec eslint --fix ${JSON.stringify(rel)}`),
  run(`pnpm --dir ${dir} exec tsc --noEmit --pretty false`),
]
  .join("\n")
  .split("\n")
  .filter((l) => /error/i.test(l))
  .slice(0, 20);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(2);
}
