const WEIGHT_MINIMUM = 1;
const WEIGHT_MAXIMUM = 10;
const HEX_COLOR = /^#[0-9A-F]{6}$/i;
const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RISK_POLARITIES = new Set(["risk", "contraindication"]);
const RISK_SEVERITIES = new Set(["conditional", "blocking"]);
const RISK_SCOPES = new Set(["both_tools", "per_tool"]);

export function validateQuestionnaire(questionnaire) {
  const errors = [];
  const categoryIds = new Set();
  const criterionIds = new Set();

  requireObject(questionnaire, "$", errors);
  if (!questionnaire || typeof questionnaire !== "object") {
    return { valid: false, errors };
  }

  requireNonEmptyString(questionnaire.schemaVersion, "$.schemaVersion", errors);
  requireIdentifier(questionnaire.questionnaireId, "$.questionnaireId", errors);
  requireNonEmptyString(questionnaire.questionnaireVersion, "$.questionnaireVersion", errors);

  if (!Array.isArray(questionnaire.categories) || questionnaire.categories.length === 0) {
    errors.push("$.categories debe ser un array no vacío.");
    return { valid: false, errors };
  }

  questionnaire.categories.forEach((category, categoryIndex) => {
    const path = `$.categories[${categoryIndex}]`;
    if (!requireObject(category, path, errors)) return;

    requireUniqueIdentifier(category.id, `${path}.id`, categoryIds, errors);
    requireNonEmptyString(category.label, `${path}.label`, errors);
    if (typeof category.color !== "string" || !HEX_COLOR.test(category.color)) {
      errors.push(`${path}.color debe utilizar el formato hexadecimal #RRGGBB.`);
    }
    requireWeight(category.defaultWeight, `${path}.defaultWeight`, errors);

    if (!Array.isArray(category.criteria) || category.criteria.length === 0) {
      errors.push(`${path}.criteria debe ser un array no vacío.`);
      return;
    }

    category.criteria.forEach((criterion, criterionIndex) => {
      const criterionPath = `${path}.criteria[${criterionIndex}]`;
      if (!requireObject(criterion, criterionPath, errors)) return;

      requireUniqueIdentifier(criterion.id, `${criterionPath}.id`, criterionIds, errors);
      requireNonEmptyString(criterion.label, `${criterionPath}.label`, errors);
      requireNonEmptyString(criterion.question, `${criterionPath}.question`, errors);
      if (typeof criterion.question === "string"
        && (!criterion.question.startsWith("¿") || !criterion.question.endsWith("?"))) {
        errors.push(`${criterionPath}.question debe ser una pregunta directa entre signos de interrogación.`);
      }
      if (typeof criterion.description !== "string") {
        errors.push(`${criterionPath}.description debe ser texto.`);
      }
      if (!requireObject(criterion.defaultWeights, `${criterionPath}.defaultWeights`, errors)) return;
      requireWeight(criterion.defaultWeights.gemini, `${criterionPath}.defaultWeights.gemini`, errors);
      requireWeight(criterion.defaultWeights.notebooklm, `${criterionPath}.defaultWeights.notebooklm`, errors);
      if (criterion.risk !== undefined) validateRisk(criterion.risk, `${criterionPath}.risk`, errors);
    });
  });

  return { valid: errors.length === 0, errors };
}

function validateRisk(risk, path, errors) {
  if (!requireObject(risk, path, errors)) return;
  if (!RISK_POLARITIES.has(risk.polarity)) {
    errors.push(`${path}.polarity debe ser "risk" o "contraindication".`);
  }
  if (!RISK_SEVERITIES.has(risk.severity)) {
    errors.push(`${path}.severity debe ser "conditional" o "blocking".`);
  }
  if (!Number.isInteger(risk.triggerAnswerMinimum) || risk.triggerAnswerMinimum < 1 || risk.triggerAnswerMinimum > 4) {
    errors.push(`${path}.triggerAnswerMinimum debe ser un entero entre 1 y 4.`);
  }
  if (!RISK_SCOPES.has(risk.scope)) {
    errors.push(`${path}.scope debe ser "both_tools" o "per_tool".`);
  }
  requireNonEmptyString(risk.message, `${path}.message`, errors);
}

function requireObject(value, path, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} debe ser un objeto.`);
    return false;
  }
  return true;
}

function requireNonEmptyString(value, path, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} debe ser texto no vacío.`);
  }
}

function requireIdentifier(value, path, errors) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    errors.push(`${path} debe ser un identificador estable en kebab-case.`);
    return false;
  }
  return true;
}

function requireUniqueIdentifier(value, path, identifiers, errors) {
  if (!requireIdentifier(value, path, errors)) return;
  if (identifiers.has(value)) {
    errors.push(`${path} contiene el identificador duplicado "${value}".`);
    return;
  }
  identifiers.add(value);
}

function requireWeight(value, path, errors) {
  if (!Number.isFinite(value) || value < WEIGHT_MINIMUM || value > WEIGHT_MAXIMUM) {
    errors.push(`${path} debe ser un número entre ${WEIGHT_MINIMUM} y ${WEIGHT_MAXIMUM}.`);
  }
}
