import { existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

let processHandle: ChildProcess | null = null;
let starting: Promise<boolean> | null = null;

function config() {
  const root = process.env.NEXORA_APP_ROOT || process.cwd();
  const executable = process.env.NEXORA_LOCAL_ENGINE_BIN || path.join(root, "runtime", "llama", process.platform === "win32" ? "llama-server.exe" : "llama-server");
  const model = process.env.NEXORA_MODEL_PATH || path.join(root, "models", "gpt-oss-20b.gguf");
  const host = process.env.NEXORA_LOCAL_ENGINE_HOST || "127.0.0.1";
  const port = Number(process.env.NEXORA_LOCAL_ENGINE_PORT || 8090);
  const context = Math.max(4096, Number(process.env.NEXORA_CONTEXT_LENGTH || 32768));
  return { executable, model, host, port, context };
}

export function localNativeConfig() {
  const c = config();
  return { ...c, endpoint: `http://${c.host}:${c.port}` };
}

export function localNativeConfigured() {
  const c = config();
  return existsSync(c.executable) && existsSync(c.model);
}

export async function localNativeHealth() {
  const c = config();
  try {
    const r = await fetch(`http://${c.host}:${c.port}/health`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

export async function ensureLocalNativeEngine() {
  if (await localNativeHealth()) return true;
  if (!localNativeConfigured()) return false;
  if (starting) return starting;
  starting = new Promise<boolean>((resolve) => {
    const c = config();
    const child = spawn(c.executable, ["-m", c.model, "--host", c.host, "--port", String(c.port), "-c", String(c.context), "--alias", "nexora-gpt-oss-20b"], {
      cwd: path.dirname(c.executable),
      windowsHide: true,
      stdio: "ignore",
    });
    processHandle = child;
    child.once("error", () => { processHandle = null; resolve(false); });
    child.once("exit", () => { processHandle = null; });
    const deadline = Date.now() + Number(process.env.NEXORA_ENGINE_START_TIMEOUT_MS || 20000);
    const poll = async () => {
      if (await localNativeHealth()) return resolve(true);
      if (Date.now() >= deadline) return resolve(false);
      setTimeout(poll, 500);
    };
    void poll();
  }).finally(() => { starting = null; });
  return starting;
}

export async function stopLocalNativeEngine() {
  if (!processHandle) return;
  processHandle.kill();
  processHandle = null;
}
