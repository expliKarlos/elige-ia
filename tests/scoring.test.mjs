import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculateCategoryResult,
  calculateSurveyResults,
  createDefaultWeightConfig,
  resetCategoryWeight,
  resetCriterionWeights,
  resolveWeightConfig
} from "../js/scoring.js";

const questionnaire = JSON.parse(
  await readFile(new URL("../data/questionnaire.v1.json", import.meta.url), "utf8")
);

function createAnswers(valueFor) {
  return Object.fromEntries(questionnaire.categories.flatMap(category =>
    category.criteria.flatMap(criterion => [
      [`${criterion.id}:gemini`, valueFor(criterion, "gemini")],
      [`${criterion.id}:notebook`, valueFor(criterion, "notebook")]
    ])
  ));
}

test("reescalada las respuestas completas desde el intervalo bruto 25–100 al intervalo real 0–100", () => {
  const minimum = calculateSurveyResults(questionnaire, createAnswers(() => 1));
  const maximum = calculateSurveyResults(questionnaire, createAnswers(() => 4));

  assert.equal(minimum.geminiRawScore100, 25);
  assert.equal(minimum.notebookRawScore100, 25);
  assert.equal(minimum.geminiScore100, 0);
  assert.equal(minimum.notebookScore100, 0);
  assert.equal(maximum.geminiRawScore100, 100);
  assert.equal(maximum.notebookRawScore100, 100);
  assert.equal(maximum.geminiScore100, 100);
  assert.equal(maximum.notebookScore100, 100);
});

test("reproduce el cálculo ponderado del standalone con categorías excluidas", () => {
  const answers = createAnswers((criterion, tool) => {
    const numericId = Number(criterion.id.slice(-2));
    return ((numericId + (tool === "notebook" ? 1 : 0)) % 4) + 1;
  });
  const categorySettings = Object.fromEntries(questionnaire.categories.map((category, index) => [
    category.id,
    { included: index !== 2, relevance: (index % 3) + 1 }
  ]));

  const actual = calculateSurveyResults(questionnaire, answers, { categorySettings });
  const expected = legacyCalculation(questionnaire, answers, categorySettings);

  assert.deepEqual(actual, expected);
});

test("calcula una categoría de forma independiente", () => {
  const category = questionnaire.categories[0];
  const answers = createAnswers((criterion, tool) => tool === "gemini" ? 4 : 2);
  const result = calculateCategoryResult(questionnaire, category.id, answers);

  assert.equal(result.geminiScore100, 100);
  assert.equal(result.notebookRawScore100, 50);
  assert.equal(result.notebookScore100, 33.3);
  assert.equal(result.criteria.length, category.criteria.length);
});

test("combina pesos decimales y permite restaurarlos sin mutar la configuración", () => {
  const defaults = createDefaultWeightConfig(questionnaire);
  const categoryId = questionnaire.categories[0].id;
  const criterionId = questionnaire.categories[0].criteria[0].id;
  const overrides = {
    categories: { [categoryId]: 2.5 },
    criteria: { [criterionId]: { gemini: 3.5, notebooklm: 7.25 } }
  };
  const effective = resolveWeightConfig(questionnaire, overrides);

  assert.equal(effective.categories[categoryId], 2.5);
  assert.equal(effective.criteria[criterionId].gemini, 3.5);
  assert.equal(effective.criteria[criterionId].notebooklm, 7.25);
  assert.deepEqual(resetCriterionWeights(overrides, criterionId).criteria, {});
  assert.deepEqual(resetCategoryWeight(overrides, categoryId).categories, {});
  assert.deepEqual(overrides.criteria[criterionId], { gemini: 3.5, notebooklm: 7.25 });
  assert.equal(defaults.categories[categoryId], 1);
});

test("rechaza pesos personalizados fuera del intervalo 1–10", () => {
  const categoryId = questionnaire.categories[0].id;

  assert.throws(
    () => resolveWeightConfig(questionnaire, { categories: { [categoryId]: 10.1 } }),
    /entre 1 y 10/
  );
});

function legacyCalculation(source, answers, categorySettings) {
  const totals = {
    gemini: 0,
    notebook: 0,
    maxGemini: 0,
    maxNotebook: 0,
    activeCategoryCount: 0,
    excludedCategoryCount: 0,
    categoryWeightTotal: 0,
    categories: []
  };

  source.categories.forEach(category => {
    const setting = categorySettings[category.id];
    const multiplier = setting.included ? setting.relevance : 0;
    const row = {
      category: category.label,
      categoryId: category.id,
      color: category.color,
      included: multiplier > 0,
      relevance: setting.relevance,
      questionCount: category.criteria.length,
      gemini: 0,
      notebook: 0,
      maxGemini: 0,
      maxNotebook: 0,
      geminiScore100: 0,
      notebookScore100: 0,
      geminiRawScore100: 0,
      notebookRawScore100: 0,
      diff: 0
    };

    if (multiplier > 0) {
      totals.activeCategoryCount += 1;
      totals.categoryWeightTotal += multiplier;
      category.criteria.forEach(criterion => {
        const gemini = Number(answers[`${criterion.id}:gemini`] || 0);
        const notebook = Number(answers[`${criterion.id}:notebook`] || 0);
        row.gemini += gemini * criterion.defaultWeights.gemini * multiplier;
        row.notebook += notebook * criterion.defaultWeights.notebooklm * multiplier;
        row.maxGemini += 4 * criterion.defaultWeights.gemini * multiplier;
        row.maxNotebook += 4 * criterion.defaultWeights.notebooklm * multiplier;
      });
      const geminiRawScore100 = rawScore(row.gemini, row.maxGemini);
      const notebookRawScore100 = rawScore(row.notebook, row.maxNotebook);
      row.geminiRawScore100 = rounded(geminiRawScore100);
      row.notebookRawScore100 = rounded(notebookRawScore100);
      row.geminiScore100 = normalizedScore(geminiRawScore100);
      row.notebookScore100 = normalizedScore(notebookRawScore100);
      row.diff = rounded((geminiRawScore100 - notebookRawScore100) / 0.75);
      totals.gemini += row.gemini;
      totals.notebook += row.notebook;
      totals.maxGemini += row.maxGemini;
      totals.maxNotebook += row.maxNotebook;
    } else {
      totals.excludedCategoryCount += 1;
    }
    totals.categories.push(row);
  });

  const geminiRawScore100 = rawScore(totals.gemini, totals.maxGemini);
  const notebookRawScore100 = rawScore(totals.notebook, totals.maxNotebook);
  totals.geminiRawScore100 = rounded(geminiRawScore100);
  totals.notebookRawScore100 = rounded(notebookRawScore100);
  totals.geminiScore100 = normalizedScore(geminiRawScore100);
  totals.notebookScore100 = normalizedScore(notebookRawScore100);
  totals.diff = rounded((geminiRawScore100 - notebookRawScore100) / 0.75);
  return totals;
}

function rawScore(value, maximum) {
  return maximum ? (value / maximum) * 100 : 0;
}

function normalizedScore(raw) {
  return rounded(Math.min(Math.max(((raw - 25) / 75) * 100, 0), 100));
}

function rounded(value) {
  return Math.round(value * 10) / 10;
}
