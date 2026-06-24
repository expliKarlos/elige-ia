const DEFAULT_EFFECTIVE_MINIMUM = 25;
const DEFAULT_EFFECTIVE_MAXIMUM = 100;

export function validateInterpretationMatrix(matrix) {
  const errors = [];
  if (!matrix || typeof matrix !== "object" || Array.isArray(matrix)) {
    return { valid: false, errors: ["La matriz debe ser un objeto."] };
  }
  if (typeof matrix.schemaVersion !== "string" || !matrix.schemaVersion) {
    errors.push("schemaVersion debe ser texto no vacío.");
  }
  if (!matrix.scoreModel || !Number.isFinite(matrix.scoreModel.minimumValidCompleteScore)
    || !Number.isFinite(matrix.scoreModel.scaleMaximum)
    || matrix.scoreModel.scaleMaximum <= matrix.scoreModel.minimumValidCompleteScore) {
    errors.push("scoreModel debe definir una horquilla completa válida.");
  }
  ["individualBands", "differenceBands", "jointProfiles", "jointSuitabilityMatrix"].forEach((field) => {
    if (!Array.isArray(matrix[field]) || matrix[field].length === 0) {
      errors.push(`${field} debe ser un array no vacío.`);
    }
  });
  return { valid: errors.length === 0, errors };
}

export function positionInEffectiveRange(
  score,
  minimum = DEFAULT_EFFECTIVE_MINIMUM,
  maximum = DEFAULT_EFFECTIVE_MAXIMUM
) {
  if (!Number.isFinite(score) || !Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum <= minimum) {
    return 0;
  }
  const position = ((score - minimum) / (maximum - minimum)) * 100;
  return roundToTenth(Math.min(Math.max(position, 0), 100));
}

export function interpretSurveyResults({ matrix, questionnaire, answers, results, context = {} }) {
  assertInterpretationInputs(matrix, questionnaire, results);

  const minimum = matrix.scoreModel.minimumValidCompleteScore;
  const maximum = matrix.scoreModel.scaleMaximum;
  const geminiScore = Number(results.geminiScore100);
  const notebookLmScore = Number(results.notebookScore100);
  const absoluteDifference = roundToTenth(Math.abs(geminiScore - notebookLmScore));
  const difference = roundToTenth(geminiScore - notebookLmScore);
  const geminiBand = findRange(matrix.individualBands, geminiScore);
  const notebookLmBand = findRange(matrix.individualBands, notebookLmScore);
  const differenceBand = findRange(matrix.differenceBands, absoluteDifference);
  const jointEntry = matrix.jointSuitabilityMatrix.find((entry) => (
    entry.geminiBandId === geminiBand?.id && entry.notebookLmBandId === notebookLmBand?.id
  ));
  const jointProfile = matrix.jointProfiles.find((profile) => profile.id === jointEntry?.profileId);
  const signals = collectRiskSignals(questionnaire, answers || {}, context.categoryIds);
  const blockingSignals = signals.filter((signal) => signal.severity === "blocking");
  const conditionalSignals = signals.filter((signal) => signal.severity === "conditional");
  const excludedRiskCategories = findExcludedRiskCategories(questionnaire, results, context);
  const scoresAreValid = [geminiScore, notebookLmScore].every((score) => (
    Number.isFinite(score) && score >= minimum && score <= maximum
  ));
  const isComplete = context.isComplete !== false;

  let status = "ready";
  if (!isComplete || !scoresAreValid || !jointProfile || !differenceBand) {
    status = "not_interpretable";
  }
  else if (blockingSignals.length) status = "blocked";
  else if (conditionalSignals.length || excludedRiskCategories.length) status = "conditional";

  const baseRecommendation = recommendationForProfile(jointProfile);
  const recommendation = status === "blocked"
    ? "neither"
    : status === "not_interpretable" ? null : baseRecommendation;
  const disclosures = createDisclosures(results, context, matrix, excludedRiskCategories);
  const primaryMessage = createPrimaryMessage({
    status,
    isComplete,
    scoresAreValid,
    jointProfile,
    differenceBand,
    blockingSignals,
    conditionalSignals,
    excludedRiskCategories,
    geminiScore,
    notebookLmScore,
    geminiBand,
    notebookLmBand,
    absoluteDifference
  });

  return {
    status,
    recommendation,
    primaryMessage,
    effectiveRange: {
      minimum,
      maximum,
      span: maximum - minimum,
      explanation: `La escala completa observable va de ${minimum} a ${maximum}; los pesos modifican la influencia, no estos extremos.`
    },
    tools: {
      gemini: createToolInterpretation(geminiScore, geminiBand, minimum, maximum),
      notebookLm: createToolInterpretation(notebookLmScore, notebookLmBand, minimum, maximum)
    },
    comparison: {
      difference,
      absoluteDifference,
      preferredTool: difference > 0 ? "gemini" : difference < 0 ? "notebookLm" : null,
      band: differenceBand || null
    },
    jointProfile: jointProfile || null,
    signals,
    disclosures,
    recommendedActions: createActions(status, jointProfile, signals, excludedRiskCategories)
  };
}

