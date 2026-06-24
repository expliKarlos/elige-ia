const MINIMUM_WEIGHT = 1;
const MAXIMUM_WEIGHT = 10;
const MAXIMUM_RATING = 4;

export function calculateReducedResults(questionnaire, ratings, options = {}) {
  assertQuestionnaire(questionnaire);
  const categorySettings = options.categorySettings || {};
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

  questionnaire.categories.forEach((category) => {
    const setting = categorySettings[category.id] || {};
    const weight = setting.weight ?? category.defaultWeight ?? 1;
    assertWeight(weight, category.id);
    const included = setting.included !== false;
    const row = {
      category: category.label,
      categoryId: category.id,
      color: category.color,
      weight,
      included,
      geminiScore100: 0,
      notebookScore100: 0
    };

    if (included) {
      const gemini = readRating(ratings, category.id, "gemini");
      const notebookLm = readRating(ratings, category.id, "notebooklm");
      row.geminiScore100 = scoreTo100(gemini);
      row.notebookScore100 = scoreTo100(notebookLm);
      totals.gemini += gemini * weight;
      totals.notebook += notebookLm * weight;
      totals.maxGemini += MAXIMUM_RATING * weight;
      totals.maxNotebook += MAXIMUM_RATING * weight;
      totals.categoryWeightTotal += weight;
      totals.activeCategoryCount += 1;
    } else {
      totals.excludedCategoryCount += 1;
    }

    totals.categories.push(row);
  });

  if (totals.activeCategoryCount === 0) {
    throw new RangeError("Debe incluirse al menos una categoría.");
  }

  totals.geminiScore100 = weightedScoreTo100(totals.gemini, totals.maxGemini);
  totals.notebookScore100 = weightedScoreTo100(totals.notebook, totals.maxNotebook);
  totals.diff = roundToTenth(totals.geminiScore100 - totals.notebookScore100);
  return totals;
}

export function validateReducedResponses({
  questionnaire,
  ratings,
  safetyAnswers,
  safetyCriterionIds,
  categorySettings = {}
}) {
  assertQuestionnaire(questionnaire);
  const missingRatings = [];

  questionnaire.categories.forEach((category) => {
    if (categorySettings[category.id]?.included === false) return;
    ["gemini", "notebooklm"].forEach((tool) => {
      const value = Number(ratings[`${category.id}:${tool}`]);
      if (!Number.isInteger(value) || value < 1 || value > 4) {
        missingRatings.push({ categoryId: category.id, tool });
      }
    });
  });

  const missingSafety = safetyCriterionIds.filter((criterionId) => (
    !["yes", "no"].includes(safetyAnswers[criterionId])
  ));

  return {
    complete: missingRatings.length === 0 && missingSafety.length === 0,
    missingRatings,
    missingSafety
  };
}

export function createReducedRiskAnswers(safetyAnswers) {
  return Object.fromEntries(Object.entries(safetyAnswers).flatMap(([criterionId, answer]) => {
    if (!["yes", "no"].includes(answer)) return [];
    const value = answer === "yes" ? 4 : 1;
    return [
      [`${criterionId}:gemini`, value],
      [`${criterionId}:notebook`, value]
    ];
  }));
}

function readRating(ratings, categoryId, tool) {
  const value = Number(ratings[`${categoryId}:${tool}`]);
  if (!Number.isInteger(value) || value < 1 || value > 4) {
    throw new RangeError(`La valoración de ${categoryId}:${tool} debe estar entre 1 y 4.`);
  }
  return value;
}

function assertWeight(value, categoryId) {
  if (!Number.isFinite(value) || value < MINIMUM_WEIGHT || value > MAXIMUM_WEIGHT) {
    throw new RangeError(`El peso de ${categoryId} debe estar entre 1 y 10.`);
  }
}

function assertQuestionnaire(questionnaire) {
  if (!questionnaire || !Array.isArray(questionnaire.categories)) {
    throw new TypeError("El cuestionario no es válido.");
  }
}

function scoreTo100(value) {
  return roundToTenth((value / MAXIMUM_RATING) * 100);
}

function weightedScoreTo100(value, maximum) {
  return maximum > 0 ? roundToTenth((value / maximum) * 100) : 0;
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}
