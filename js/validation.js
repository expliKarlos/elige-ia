const WEIGHT_MINIMUM = 1;
const WEIGHT_MAXIMUM = 10;
const HEX_COLOR = /^#[0-9A-F]{6}$/i;
const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
      if (typeof criterion.description !== "string") {
        errors.push(`${criterionPath}.description debe ser texto.`);
      }
      if (!requireObject(criterion.defaultWeights, `${criterionPath}.defaultWeights`, errors)) return;
      requireWeight(criterion.defaultWeights.gemini, `${criterionPath}.defaultWeights.gemini`, errors);
      requireWeight(criterion.defaultWeights.notebooklm, `${criterionPath}.defaultWeights.notebooklm`, errors);
    });
  });

  return { valid: errors.length === 0, errors };
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

