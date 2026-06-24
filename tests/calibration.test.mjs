import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCalibrationMetrics,
  validateCalibrationDataset
} from "../js/calibration.js";
import { renderCalibrationReport } from "../js/calibration-report.js";

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

test("rechaza casos con recomendaciones automáticas o expertas ausentes", () => {
  const entry = observedCase({
    detailed: { status: "ready" },
    expertRatings: [
      { evaluatorId: "pedagogy", recommendation: "notebooklm" },
      { evaluatorId: "technology" },
      { evaluatorId: "privacy", recommendation: "notebooklm" }
    ]
  });

  const validation = validateCalibrationDataset({ schemaVersion: "1.0", cases: [entry] });

  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /detailed\.recommendation/);
  assert.match(validation.errors.join("\n"), /expertRatings\[1\]\.recommendation/);
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

test("no aprueba la estabilidad de pesos sin pruebas de sensibilidad por caso", () => {
  const entry = observedCase({ weightSensitivity: undefined });

  const metrics = calculateCalibrationMetrics({ schemaVersion: "1.0", cases: [entry] });

  assert.equal(metrics.weightSensitivityEvaluatedCases, 0);
  assert.equal(metrics.acceptance.criteria.weightStability, "not_evaluable");
});

test("el informe técnico conserva el contrato y explicita la evidencia insuficiente", () => {
  const dataset = { schemaVersion: "1.0", cases: [] };
  const validation = validateCalibrationDataset(dataset);
  const metrics = calculateCalibrationMetrics(dataset);
  const report = renderCalibrationReport({
    generatedAt: "2026-06-24T00:00:00.000Z",
    validation,
    metrics,
    technicalChecks: { referenceCases: 7, matrixCombinations: 36, automatedTests: 52 }
  });

  for (const section of [
    "technical-summary",
    "key-findings",
    "scope-data-and-metric-definitions",
    "methodology",
    "limitations-uncertainty-and-robustness-checks",
    "recommended-next-steps",
    "further-questions"
  ]) {
    assert.match(report, new RegExp(`data-contract-section="${section}"`));
  }
  assert.match(report, /Evidencia de campo insuficiente/);
  assert.match(report, /No evaluable/);
  assert.doesNotMatch(report, /NaN|null%/);
});

test("el informe de campo no conserva mensajes propios de una muestra vacía", () => {
  const cases = Array.from({ length: 30 }, (_, index) => observedCase({
    id: `case-${String(index + 1).padStart(3, "0")}`
  }));
  const dataset = { schemaVersion: "1.0", cases };
  const validation = validateCalibrationDataset(dataset);
  const metrics = calculateCalibrationMetrics(dataset);
  const report = renderCalibrationReport({
    generatedAt: "2026-06-24T00:00:00.000Z",
    validation,
    metrics,
    technicalChecks: { referenceCases: 7, matrixCombinations: 36, automatedTests: 56 }
  });

  assert.match(report, /Muestra de campo disponible/);
  assert.match(report, /30 casos reales/);
  assert.doesNotMatch(report, /La validez de campo no puede estimarse todavía/);
  assert.doesNotMatch(report, /La ausencia de observaciones/);
  assert.doesNotMatch(report, /iniciar la captura controlada/);
});