function createToolInterpretation(score, band, minimum, maximum) {
  return {
    score,
    effectiveRangePosition: positionInEffectiveRange(score, minimum, maximum),
    band: band || null
  };
}

function collectRiskSignals(questionnaire, answers, categoryIds) {
  const allowedCategories = Array.isArray(categoryIds) ? new Set(categoryIds) : null;
  return questionnaire.categories.flatMap((category) => {
    if (allowedCategories && !allowedCategories.has(category.id)) return [];
    return category.criteria.flatMap((criterion) => {
    if (!criterion.risk) return [];
    const geminiAnswer = readAnswer(answers, criterion.id, "gemini");
    const notebookLmAnswer = readAnswer(answers, criterion.id, "notebook");
    const highestAnswer = Math.max(geminiAnswer, notebookLmAnswer);
    if (highestAnswer < criterion.risk.triggerAnswerMinimum) return [];
    return [{
      criterionId: criterion.id,
      criterionLabel: criterion.label,
      categoryId: category.id,
      categoryLabel: category.label,
      polarity: criterion.risk.polarity,
      severity: criterion.risk.severity,
      scope: criterion.risk.scope,
      message: criterion.risk.message,
      answers: { gemini: geminiAnswer, notebookLm: notebookLmAnswer }
    }];
    });
  });
}

function createDisclosures(results, context, matrix, excludedRiskCategories) {
  const disclosures = [];
  if (Number(results.excludedCategoryCount) > 0) {
    disclosures.push({
      id: "excluded_categories",
      message: `${results.excludedCategoryCount} categorías no participan en este resultado.`
    });
  }
  if (excludedRiskCategories.length) {
    disclosures.push({
      id: "risk_categories_excluded",
      message: `No se han evaluado categorías necesarias para comprobar riesgos: ${excludedRiskCategories.map((category) => category.label).join(", ")}.`
    });
  }
  if (Number(context.weightOverrideCount) > 0) {
    disclosures.push({
      id: "weight_overrides",
      message: `${context.weightOverrideCount} grupos de pesos han sido modificados.`
    });
  }
  if (String(matrix.status).includes("provisional")) {
    disclosures.push({
      id: "provisional_thresholds",
      message: "Las bandas interpretativas son orientativas y deberán revisarse con evidencia de uso real."
    });
  }
  return disclosures;
}

function findExcludedRiskCategories(questionnaire, results, context) {
  if (context.scope === "category") return [];
  const includedById = new Map((results.categories || []).map((category) => [category.categoryId, category.included]));
  return questionnaire.categories.filter((category) => (
    category.criteria.some((criterion) => criterion.risk)
    && includedById.get(category.id) === false
  ));
}

