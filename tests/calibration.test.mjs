import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCalibrationMetrics,
  validateCalibrationDataset
} from "../js/calibration.js";

function observedCase(overrides = {}) {
  return {
    id: "case-001",
    provenance: "observed",
    scenario: "Preparación de una unidad didáctica a partir de fuentes verificadas.",
    expertRatings: [
      { evaluatorId: "pedagogy", recommendation: "notebooklm" },
      { evaluatorId: "technology", recommendation: "notebooklm" },
      { evaluatorId: "privacy", recommendation: "notebooklm" }
    ],
    detailed: { status: "ready", recommendation: "notebooklm" },
    reduced: { status: "ready", recommendation: "notebooklm" },
    incomplete: false,
    criticalContraindication: { expected: false, detected: false },
    weightSensitivity: { withinFivePercentChanged: false, nearThreshold: false },
    ...overrides
  };
}

test("rechaza identificadores duplicados y recomendaciones desconocidas", () => {
  const first = observedCase();
  const second = observedCase({
    detailed: { status: "ready", recommendation: "unknown" }
  });

  const validation = validateCalibrationDataset({ schemaVersion: "1.0", cases: [first, second] });

  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /duplicado/);
  assert.match(validation.errors.join("\n"), /recommendation/);
});

test("distingue muestra válida de suficiencia metodológica", () => {
  const validation = validateCalibrationDataset({
    schemaVersion: "1.0",
    cases: [observedCase()]
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.realCaseCount, 1);
  assert.equal(validation.readyForFieldCalibration, false);
  assert.match(validation.warnings.join("\n"), /30 casos reales/);
});

test("calcula acuerdo, errores, concordancia, riesgos y sensibilidad con denominadores explícitos", () => {
  const dataset = {
    schemaVersion: "1.0",
    cases: [
      observedCase(),
      observedCase({
        id: "case-002",
        expertRatings: [
          { evaluatorId: "pedagogy", recommendation: "gemini" },
          { evaluatorId: "technology", recommendation: "gemini" },
          { evaluatorId: "privacy", recommendation: "both" }
        ],
        detailed: { status: "ready", recommendation: "both" },
        reduced: { status: "ready", recommendation: "gemini" },
        criticalContraindication: { expected: true, detected: false },
        weightSensitivity: { withinFivePercentChanged: true, nearThreshold: false }
      })
    ]
  };

  const metrics = calculateCalibrationMetrics(dataset);

  assert.deepEqual(metrics.expertAgreement, { numerator: 4, denominator: 6, rate: 0.6667 });
  assert.deepEqual(metrics.automaticConsensusAgreement, { numerator: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(metrics.detailedReducedConcordance, { numerator: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(metrics.criticalContraindicationDetection, { numerator: 0, denominator: 1, rate: 0 });
  assert.equal(metrics.falsePositiveCases, 1);
  assert.equal(metrics.falseNegativeCases, 0);
  assert.equal(metrics.weightSensitivityViolations, 1);
  assert.equal(metrics.acceptance.overall, "not_met");
});

test("no convierte la ausencia de casos reales en porcentajes engañosos", () => {
  const metrics = calculateCalibrationMetrics({ schemaVersion: "1.0", cases: [] });

  assert.deepEqual(metrics.automaticConsensusAgreement, { numerator: 0, denominator: 0, rate: null });
  assert.deepEqual(metrics.criticalContraindicationDetection, { numerator: 0, denominator: 0, rate: null });
  assert.equal(metrics.acceptance.overall, "insufficient_evidence");
});
