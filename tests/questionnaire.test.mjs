import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { validateQuestionnaire } from "../js/validation.js";

const questionnairePath = new URL("../data/questionnaire.v1.json", import.meta.url);

async function loadQuestionnaire() {
  return JSON.parse(await readFile(questionnairePath, "utf8"));
}

test("el cuestionario extraído conserva 18 categorías y 103 criterios", async () => {
  const questionnaire = await loadQuestionnaire();
  const criterionCount = questionnaire.categories.reduce(
    (total, category) => total + category.criteria.length,
    0
  );

  assert.equal(questionnaire.categories.length, 18);
  assert.equal(criterionCount, 103);
});

test("todos los identificadores son únicos y los pesos están entre 1 y 10", async () => {
  const questionnaire = await loadQuestionnaire();
  const validation = validateQuestionnaire(questionnaire);

  assert.deepEqual(validation.errors, []);
  assert.equal(validation.valid, true);
});

test("el validador acepta pesos decimales y rechaza valores fuera de rango", () => {
  const fixture = {
    schemaVersion: "1.0",
    questionnaireId: "fixture",
    questionnaireVersion: "1.0.0",
    categories: [{
      id: "category",
      label: "Categoría",
      color: "#003DA5",
      defaultWeight: 1.5,
      criteria: [{
        id: "criterion",
        label: "Criterio",
        description: "Descripción",
        defaultWeights: { gemini: 2.5, notebooklm: 10 }
      }]
    }]
  };

  assert.equal(validateQuestionnaire(fixture).valid, true);

  fixture.categories[0].criteria[0].defaultWeights.gemini = 0.9;
  const invalid = validateQuestionnaire(fixture);
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join("\n"), /defaultWeights\.gemini/);
});

test("el JSON conserva textos, colores e importancias de eleccion_2.html", async () => {
  const questionnaire = await loadQuestionnaire();
  const source = await readFile(new URL("../../eleccion_2.html", import.meta.url), "utf8");
  const matrixStart = source.indexOf("const MATRIX =");
  const matrixEnd = source.indexOf("const SCALE =", matrixStart);
  const expressionStart = source.indexOf("[", matrixStart);
  const matrixExpression = source.slice(expressionStart, matrixEnd).trim().replace(/;\s*$/, "");
  const matrix = vm.runInNewContext(`(${matrixExpression})`, Object.create(null));

  const legacyData = Array.from(matrix, category => ({
    label: category.category,
    color: category.color,
    criteria: Array.from(category.items, item => ({
      id: item.id,
      label: item.criterio,
      description: item.detalle || "",
      defaultWeights: {
        gemini: item.pesoGemini,
        notebooklm: item.pesoNotebook
      }
    }))
  }));
  const extractedData = questionnaire.categories.map(category => ({
    label: category.label,
    color: category.color,
    criteria: category.criteria
  }));

  assert.deepEqual(extractedData, legacyData);
});
