import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const sourcePath = resolve("../eleccion_2.html");
const destinationPath = resolve("data/questionnaire.v1.json");
const source = await readFile(sourcePath, "utf8");
const currentQuestionnaire = await readJsonIfPresent(destinationPath);
const currentCriteria = new Map((currentQuestionnaire?.categories || []).flatMap(category => (
  category.criteria.map(criterion => [criterion.id, criterion])
)));

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
  questionnaireVersion: "2.0.0",
  title: "¿Qué herramienta utilizo?",
  scale: [
    { value: 1, label: "No lo necesito", description: "Esta necesidad no forma parte del caso." },
    { value: 2, label: "Lo necesito poco", description: "La necesidad aparece, pero tiene poca importancia." },
    { value: 3, label: "Lo necesito bastante", description: "La necesidad es relevante para resolver el caso." },
    { value: 4, label: "Es imprescindible", description: "La necesidad es esencial y condiciona la decisión." }
  ],
  categories: matrix.map(category => ({
    id: slugify(category.category),
    label: category.category,
    color: category.color,
    defaultWeight: 1,
    criteria: category.items.map(item => {
      const current = currentCriteria.get(item.id) || {};
      return {
        id: item.id,
        label: item.criterio,
        description: item.detalle || "",
        defaultWeights: {
          gemini: item.pesoGemini,
          notebooklm: item.pesoNotebook
        },
        ...(current.question ? { question: current.question } : {}),
        ...(current.risk ? { risk: current.risk } : {})
      };
    })
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

async function readJsonIfPresent(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
