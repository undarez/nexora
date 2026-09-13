import fs from "node:fs";

const files = [
  "src/lib/observability/server.ts",
  "src/lib/ollama/client.ts",
  "src/app/api/admin/ai/route.ts",
  "src/app/api/notifications/refresh/route.ts",
];
for (const file of files) if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
const ollama = fs.readFileSync(files[1], "utf8");
if (!ollama.includes("signal: requestSignal")) throw new Error("Ollama timeout signal is not wired");
const obs = fs.readFileSync(files[0], "utf8");
for (const token of ["diagnosticId", "logDiagnostic", "errorInfo"]) if (!obs.includes(token)) throw new Error(`Missing observability primitive: ${token}`);
console.log("v5.05.7 observability regression: PASS");
