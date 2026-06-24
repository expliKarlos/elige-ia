const RECOMMENDATIONS = new Set([
  "gemini",
  "notebooklm",
  "both",
  "neither",
  "insufficient_information"
]);

export function validateCalibrationDataset(dataset, options = {}) {
  const minimumCases = options.minimumCases ?? 30;
  const minimumEvaluators = options.minimumEvaluators ?? 3;
  const errors = [];
  const warnings = [];

  if (!dataset || typeof dataset !== "object" || Array.isArray(dataset)) {
    return invalidDataset("El conjunto de calibración debe ser un objeto.");
  }
  if (typeof dataset.schemaVersion !== "string" || !dataset.schemaVersion) {
    errors.push("schemaVersion debe ser texto no vacío.");
  }
  if (!Array.isArray(dataset.cases)) {
    return invalidDataset("cases debe ser un array.", errors);
  }

  const identifiers = new Set();
  dataset.cases.forEach((entry, index) => {
    const path = `cases[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${path} debe ser un objeto.`);
      return;
    }
    if (typeof entry.id !== "string" || !entry.id.trim()) {
      errors.push(`${path}.id debe ser texto no vacío.`);
    } else if (identifiers.has(entry.id)) {
      errors.push(`${path}.id está duplicado: ${entry.id}.`);
    } else {
      identifiers.add(entry.id);
    }
    if (!new Set(["observed", "constructed"]).has(entry.provenance)) {
      errors.push(`${path}.provenance debe ser observed o constructed.`);
    }
    if (typeof entry.scenario !== "string" || !entry.scenario.trim()) {
      errors.push(`${path}.scenario debe describir el caso sin datos personales.`);
    }
    validateRecommendation(entry.detailed?.recommendation, `${path}.detailed.recommendation`, errors);
    validateRecommendation(entry.reduced?.recommendation, `${path}.reduced.recommendation`, errors);
    const evaluatorIds = new Set();
    for (const [ratingIndex, rating] of (entry.expertRatings || []).entries()) {
      validateRecommendation(rating?.recommendation, `${path}.expertRatings[${ratingIndex}].recommendation`, errors);
      if (!rating?.evaluatorId || evaluatorIds.has(rating.evaluatorId)) {
        errors.push(`${path}.expertRatings requiere evaluatorId únicos.`);
      } else {
        evaluatorIds.add(rating.evaluatorId);
      }
    }
    if (entry.provenance === "observed" && evaluatorIds.size < minimumEvaluators) {
      warnings.push(`${entry.id || path} necesita ${minimumEvaluators} evaluadores independientes.`);
    }
  });

  const realCaseCount = dataset.cases.filter((entry) => entry?.provenance === "observed").length;
  if (realCaseCount < minimumCases) {
    warnings.push(`La calibración requiere al menos ${minimumCases} casos reales; hay ${realCaseCount}.`);
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    caseCount: dataset.cases.length,
    realCaseCount,
    readyForFieldCalibration: errors.length === 0 && realCaseCount >= minimumCases
  };
}

