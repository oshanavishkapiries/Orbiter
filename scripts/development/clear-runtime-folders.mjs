import { readdir, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const targetFolders = ["output", "logs", "flows", "errors"];
const KEEP_FILE = ".gitkeep";

async function clearFolderPreserveGitkeep(relativeFolderPath) {
  const folderPath = path.join(repoRoot, relativeFolderPath);

  await mkdir(folderPath, { recursive: true });

  const entries = await readdir(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === KEEP_FILE) {
      continue;
    }

    const entryPath = path.join(folderPath, entry.name);
    await rm(entryPath, { recursive: true, force: true });
  }

  console.log(`Cleared ${relativeFolderPath} (kept ${KEEP_FILE} if present)`);
}

async function main() {
  for (const folder of targetFolders) {
    await clearFolderPreserveGitkeep(folder);
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error("Failed to clear folders:", error);
  process.exitCode = 1;
});
