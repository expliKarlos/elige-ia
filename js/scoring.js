const TOOLS = ["gemini", "notebooklm"];
const ANSWER_TOOL = { gemini: "gemini", notebooklm: "notebook" };
const MINIMUM_WEIGHT = 1;
const MAXIMUM_WEIGHT = 10;

export function calculateSurveyResults(questionnaire, answers, options = {}) {
  const effectiveWeights = resolveWeightConfig(questionnaire, options.weightOverrides);
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

  questionnaire.categories.forEach(category => {
    const setting = categorySettings[category.id] || {};
    const relevance = setting.relevance ?? effectiveWeights.categories[category.id];
    assertWeight(relevance, `categories.${category.id}`);
    const included = setting.included !== false;
    const multiplier = included ? relevance : 0;
    const row = createCategoryRow(category, included, relevance);

    if (included) {
      totals.activeCategoryCount += 1;
      totals.categoryWeightTotal += multiplier;
      category.criteria.forEach(criterion => {
        addCriterionScores(row, criterion, answers, effectiveWeights, multiplier);
      });
      completeCategoryScores(row);
      totals.gemini += row.gemini;
      totals.notebook += row.notebook;
      totals.maxGemini += row.maxGemini;
      totals.maxNotebook += row.maxNotebook;
    } else {
      totals.excludedCategoryCount += 1;
    }

    totals.categories.push(row);
  });

  totals.geminiScore100 = scoreTo100(totals.gemini, totals.maxGemini);
  totals.notebookScore100 = scoreTo100(totals.notebook, totals.maxNotebook);
  totals.diff = roundToTenth(totals.geminiScore100 - totals.notebookScore100);
  return totals;
}

export function calculateCategoryResult(questionnaire, categoryId, answers, options = {}) {
  const category = questionnaire.categories.find(candidate => candidate.id === categoryId);
  if (!category) throw new Error(`No existe la categoría "${categoryId}".`);

  const effectiveWeights = resolveWeightConfig(questionnaire, options.weightOverrides);
  const result = {
    category: category.label,
    categoryId: category.id,
    color: category.color,
    gemini: 0,
    notebook: 0,
    maxGemini: 0,
    maxNotebook: 0,
    criteria: []
  };

  category.criteria.forEach(criterion => {
    const geminiValue = readAnswer(answers, criterion.id, "gemini");
    const notebookValue = readAnswer(answers, criterion.id, "notebooklm");
    const weights = effectiveWeights.criteria[criterion.id];
    result.gemini += geminiValue * weights.gemini;
    result.notebook += notebookValue * weights.notebooklm;
    result.maxGemini += 4 * weights.gemini;
    result.maxNotebook += 4 * weights.notebooklm;
    result.criteria.push({
      criterion: criterion.label,
      criterionId: criterion.id,
      geminiScore100: scoreTo100(geminiValue, 4),
      notebookScore100: scoreTo100(notebookValue, 4)
    });
  });

  result.geminiScore100 = scoreTo100(result.gemini, result.maxGemini);
  result.notebookScore100 = scoreTo100(result.notebook, result.maxNotebook);
  result.diff = roundToTenth(result.geminiScore100 - result.notebookScore100);
  return result;
}

export function createDefaultWeightConfig(questionnaire) {
  return {
    categories: Object.fromEntries(questionnaire.categories.map(category => [
      category.id,
      category.defaultWeight
    ])),
    criteria: Object.fromEntries(questionnaire.categories.flatMap(category =>
      category.criteria.map(criterion => [
        criterion.id,
        { ...criterion.defaultWeights }
      ])
    ))
  };
}

export function resolveWeightConfig(questionnaire, overrides = {}) {
  const effective = createDefaultWeightConfig(questionnaire);
  const categoryOverrides = overrides?.categories || {};
  const criterionOverrides = overrides?.criteria || {};

  Object.entries(categoryOverrides).forEach(([categoryId, weight]) => {
    if (!(categoryId in effective.categories)) return;
    assertWeight(weight, `categories.${categoryId}`);
    effective.categories[categoryId] = weight;
  });

  Object.entries(criterionOverrides).forEach(([criterionId, weights]) => {
    if (!(criterionId in effective.criteria) || !weights || typeof weights !== "object") return;
    TOOLS.forEach(tool => {
      if (weights[tool] === undefined) return;
      assertWeight(weights[tool], `criteria.${criterionId}.${tool}`);
      effective.criteria[criterionId][tool] = weights[tool];
    });
  });

  return effective;
}

export function resetCriterionWeights(overrides = {}, criterionId) {
  const criteria = { ...(overrides.criteria || {}) };
  delete criteria[criterionId];
  return {
    ...overrides,
    categories: { ...(overrides.categories || {}) },
    criteria
  };
}

export function resetCategoryWeight(overrides = {}, categoryId) {
  const categories = { ...(overrides.categories || {}) };
  delete categories[categoryId];
  return {
    ...overrides,
    categories,
    criteria: { ...(overrides.criteria || {}) }
  };
}

export function scoreTo100(value, maximum) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return roundToTenth((value / maximum) * 100);
}

function createCategoryRow(category, included, relevance) {
  return {
    category: category.label,
    categoryId: category.id,
    color: category.color,
    included,
    relevance,
    questionCount: category.criteria.length,
    gemini: 0,
    notebook: 0,
    maxGemini: 0,
    maxNotebook: 0,
    geminiScore100: 0,
    notebookScore100: 0,
    diff: 0
  };
}

function addCriterionScores(row, criterion, answers, effectiveWeights, multiplier) {
  const geminiValue = readAnswer(answers, criterion.id, "gemini");
  const notebookValue = readAnswer(answers, criterion.id, "notebooklm");
  const weights = effectiveWeights.criteria[criterion.id];
  row.gemini += geminiValue * weights.gemini * multiplier;
  row.notebook += notebookValue * weights.notebooklm * multiplier;
  row.maxGemini += 4 * weights.gemini * multiplier;
  row.maxNotebook += 4 * weights.notebooklm * multiplier;
}

function completeCategoryScores(row) {
  row.geminiScore100 = scoreTo100(row.gemini, row.maxGemini);
  row.notebookScore100 = scoreTo100(row.notebook, row.maxNotebook);
  row.diff = roundToTenth(row.geminiScore100 - row.notebookScore100);
}

function readAnswer(answers, criterionId, tool) {
  const value = Number(answers?.[`${criterionId}:${ANSWER_TOOL[tool]}`] || 0);
  return Number.isFinite(value) && value >= 1 && value <= 4 ? value : 0;
}

function assertWeight(value, path) {
  if (!Number.isFinite(value) || value < MINIMUM_WEIGHT || value > MAXIMUM_WEIGHT) {
    throw new RangeError(`${path} debe ser un número entre ${MINIMUM_WEIGHT} y ${MAXIMUM_WEIGHT}.`);
  }
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}
