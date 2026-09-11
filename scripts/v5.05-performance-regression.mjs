import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const layout = read("src/app/(protected)/layout.tsx");
const header = read("src/components/header.tsx");
const loader = read("src/components/minimum-route-loader.tsx");
const dashboard = read("src/components/dashboard.tsx");
const bootstrap = read("src/app/api/lia/runtime/bootstrap/route.ts");

if (layout.includes("ensureLiaAutonomousCron")) throw new Error("Protected layout still provisions cron on every navigation");
if (!header.includes("}, []);")) throw new Error("Header auth effect is not stabilized");
if (loader.includes("const MINIMUM_MS = 3000")) throw new Error("3s forced route delay still enabled");
if (!fs.existsSync("src/app/api/lia/runtime/bootstrap/route.ts")) throw new Error("Session bootstrap route missing");
if (!bootstrap.includes("ensureLiaAutonomousCron")) throw new Error("Bootstrap route is not wired");
console.log("✓ v5.05 performance contract");