function createPrimaryMessage({
  status,
  isComplete,
  scoresAreValid,
  jointProfile,
  differenceBand,
  blockingSignals,
  conditionalSignals,
  excludedRiskCategories,
  geminiScore,
  notebookLmScore,
  geminiBand,
  notebookLmBand,
  absoluteDifference
}) {
  if (status === "not_interpretable") {
    if (!isComplete) return "No se puede interpretar el resultado porque faltan respuestas por completar.";
    if (!scoresAreValid) return "No se puede interpretar el resultado porque alguna puntuación queda fuera del intervalo válido.";
    return "No se puede interpretar el resultado porque la matriz no contiene una regla para esta combinación.";
  }
  if (status === "blocked") {
    return `No se recomienda ninguna herramienta: ${blockingSignals[0].message}`;
  }

  const comparison = createComparisonMessage({
    geminiScore,
    notebookLmScore,
    geminiBand,
    notebookLmBand,
    differenceBand,
    absoluteDifference
  });
  const cautions = [];
  if (excludedRiskCategories.length) {
    cautions.push(
      `La conclusión comparativa es válida, pero la decisión de adopción es provisional hasta evaluar ${excludedRiskCategories.map((category) => category.label).join(" y ")}.`
    );
  }
  if (conditionalSignals.length) {
    cautions.push("La recomendación queda condicionada a resolver los riesgos detectados.");
  }
  return [comparison, jointProfile.summary, ...cautions].join(" ");
}

function createComparisonMessage({
  geminiScore,
  notebookLmScore,
  geminiBand,
  notebookLmBand,
  differenceBand,
  absoluteDifference
}) {
  if (geminiScore === notebookLmScore) {
    return `Gemini y NotebookLM obtienen ${formatScore(geminiScore)} puntos (${geminiBand.label}). No existe diferencia entre ambas.`;
  }

  const notebookWins = notebookLmScore > geminiScore;
  const winner = notebookWins
    ? { name: "NotebookLM", score: notebookLmScore, band: notebookLmBand }
    : { name: "Gemini", score: geminiScore, band: geminiBand };
  const other = notebookWins
    ? { name: "Gemini", score: geminiScore, band: geminiBand }
    : { name: "NotebookLM", score: notebookLmScore, band: notebookLmBand };
  return `${winner.name} obtiene ${formatScore(winner.score)} puntos (${winner.band.label}), frente a ${other.name} con ${formatScore(other.score)} puntos (${other.band.label}). La diferencia es de ${formatScore(absoluteDifference)} puntos y se clasifica como ${differenceBand.label}.`;
}

function createActions(status, jointProfile, signals, excludedRiskCategories) {
  if (status === "not_interpretable") return ["Completar y validar los datos antes de decidir."];
  if (status === "blocked") {
    return ["No utilizar ninguna herramienta en este caso.", ...signals.map((signal) => signal.message)];
  }
  const riskAction = excludedRiskCategories.length
    ? ["Completar las categorías de riesgo excluidas antes de adoptar la herramienta."]
    : [];
  return [...(jointProfile?.recommendedActions || []), ...riskAction, ...signals.map((signal) => signal.message)];
}

function recommendationForProfile(profile) {
  if (!profile) return null;
  if (profile.classification === "neither") return "neither";
  if (profile.classification.startsWith("gemini")) return "gemini";
  if (profile.classification.startsWith("notebooklm")) return "notebookLm";
  if (profile.classification.startsWith("both")) return "both";
  return null;
}

function findRange(entries, value) {
  return entries.find((entry) => contains(entry.range, value));
}

function contains(range, value) {
  return (range.minInclusive === undefined || value >= range.minInclusive)
    && (range.minExclusive === undefined || value > range.minExclusive)
    && (range.maxInclusive === undefined || value <= range.maxInclusive)
    && (range.maxExclusive === undefined || value < range.maxExclusive);
}

function readAnswer(answers, criterionId, tool) {
  const value = Number(answers[`${criterionId}:${tool}`] || 0);
  return Number.isInteger(value) && value >= 1 && value <= 4 ? value : 0;
}

function assertInterpretationInputs(matrix, questionnaire, results) {
  const matrixValidation = validateInterpretationMatrix(matrix);
  if (!matrixValidation.valid) throw new TypeError(matrixValidation.errors.join(" "));
  if (!questionnaire || !Array.isArray(questionnaire.categories)) {
    throw new TypeError("El cuestionario no es válido.");
  }
  if (!results || typeof results !== "object") {
    throw new TypeError("Los resultados no son válidos.");
  }
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function formatScore(value) {
  return String(roundToTenth(value)).replace(".", ",");
}
