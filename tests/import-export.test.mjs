import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createSessionDocument,
  createWeightsDocument,
  parseImportText,
  serializeJson
} from "../js/import-export.js";

const questionnaire = JSON.parse(
  await readFile(new URL("../data/questionnaire.v1.json", import.meta.url), "utf8")
);
const exportedAt = "2026-06-23T18:30:00.000Z";

test("exporta e importa una sesión completa reproducible", () => {
  const firstCategory = questionnaire.categories[0];
  const firstCriterion = firstCategory.criteria[0];
  const state = {
    answers: {
      [`${firstCriterion.id}:gemini`]: 4,
      [`${firstCriterion.id}:notebook`]: 2
    },
    categoryPrefs: { 0: { included: true }, 1: { included: false } },
    activeCategoryIndex: 1,
    weightOverrides: {
      categories: { [firstCategory.id]: 2.5 },
      criteria: { [firstCriterion.id]: { gemini: 3.5 } }
    }
  };
  const document = createSessionDocument({
    questionnaire,
    state,
    results: { geminiScore100: 80, notebookScore100: 60 },
    exportedAt
  });
  const imported = parseImportText(serializeJson(document), questionnaire);

  assert.equal(document.kind, "survey-session");
  assert.equal(document.exportedAt, exportedAt);
  assert.equal(imported.kind, "survey-session");
  assert.deepEqual(imported.state.answers, state.answers);
  assert.equal(imported.state.categorySelection[firstCategory.id].included, true);
  assert.equal(imported.state.categorySelection[questionnaire.categories[1].id].included, false);
  assert.equal(imported.state.activeCategoryId, questionnaire.categories[1].id);
  assert.deepEqual(imported.state.weightOverrides, state.weightOverrides);
  assert.equal("results" in imported.state, false);
});

test("exporta e importa una configuración independiente de pesos", () => {
  const category = questionnaire.categories[0];
  const criterion = category.criteria[0];
  const weightOverrides = {
    categories: { [category.id]: 4.25 },
    criteria: { [criterion.id]: { gemini: 1.5, notebooklm: 9.75 } }
  };
  const document = createWeightsDocument({ questionnaire, weightOverrides, exportedAt });
  const imported = parseImportText(serializeJson(document), questionnaire);

  assert.equal(imported.kind, "weight-configuration");
  assert.deepEqual(imported.weightOverrides, weightOverrides);
  assert.equal(imported.preview.modifiedGroups, 2);
});

test("rechaza archivos incompatibles, pesos inválidos e identificadores desconocidos", () => {
  const valid = createWeightsDocument({ questionnaire, weightOverrides: {}, exportedAt });
  const incompatible = structuredClone(valid);
  incompatible.questionnaire.version = "99.0.0";
  assert.throws(() => parseImportText(JSON.stringify(incompatible), questionnaire), /versión/i);

  const invalidWeight = structuredClone(valid);
  invalidWeight.data.weights.categories[questionnaire.categories[0].id] = 11;
  assert.throws(() => parseImportText(JSON.stringify(invalidWeight), questionnaire), /entre 1 y 10/);

  const unknown = structuredClone(valid);
  unknown.data.weights.categories.unknown = 2;
  assert.throws(() => parseImportText(JSON.stringify(unknown), questionnaire), /desconocida/i);
});

test("rechaza JSON mal formado y archivos mayores de 1 MB", () => {
  assert.throws(() => parseImportText("{no-json", questionnaire), /JSON válido/);
  assert.throws(() => parseImportText(" ".repeat(1_000_001), questionnaire), /1 MB/);
});
