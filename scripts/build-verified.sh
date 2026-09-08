#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

project_root="$(cd "${script_dir}/.." && pwd)"
vinext="${project_root}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

echo "Running bounded vinext build..."
cd "${project_root}"
export WRANGLER_LOG_PATH="${project_root}/.wrangler/logs"
export MINIFLARE_REGISTRY_PATH="${project_root}/.wrangler/registry"
node --input-type=module - "${vinext}" <<'NODE'
import { spawn } from "node:child_process";
const child = spawn(process.execPath, [process.argv[2], "build"], { stdio: "inherit" });
const timer = setTimeout(() => { child.kill("SIGTERM"); setTimeout(() => child.kill("SIGKILL"), 10000).unref(); }, 180000);
child.on("error", (error) => { clearTimeout(timer); console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { clearTimeout(timer); process.exitCode = code ?? 1; });
NODE
