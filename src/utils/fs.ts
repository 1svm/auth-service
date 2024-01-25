import path from "node:path";

export function rootDir() {
  return path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..");
}
