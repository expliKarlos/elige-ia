import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateQuestionnaire } from "../js/validation.js";

const questionnairePath = resolve("data/questionnaire.v1.json");
const questionnaire = JSON.parse(await readFile(questionnairePath, "utf8"));
const validation = validateQuestionnaire(questionnaire);

if (!validation.valid) {
  console.error(validation.errors.join("\n"));
  process.exitCode = 1;
} else {
  const criterionCount = questionnaire.categories.reduce(
    (total, category) => total + category.criteria.length,
    0
  );
  console.log(`Cuestionario válido: ${questionnaire.categories.length} categorías y ${criterionCount} criterios.`);
}

