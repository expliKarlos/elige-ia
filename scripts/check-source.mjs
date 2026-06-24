import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { extname, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const root = resolve(process.cwd());
const scannedDirectories = ["css", "data", "docs", "e2e", "js", "scripts", "tests", ".github"];
const rootFiles = ["index.html", "index-reducida.html", "README.md", "ROADMAP.md", "CHANGELOG.md", "package.json", "package-lock.json", "playwright.config.js"];
const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".yml", ".yaml"]);
const errors = [];
const files = [];

for (const file of rootFiles) files.push(resolve(root, file));
for (const directory of scannedDirectories) {
  await collectFiles(resolve(root, directory), files);
}

for (const file of files.filter((candidate) => textExtensions.has(extname(candidate)))) {
  const label = relative(root, file);
  const content = await readFile(file, "utf8");
  content.split(/\r?\n/).forEach((line, index) => {
    if (/[ \t]+$/.test(line)) errors.push(`${label}:${index + 1}: espacio final`);
  });
  if (content && !content.endsWith("\n")) errors.push(`${label}: falta salto de línea final`);
  if (extname(file) === ".json") {
    try {
      JSON.parse(content);
    } catch (error) {
      errors.push(`${label}: JSON inválido (${error.message})`);
    }
  }
  if ([".yml", ".yaml"].includes(extname(file))) {
    try {
      parseYaml(content);
    } catch (error) {
      errors.push(`${label}: YAML inválido (${error.message})`);
    }
  }
  if (extname(file) === ".html" && /href=["']#["']/.test(content)) {
    errors.push(`${label}: contiene enlaces provisionales href="#"`);
  }
}

for (const file of files.filter((candidate) => [".js", ".mjs"].includes(extname(candidate)))) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) errors.push(`${relative(root, file)}: ${result.stderr.trim()}`);
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`Fuentes verificadas: ${files.length} archivos sin errores de formato, sintaxis, JSON o YAML.\n`);

async function collectFiles(directory, output) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(path, output);
    else output.push(path);
  }
}
