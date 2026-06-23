import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const sourcePath = resolve("../eleccion_2.html");
const destinationPath = resolve("data/questionnaire.v1.json");
const source = await readFile(sourcePath, "utf8");

const matrixMarker = "const MATRIX =";
const scaleMarker = "const SCALE =";
const matrixStart = source.indexOf(matrixMarker);
const matrixEnd = source.indexOf(scaleMarker, matrixStart);

if (matrixStart < 0 || matrixEnd < 0) {
  throw new Error("No se ha encontrado la matriz en eleccion_2.html.");
}

const expressionStart = source.indexOf("[", matrixStart);
const matrixExpression = source
  .slice(expressionStart, matrixEnd)
  .trim()
  .replace(/;\s*$/, "");
const matrix = vm.runInNewContext(`(${matrixExpression})`, Object.create(null), {
  timeout: 1000
});

const questionnaire = {
  schemaVersion: "1.0",
  questionnaireId: "gemini-vs-notebooklm",
  questionnaireVersion: "1.0.0",
  title: "¿Qué herramienta utilizo?",
  scale: [
    { value: 1, label: "No", description: "No corresponde" },
    { value: 2, label: "Poco", description: "Corresponde poco" },
    { value: 3, label: "Bastante", description: "Corresponde bastante" },
    { value: 4, label: "Sí", description: "Sí corresponde" }
  ],
  categories: matrix.map(category => ({
    id: slugify(category.category),
    label: category.category,
    color: category.color,
    defaultWeight: 1,
    criteria: category.items.map(item => ({
      id: item.id,
      label: item.criterio,
      description: item.detalle || "",
      defaultWeights: {
        gemini: item.pesoGemini,
        notebooklm: item.pesoNotebook
      }
    }))
  }))
};

await writeFile(destinationPath, `${JSON.stringify(questionnaire, null, 2)}\n`, "utf8");

const criterionCount = questionnaire.categories.reduce(
  (total, category) => total + category.criteria.length,
  0
);
console.log(`Extraídas ${questionnaire.categories.length} categorías y ${criterionCount} criterios.`);

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

