import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiUrl = "http://127.0.0.1:5019/api";
const siteUrl = "http://127.0.0.1:3019";
const children = [];

const start = (args, env = {}) => {
  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    stdio: "ignore",
    windowsHide: true,
  });
  children.push(child);
  return child;
};

const waitFor = async (url, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The service is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const run = (args, env = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: projectRoot,
      env: { ...process.env, ...env },
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${args.join(" ")} exited with ${code}`))));
  });

const runSmoke = () =>
  new Promise((resolve, reject) => {
    const smoke = spawn(process.execPath, ["scripts/smoke.mjs"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        SMOKE_API_URL: apiUrl,
        SMOKE_SITE_URL: siteUrl,
      },
      stdio: "inherit",
      windowsHide: true,
    });
    smoke.once("error", reject);
    smoke.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Smoke checks exited with ${code}`))));
  });

try {
  start(["tests/fixtures/coverage-api.mjs"], { TEST_API_PORT: "5019" });
  await waitFor(`${apiUrl}/health`);
  await run(["node_modules/next/dist/bin/next", "build"], {
    API_BASE_URL: apiUrl,
    NEXT_PUBLIC_ANALYTICS_ENABLED: "false",
  });
  start(["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3019"], {
    API_BASE_URL: apiUrl,
    NEXT_PUBLIC_ANALYTICS_ENABLED: "false",
  });
  await waitFor(`${siteUrl}/en`);
  await runSmoke();
} finally {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}
