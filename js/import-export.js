const FORMAT_VERSION = "1.0";
const MAX_IMPORT_BYTES = 1_000_000;
const SESSION_KIND = "survey-session";
const WEIGHTS_KIND = "weight-configuration";

export function createSessionDocument({ questionnaire, state, results, exportedAt = new Date().toISOString() }) {
  const categorySelection = Object.fromEntries(questionnaire.categories.map((category, index) => [
    category.id,
    { included: state.categoryPrefs?.[index]?.included !== false }
  ]));
  const activeCategory = questionnaire.categories[state.activeCategoryIndex] || questionnaire.categories[0];

  return {
    kind: SESSION_KIND,
    formatVersion: FORMAT_VERSION,
    questionnaire: questionnaireIdentity(questionnaire),
    exportedAt: validateExportedAt(exportedAt),
    data: {
      answers: sanitizeAnswers(state.answers, questionnaire),
      categorySelection,
      activeCategoryId: activeCategory?.id || null,
      weights: sanitizeWeightOverrides(state.weightOverrides, questionnaire)
    },
    results: results && typeof results === "object" ? results : null
  };
}

export function createWeightsDocument({ questionnaire, weightOverrides, exportedAt = new Date().toISOString() }) {
  return {
    kind: WEIGHTS_KIND,
    formatVersion: FORMAT_VERSION,
    questionnaire: questionnaireIdentity(questionnaire),
    exportedAt: validateExportedAt(exportedAt),
    data: {
      weights: sanitizeWeightOverrides(weightOverrides, questionnaire)
    }
  };
}

export function parseImportText(text, questionnaire) {
  if (typeof text !== "string") throw new TypeError("El archivo debe contener texto JSON.");
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    throw new Error("El archivo supera el límite permitido de 1 MB.");
  }

  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error("El archivo no contiene JSON válido.");
  }

  requireObject(document, "documento");
  if (![SESSION_KIND, WEIGHTS_KIND].includes(document.kind)) {
    throw new Error("El tipo de documento JSON no está admitido.");
  }
  if (document.formatVersion !== FORMAT_VERSION) {
    throw new Error(`La versión de formato debe ser ${FORMAT_VERSION}.`);
  }
  validateQuestionnaireIdentity(document.questionnaire, questionnaire);
  const exportedAt = validateExportedAt(document.exportedAt);
  requireObject(document.data, "data");
  const weightOverrides = sanitizeWeightOverrides(document.data.weights, questionnaire);
  const modifiedGroups = countModifiedGroups(weightOverrides);

  if (document.kind === WEIGHTS_KIND) {
    return {
      kind: WEIGHTS_KIND,
      weightOverrides,
      preview: { exportedAt, modifiedGroups }
    };
  }

  const answers = sanitizeAnswers(document.data.answers, questionnaire);
  const categorySelection = sanitizeCategorySelection(document.data.categorySelection, questionnaire);
  const activeCategoryId = sanitizeActiveCategory(document.data.activeCategoryId, questionnaire);
  return {
    kind: SESSION_KIND,
    state: { answers, categorySelection, activeCategoryId, weightOverrides },
    preview: {
      exportedAt,
      answerCount: Object.keys(answers).length,
      includedCategoryCount: Object.values(categorySelection).filter(value => value.included).length,
      modifiedGroups
    }
  };
}

