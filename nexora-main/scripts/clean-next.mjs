import { rm } from "node:fs/promises";

await rm(".next", { recursive: true, force: true });
console.log(".next supprimé — cache Next.js propre.");
