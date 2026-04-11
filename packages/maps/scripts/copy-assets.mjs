import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(currentDir, "..");
const sourceFile = path.join(packageDir, "src", "map-ids.json");
const destinationFile = path.join(packageDir, "dist", "map-ids.json");

fs.mkdirSync(path.dirname(destinationFile), { recursive: true });
fs.copyFileSync(sourceFile, destinationFile);
