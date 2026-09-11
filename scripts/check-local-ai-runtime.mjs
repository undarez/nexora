import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const candidates = [
  process.env.NEXORA_LOCAL_ENGINE_BIN,
  path.join(root, 'runtime', 'llama', process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'),
].filter(Boolean);
const model = process.env.NEXORA_MODEL_PATH || path.join(root, 'models', 'gpt-oss-20b.gguf');
console.log(JSON.stringify({
  enginePresent: candidates.some((p) => fs.existsSync(p)),
  engineCandidates: candidates,
  modelPresent: fs.existsSync(model),
  model,
  ready: candidates.some((p) => fs.existsSync(p)) && fs.existsSync(model),
}, null, 2));
