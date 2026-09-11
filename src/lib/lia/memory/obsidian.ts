export type ObsidianMemoryNote = {
  title: string;
  folder: "00_CORE" | "01_USER" | "02_FINANCE" | "03_MEMORY" | "04_KNOWLEDGE" | "05_SKILLS" | "06_RESEARCH" | "07_OUTPUTS";
  body: string;
  tags?: string[];
  links?: string[];
};

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "NEXORA note";
}

/**
 * Builds an Obsidian-compatible Markdown note without making Obsidian a
 * financial source of truth. Supabase remains authoritative for transactions,
 * balances and permissions; Obsidian is the human-readable cognitive/graph
 * memory layer.
 */
export function buildObsidianMemoryNote(input: ObsidianMemoryNote) {
  const tags = (input.tags ?? []).map((tag) => tag.replace(/[^a-zA-Z0-9_-]/g, "")).filter(Boolean);
  const links = (input.links ?? []).map((link) => link.trim()).filter(Boolean);
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(input.title)}`,
    "source: nexora",
    `tags: [${tags.map((tag) => JSON.stringify(tag)).join(", ")}]`,
    `created_at: ${new Date().toISOString()}`,
    "---",
    "",
  ].join("\n");
  const graphLinks = links.length ? `\n\n## Liens\n${links.map((link) => `- [[${link}]]`).join("\n")}` : "";
  return `${frontmatter}${input.body.trim()}${graphLinks}\n`;
}

export function obsidianNotePath(input: Pick<ObsidianMemoryNote, "folder" | "title">) {
  return `${input.folder}/${safeFileName(input.title)}.md`;
}

export function buildObsidianMemoryBundle(notes: ObsidianMemoryNote[]) {
  return notes.map((note) => ({ path: obsidianNotePath(note), content: buildObsidianMemoryNote(note) }));
}
