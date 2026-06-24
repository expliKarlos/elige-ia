import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  interpretSurveyResults,
  positionInEffectiveRange,
  validateInterpretationMatrix
} from "../js/interpretation.js";

const questionnaire = JSON.parse(
  await readFile(new URL("../data/questionnaire.v1.json", import.meta.url), "utf8")
);
const matrix = JSON.parse(
  await readFile(new URL("../data/result-interpretations.v1.json", import.meta.url), "utf8")
);

const resultFixture = (gemini, notebookLm) => ({
  geminiScore100: gemini,
  notebookScore100: notebookLm,
  diff: Math.round((gemini - notebookLm) * 10) / 10,
  excludedCategoryCount: 0
});

test("sitúa una puntuación dentro de la horquilla efectiva 25–100", () => {
  assert.equal(positionInEffectiveRange(25), 0);
  assert.equal(positionInEffectiveRange(62.5), 50);
  assert.equal(positionInEffectiveRange(100), 100);
});

test("valida el contrato externo de la matriz antes de interpretarlo", () => {
  assert.deepEqual(validateInterpretationMatrix(matrix), { valid: true, errors: [] });

  const invalid = validateInterpretationMatrix({ schemaVersion: "1.0.0", individualBands: [] });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join("\n"), /differenceBands|jointProfiles|scoreModel/);
});

test("distingue una diferencia leve con baja idoneidad de otra con alta idoneidad", () => {
  const low = interpretSurveyResults({
    matrix,
    questionnaire,
    answers: {},
    results: resultFixture(36, 41),
    context: { isComplete: true, weightOverrideCount: 0 }
  });
  const high = interpretSurveyResults({
    matrix,
    questionnaire,
    answers: {},
    results: resultFixture(87, 92),
    context: { isComplete: true, weightOverrideCount: 0 }
  });

  assert.equal(low.comparison.band.id, "slight");
  assert.equal(high.comparison.band.id, "slight");
  assert.equal(low.jointProfile.id, "neither");
  assert.equal(high.jointProfile.id, "both_very_suitable");
  assert.equal(low.recommendation, "neither");
  assert.equal(high.recommendation, "both");
});

test("interpreta 53–71 atendiendo al nivel y a la diferencia", () => {
  const interpretation = interpretSurveyResults({
    matrix,
    questionnaire,
    answers: {},
    results: resultFixture(53, 71),
    context: { isComplete: true, weightOverrideCount: 0 }
  });

  assert.equal(interpretation.tools.gemini.band.id, "limited");
  assert.equal(interpretation.tools.notebookLm.band.id, "suitable");
  assert.equal(interpretation.comparison.band.id, "relevant");
  assert.equal(interpretation.jointProfile.id, "notebooklm_suitable_only");
  assert.equal(interpretation.recommendation, "notebookLm");
});

test("una contraindicación bloqueante prevalece sobre dos puntuaciones altas", () => {
  const interpretation = interpretSurveyResults({
    matrix,
    questionnaire,
    answers: { "c18q02:gemini": 4, "c18q02:notebook": 4 },
    results: resultFixture(91, 94),
    context: { isComplete: true, weightOverrideCount: 0 }
  });

  assert.equal(interpretation.status, "blocked");
  assert.equal(interpretation.recommendation, "neither");
  assert.equal(interpretation.signals[0].criterionId, "c18q02");
  assert.equal(interpretation.signals[0].severity, "blocking");
});

test("un riesgo condicional conserva el resultado pero exige mitigación", () => {
  const interpretation = interpretSurveyResults({
    matrix,
    questionnaire,
    answers: { "c18q04:gemini": 3, "c18q04:notebook": 3 },
    results: resultFixture(74, 79),
    context: { isComplete: true, weightOverrideCount: 2 }
  });

  assert.equal(interpretation.status, "conditional");
  assert.equal(interpretation.recommendation, "both");
  assert.equal(interpretation.signals[0].severity, "conditional");
  assert.ok(interpretation.disclosures.some((item) => item.id === "weight_overrides"));
});

