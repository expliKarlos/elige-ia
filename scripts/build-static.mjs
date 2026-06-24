import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(process.cwd());
const output = resolve(root, "_site");
const files = ["index.html", "index-reducida.html", "LICENSE"];
const directories = ["css", "data", "img", "js"];

if (dirname(output) !== root) {
  throw new Error("El directorio de salida debe permanecer dentro del proyecto.");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  await cp(resolve(root, file), resolve(output, file));
}
for (const directory of directories) {
  await cp(resolve(root, directory), resolve(output, directory), { recursive: true });
}

process.stdout.write(`Sitio estático preparado en ${output}\n`);