export function calculateCalibrationMetrics(dataset) {
  const cases = Array.isArray(dataset?.cases)
    ? dataset.cases.filter((entry) => entry?.provenance === "observed")
    : [];
  let expertAgreementNumerator = 0;
  let expertAgreementDenominator = 0;
  let consensusAgreementNumerator = 0;
  let consensusAgreementDenominator = 0;
  let reducedAgreementNumerator = 0;
  let reducedAgreementDenominator = 0;
  let criticalDetectionNumerator = 0;
  let criticalDetectionDenominator = 0;
  let falsePositiveCases = 0;
  let falseNegativeCases = 0;
  let incompleteDefinitiveCases = 0;
  let weightSensitivityViolations = 0;
  let weightSensitivityEvaluatedCases = 0;

  for (const entry of cases) {
    const ratings = (entry.expertRatings || []).map((rating) => rating.recommendation);
    for (let left = 0; left < ratings.length; left += 1) {
      for (let right = left + 1; right < ratings.length; right += 1) {
        expertAgreementDenominator += 1;
        if (ratings[left] === ratings[right]) expertAgreementNumerator += 1;
      }
    }

    const consensus = findConsensus(ratings);
    if (consensus && RECOMMENDATIONS.has(entry.detailed?.recommendation)) {
      consensusAgreementDenominator += 1;
      if (entry.detailed.recommendation === consensus) consensusAgreementNumerator += 1;
      const expertTools = recommendationTools(consensus);
      const automaticTools = recommendationTools(entry.detailed.recommendation);
      if ([...automaticTools].some((tool) => !expertTools.has(tool))) falsePositiveCases += 1;
      if ([...expertTools].some((tool) => !automaticTools.has(tool))) falseNegativeCases += 1;
    }
    if (RECOMMENDATIONS.has(entry.detailed?.recommendation)
      && RECOMMENDATIONS.has(entry.reduced?.recommendation)) {
      reducedAgreementDenominator += 1;
      if (entry.detailed.recommendation === entry.reduced.recommendation) {
        reducedAgreementNumerator += 1;
      }
    }
    if (entry.criticalContraindication?.expected === true) {
      criticalDetectionDenominator += 1;
      if (entry.criticalContraindication.detected === true) criticalDetectionNumerator += 1;
    }
    if (entry.incomplete === true && entry.detailed?.status !== "not_interpretable") {
      incompleteDefinitiveCases += 1;
    }
    if (typeof entry.weightSensitivity?.withinFivePercentChanged === "boolean"
      && typeof entry.weightSensitivity?.nearThreshold === "boolean") {
      weightSensitivityEvaluatedCases += 1;
      if (entry.weightSensitivity.withinFivePercentChanged === true
        && entry.weightSensitivity.nearThreshold !== true) {
        weightSensitivityViolations += 1;
      }
    }
  }

  const metrics = {
    realCaseCount: cases.length,
    expertAgreement: ratio(expertAgreementNumerator, expertAgreementDenominator),
    automaticConsensusAgreement: ratio(consensusAgreementNumerator, consensusAgreementDenominator),
    detailedReducedConcordance: ratio(reducedAgreementNumerator, reducedAgreementDenominator),
    criticalContraindicationDetection: ratio(criticalDetectionNumerator, criticalDetectionDenominator),
    falsePositiveCases,
    falseNegativeCases,
    incompleteDefinitiveCases,
    weightSensitivityViolations,
    weightSensitivityEvaluatedCases
  };
  metrics.acceptance = evaluateAcceptance(metrics);
  return metrics;
}

function evaluateAcceptance(metrics) {
  const criteria = {
    minimumSample: metrics.realCaseCount >= 30 ? "met" : "not_met",
    criticalDetection: rateStatus(metrics.criticalContraindicationDetection.rate, 1),
    incompleteSafety: metrics.incompleteDefinitiveCases === 0 ? "met" : "not_met",
    expertAgreement: rateStatus(metrics.automaticConsensusAgreement.rate, 0.8),
    reducedConcordance: rateStatus(metrics.detailedReducedConcordance.rate, 0.75),
    weightStability: metrics.realCaseCount > 0
      && metrics.weightSensitivityEvaluatedCases < metrics.realCaseCount
      ? "not_evaluable"
      : metrics.weightSensitivityViolations === 0 ? "met" : "not_met"
  };
  const evaluated = Object.values(criteria).filter((status) => status !== "not_evaluable");
  const overall = evaluated.includes("not_met") && metrics.realCaseCount > 0
    ? "not_met"
    : Object.values(criteria).every((status) => status === "met")
      ? "met"
      : "insufficient_evidence";
  return { overall, criteria };
}

function findConsensus(ratings) {
  if (ratings.length < 3) return null;
  const counts = new Map();
  ratings.forEach((rating) => counts.set(rating, (counts.get(rating) || 0) + 1));
  const ordered = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  return ordered[0][1] > ratings.length / 2 ? ordered[0][0] : null;
}

function recommendationTools(recommendation) {
  if (recommendation === "gemini") return new Set(["gemini"]);
  if (recommendation === "notebooklm") return new Set(["notebooklm"]);
  if (recommendation === "both") return new Set(["gemini", "notebooklm"]);
  return new Set();
}

function ratio(numerator, denominator) {
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? null : Math.round((numerator / denominator) * 10000) / 10000
  };
}

function rateStatus(rate, minimum) {
  if (rate === null) return "not_evaluable";
  return rate >= minimum ? "met" : "not_met";
}

function validateRecommendation(value, path, errors) {
  if (!RECOMMENDATIONS.has(value)) {
    errors.push(`${path} contiene una recomendación desconocida.`);
  }
}

function invalidDataset(message, priorErrors = []) {
  return {
    valid: false,
    errors: [...priorErrors, message],
    warnings: [],
    caseCount: 0,
    realCaseCount: 0,
    readyForFieldCalibration: false
  };
}