test("no interpreta sesiones incompletas ni puntuaciones completas inferiores a 25", () => {
  const incomplete = interpretSurveyResults({
    matrix,
    questionnaire,
    answers: {},
    results: resultFixture(60, 70),
    context: { isComplete: false, weightOverrideCount: 0 }
  });
  const invalidRange = interpretSurveyResults({
    matrix,
    questionnaire,
    answers: {},
    results: resultFixture(20, 70),
    context: { isComplete: true, weightOverrideCount: 0 }
  });

  assert.equal(incomplete.status, "not_interpretable");
  assert.equal(invalidRange.status, "not_interpretable");
});

test("conserva la comparación y condiciona la adopción si faltan categorías de riesgo", () => {
  const interpretation = interpretSurveyResults({
    matrix,
    questionnaire,
    answers: {},
    results: {
      ...resultFixture(82, 88),
      excludedCategoryCount: 1,
      categories: [{ categoryId: "privacidad", included: false }]
    },
    context: { isComplete: true, weightOverrideCount: 0 }
  });

  assert.equal(interpretation.status, "conditional");
  assert.equal(interpretation.recommendation, "both");
  assert.ok(interpretation.disclosures.some((item) => item.id === "risk_categories_excluded"));
  assert.match(interpretation.primaryMessage, /provisional|pendiente/i);
  assert.ok(interpretation.recommendedActions.some((action) => /categorías de riesgo/i.test(action)));
});

test("interpreta 40,7–83,9 como ventaja muy marcada de NotebookLM", () => {
  const interpretation = interpretSurveyResults({
    matrix,
    questionnaire,
    answers: {},
    results: {
      ...resultFixture(40.7, 83.9),
      excludedCategoryCount: 2,
      categories: [
        { categoryId: "privacidad", included: false },
        { categoryId: "casos-de-no-uso", included: false }
      ]
    },
    context: { isComplete: true, weightOverrideCount: 0 }
  });

  assert.equal(interpretation.status, "conditional");
  assert.equal(interpretation.recommendation, "notebookLm");
  assert.equal(interpretation.tools.gemini.band.id, "limited");
  assert.equal(interpretation.tools.notebookLm.band.id, "suitable");
  assert.equal(interpretation.comparison.absoluteDifference, 43.2);
  assert.equal(interpretation.comparison.band.id, "marked");
  assert.equal(interpretation.jointProfile.id, "notebooklm_suitable_only");
  assert.match(interpretation.primaryMessage, /NotebookLM.*83,9.*Adecuada/i);
  assert.match(interpretation.primaryMessage, /Gemini.*40,7.*Idoneidad limitada/i);
  assert.match(interpretation.primaryMessage, /43,2.*Ventaja muy marcada/i);
  assert.match(interpretation.primaryMessage, /provisional|pendiente/i);
});

test("interpreta todas las combinaciones válidas de niveles individuales", () => {
  const representativeScores = [32, 47, 62, 77, 92];

  for (const gemini of representativeScores) {
    for (const notebookLm of representativeScores) {
      const interpretation = interpretSurveyResults({
        matrix,
        questionnaire,
        answers: {},
        results: resultFixture(gemini, notebookLm),
        context: { isComplete: true, weightOverrideCount: 0 }
      });

      assert.equal(interpretation.status, "ready", `${gemini}–${notebookLm}`);
      assert.notEqual(interpretation.recommendation, null, `${gemini}–${notebookLm}`);
      assert.ok(interpretation.jointProfile, `${gemini}–${notebookLm}`);
      assert.ok(interpretation.comparison.band, `${gemini}–${notebookLm}`);
      assert.doesNotMatch(interpretation.primaryMessage, /no se puede interpretar/i, `${gemini}–${notebookLm}`);
    }
  }
});

test("la interpretación de una categoría solo evalúa los riesgos de esa categoría", () => {
  const interpretation = interpretSurveyResults({
    matrix,
    questionnaire,
    answers: { "c18q02:gemini": 4, "c18q02:notebook": 4 },
    results: resultFixture(72, 77),
    context: {
      isComplete: true,
      scope: "category",
      categoryIds: ["finalidad-pedagogica"],
      weightOverrideCount: 0
    }
  });

  assert.equal(interpretation.status, "ready");
  assert.equal(interpretation.signals.length, 0);
  assert.equal(interpretation.jointProfile.id, "both_suitable");
});
