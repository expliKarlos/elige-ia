import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateReducedResults,
  createReducedRiskAnswers,
  validateReducedResponses
} from "../js/reduced-scoring.js";

const questionnaire = {
  categories: [
    { id: "a", label: "Categoría A", color: "#123456", defaultWeight: 1 },
    { id: "b", label: "Categoría B", color: "#654321", defaultWeight: 3 }
  ]
};

test("calcula el resultado reducido ponderando categorías, no criterios", () => {
  const results = calculateReducedResults(questionnaire, {
    "a:gemini": 4,
    "a:notebooklm": 1,
    "b:gemini": 2,
    "b:notebooklm": 4
  });

  assert.equal(results.geminiScore100, 62.5);
  assert.equal(results.notebookScore100, 81.3);
  assert.equal(results.diff, -18.8);
  assert.equal(results.activeCategoryCount, 2);
  assert.equal(results.categories[1].weight, 3);
});

test("permite modificar pesos decimales y excluir categorías", () => {
  const results = calculateReducedResults(questionnaire, {
    "a:gemini": 4,
    "a:notebooklm": 1,
    "b:gemini": 2,
    "b:notebooklm": 4
  }, {
    categorySettings: {
      a: { included: false, weight: 1 },
      b: { included: true, weight: 7.5 }
    }
  });

  assert.equal(results.geminiScore100, 50);
  assert.equal(results.notebookScore100, 100);
  assert.equal(results.activeCategoryCount, 1);
  assert.equal(results.excludedCategoryCount, 1);
  assert.equal(results.categories[0].included, false);
});

test("detecta valoraciones y controles de seguridad pendientes", () => {
  const validation = validateReducedResponses({
    questionnaire,
    ratings: { "a:gemini": 4, "a:notebooklm": 3, "b:gemini": 2 },
    safetyAnswers: { c11q03: "no" },
    safetyCriterionIds: ["c11q03", "c18q02"],
    categorySettings: {}
  });

  assert.equal(validation.complete, false);
  assert.deepEqual(validation.missingRatings, [{ categoryId: "b", tool: "notebooklm" }]);
  assert.deepEqual(validation.missingSafety, ["c18q02"]);
});

test("traduce los controles de seguridad al formato del intérprete", () => {
  assert.deepEqual(createReducedRiskAnswers({
    c11q03: "yes",
    c18q02: "no"
  }), {
    "c11q03:gemini": 4,
    "c11q03:notebook": 4,
    "c18q02:gemini": 1,
    "c18q02:notebook": 1
  });
});

test("rechaza pesos y valoraciones fuera de rango", () => {
  assert.throws(() => calculateReducedResults(questionnaire, {
    "a:gemini": 5,
    "a:notebooklm": 1,
    "b:gemini": 2,
    "b:notebooklm": 4
  }), /valoración/i);

  assert.throws(() => calculateReducedResults(questionnaire, {}, {
    categorySettings: { a: { weight: 0.5 } }
  }), /peso/i);
});