export function serializeJson(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

function questionnaireIdentity(questionnaire) {
  return { id: questionnaire.questionnaireId, version: questionnaire.questionnaireVersion };
}

function validateQuestionnaireIdentity(identity, questionnaire) {
  requireObject(identity, "questionnaire");
  if (identity.id !== questionnaire.questionnaireId) {
    throw new Error("El archivo pertenece a un cuestionario diferente.");
  }
  if (identity.version !== questionnaire.questionnaireVersion) {
    throw new Error("La versión del cuestionario no es compatible.");
  }
}

function sanitizeWeightOverrides(rawWeights = {}, questionnaire) {
  requireObject(rawWeights, "data.weights");
  const rawCategories = rawWeights.categories ?? {};
  const rawCriteria = rawWeights.criteria ?? {};
  requireObject(rawCategories, "data.weights.categories");
  requireObject(rawCriteria, "data.weights.criteria");

  const knownCategories = new Map(questionnaire.categories.map(category => [category.id, category]));
  const knownCriteria = new Map(questionnaire.categories.flatMap(category =>
    category.criteria.map(criterion => [criterion.id, criterion])
  ));
  const categories = {};
  const criteria = {};

  Object.entries(rawCategories).forEach(([categoryId, value]) => {
    const category = knownCategories.get(categoryId);
    if (!category) throw new Error(`La categoría "${categoryId}" es desconocida.`);
    const weight = requireWeight(value, `data.weights.categories.${categoryId}`);
    if (weight !== category.defaultWeight) categories[categoryId] = weight;
  });

  Object.entries(rawCriteria).forEach(([criterionId, rawTools]) => {
    const criterion = knownCriteria.get(criterionId);
    if (!criterion) throw new Error(`El criterio "${criterionId}" es desconocido.`);
    requireObject(rawTools, `data.weights.criteria.${criterionId}`);
    const tools = {};
    Object.keys(rawTools).forEach(tool => {
      if (!["gemini", "notebooklm"].includes(tool)) {
        throw new Error(`La herramienta "${tool}" es desconocida.`);
      }
      const weight = requireWeight(rawTools[tool], `data.weights.criteria.${criterionId}.${tool}`);
      if (weight !== criterion.defaultWeights[tool]) tools[tool] = weight;
    });
    if (Object.keys(tools).length) criteria[criterionId] = tools;
  });

  return { categories, criteria };
}

function sanitizeAnswers(rawAnswers = {}, questionnaire) {
  requireObject(rawAnswers, "data.answers");
  const criterionIds = new Set(questionnaire.categories.flatMap(category =>
    category.criteria.map(criterion => criterion.id)
  ));
  const knownKeys = new Set([...criterionIds].flatMap(criterionId => [
    criterionId,
    `${criterionId}:gemini`,
    `${criterionId}:notebook`
  ]));
  const answers = {};
  const legacyAnswers = {};
  Object.entries(rawAnswers).forEach(([key, rawValue]) => {
    if (!knownKeys.has(key)) throw new Error(`La respuesta "${key}" es desconocida.`);
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 1 || value > 4) {
      throw new Error(`La respuesta "${key}" debe ser un entero entre 1 y 4.`);
    }
    if (criterionIds.has(key)) {
      answers[key] = value;
      return;
    }
    const [criterionId, tool] = key.split(":");
    legacyAnswers[criterionId] ||= {};
    legacyAnswers[criterionId][tool] = value;
  });
  Object.entries(legacyAnswers).forEach(([criterionId, tools]) => {
    if (answers[criterionId] !== undefined) return;
    if (tools.gemini === undefined || tools.notebook === undefined || tools.gemini !== tools.notebook) {
      throw new Error(`Las respuestas históricas de "${criterionId}" no pueden convertirse en una necesidad única.`);
    }
    answers[criterionId] = tools.gemini;
  });
  return answers;
}

function sanitizeCategorySelection(rawSelection = {}, questionnaire) {
  requireObject(rawSelection, "data.categorySelection");
  const knownIds = new Set(questionnaire.categories.map(category => category.id));
  Object.keys(rawSelection).forEach(categoryId => {
    if (!knownIds.has(categoryId)) throw new Error(`La categoría "${categoryId}" es desconocida.`);
  });
  return Object.fromEntries(questionnaire.categories.map(category => {
    const raw = rawSelection[category.id];
    if (raw !== undefined) {
      requireObject(raw, `data.categorySelection.${category.id}`);
      if (typeof raw.included !== "boolean") {
        throw new Error(`data.categorySelection.${category.id}.included debe ser booleano.`);
      }
    }
    return [category.id, { included: raw?.included !== false }];
  }));
}

function sanitizeActiveCategory(categoryId, questionnaire) {
  if (categoryId === null || categoryId === undefined) return questionnaire.categories[0]?.id || null;
  if (!questionnaire.categories.some(category => category.id === categoryId)) {
    throw new Error(`La categoría activa "${categoryId}" es desconocida.`);
  }
  return categoryId;
}

function validateExportedAt(value) {
  if (typeof value !== "string" || value.length > 40 || Number.isNaN(Date.parse(value))) {
    throw new Error("exportedAt debe ser una fecha ISO válida.");
  }
  return value;
}

function requireWeight(rawValue, path) {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 1 || value > 10) {
    throw new Error(`${path} debe ser un número entre 1 y 10.`);
  }
  return value;
}

function requireObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} debe ser un objeto.`);
  }
}

function countModifiedGroups(weightOverrides) {
  return Object.keys(weightOverrides.categories).length + Object.keys(weightOverrides.criteria).length;
}
