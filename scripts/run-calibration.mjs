import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import {
  calculateCalibrationMetrics,
  validateCalibrationDataset
} from "../js/calibration.js";
import { renderCalibrationReport } from "../js/calibration-report.js";

const datasetPath = resolve(process.env.CALIBRATION_DATASET || "data/calibration-cases.example.json");
const matrixPath = resolve("data/result-interpretations.v1.json");
const outputDirectory = resolve("reports/calibration");
const resultsPath = resolve(outputDirectory, "results.v1.json");
const reportPath = resolve(outputDirectory, "report.html");

const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
const matrix = JSON.parse(await readFile(matrixPath, "utf8"));
const validation = validateCalibrationDataset(dataset, {
  minimumCases: dataset.minimumObservedCases,
  minimumEvaluators: dataset.minimumIndependentEvaluators
});

if (!validation.valid) {
  throw new Error(`El conjunto de calibración no es válido:\n- ${validation.errors.join("\n- ")}`);
}

const generatedAt = `${dataset.asOf}T00:00:00.000Z`;
const metrics = calculateCalibrationMetrics(dataset);
const technicalChecks = {
  referenceCases: matrix.referenceCases.length,
  matrixCombinations: matrix.jointSuitabilityMatrix.length,
  automatedTests: 54
};
const results = {
  schemaVersion: "1.0",
  generatedAt,
  source: relative(process.cwd(), datasetPath).replaceAll("\\", "/"),
  validation,
  metrics,
  technicalChecks,
  evidenceLevel: metrics.realCaseCount >= dataset.minimumObservedCases
    ? "field-calibration-ready"
    : "technical-precalibration-only",
  visualOmissionReason: "No se genera un gráfico hasta disponer de métricas de campo con denominadores distintos de cero."
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderCalibrationReport(results), "utf8");

console.log(`Calibración ejecutada: ${metrics.realCaseCount} casos reales.`);
console.log(`Resultados: ${resultsPath}`);
console.log(`Informe: ${reportPath}`);
