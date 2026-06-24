const MINIMUM_WEIGHT = 1;
const MAXIMUM_WEIGHT = 10;
const MAXIMUM_RATING = 4;
const RAW_SCORE_MINIMUM = 25;
const RAW_SCORE_SPAN = 75;

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
      geminiRawScore100: 0,
      notebookRawScore100: 0,
      geminiScore100: 0,
      notebookScore100: 0
    };

    if (included) {
      const sharedNeed = readSharedRating(ratings, category.id);
      const usesSharedNeed = sharedNeed !== null;
      const gemini = usesSharedNeed ? sharedNeed : readRating(ratings, category.id, "gemini");
      const notebookLm = usesSharedNeed ? sharedNeed : readRating(ratings, category.id, "notebooklm");
      const toolWeights = usesSharedNeed ? categoryToolWeights(category) : { gemini: 1, notebooklm: 1 };
      const geminiRawScore100 = rawScoreTo100(gemini, MAXIMUM_RATING);
      const notebookRawScore100 = rawScoreTo100(notebookLm, MAXIMUM_RATING);
      row.geminiRawScore100 = roundToTenth(geminiRawScore100);
      row.notebookRawScore100 = roundToTenth(notebookRawScore100);
      row.geminiScore100 = normalizeRawScore100(geminiRawScore100);
      row.notebookScore100 = normalizeRawScore100(notebookRawScore100);
      row.need = usesSharedNeed ? sharedNeed : null;
      totals.gemini += gemini * weight * toolWeights.gemini;
      totals.notebook += notebookLm * weight * toolWeights.notebooklm;
      totals.maxGemini += MAXIMUM_RATING * weight * toolWeights.gemini;
      totals.maxNotebook += MAXIMUM_RATING * weight * toolWeights.notebooklm;
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

  const geminiRawScore100 = rawScoreTo100(totals.gemini, totals.maxGemini);
  const notebookRawScore100 = rawScoreTo100(totals.notebook, totals.maxNotebook);
  totals.geminiRawScore100 = roundToTenth(geminiRawScore100);
  totals.notebookRawScore100 = roundToTenth(notebookRawScore100);
  totals.geminiScore100 = normalizeRawScore100(geminiRawScore100);
  totals.notebookScore100 = normalizeRawScore100(notebookRawScore100);
  totals.diff = roundToTenth(((geminiRawScore100 - notebookRawScore100) / RAW_SCORE_SPAN) * 100);
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
    const sharedValue = Number(ratings[category.id]);
    if (Number.isInteger(sharedValue) && sharedValue >= 1 && sharedValue <= 4) return;
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
    return [[criterionId, value]];
  }));
}

function readSharedRating(ratings, categoryId) {
  const value = Number(ratings[categoryId]);
  return Number.isInteger(value) && value >= 1 && value <= 4 ? value : null;
}

function categoryToolWeights(category) {
  if (!Array.isArray(category.criteria) || category.criteria.length === 0) {
    throw new TypeError(`La categoría ${category.id} debe incluir criterios ponderados.`);
  }
  return category.criteria.reduce((totals, criterion) => ({
    gemini: totals.gemini + Number(criterion.defaultWeights?.gemini || 0),
    notebooklm: totals.notebooklm + Number(criterion.defaultWeights?.notebooklm || 0)
  }), { gemini: 0, notebooklm: 0 });
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

function normalizeRawScore100(rawScore) {
  const normalized = ((rawScore - RAW_SCORE_MINIMUM) / RAW_SCORE_SPAN) * 100;
  return roundToTenth(Math.min(Math.max(normalized, 0), 100));
}

function rawScoreTo100(value, maximum) {
  return maximum > 0 ? (value / maximum) * 100 : 0;
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}
