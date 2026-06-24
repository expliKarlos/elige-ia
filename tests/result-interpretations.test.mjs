import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loadMatrix = async () => JSON.parse(
  await readFile(new URL("../data/result-interpretations.v1.json", import.meta.url), "utf8")
);

const contains = (range, value) => {
  const lowerOk = range.minInclusive === undefined || value >= range.minInclusive;
  const lowerExclusiveOk = range.minExclusive === undefined || value > range.minExclusive;
  const upperOk = range.maxInclusive === undefined || value <= range.maxInclusive;
  const upperExclusiveOk = range.maxExclusive === undefined || value < range.maxExclusive;
  return lowerOk && lowerExclusiveOk && upperOk && upperExclusiveOk;
};

test("la matriz cubre sin solapamientos las puntuaciones individuales de 0 a 100", async () => {
  const matrix = await loadMatrix();

  for (let score = 0; score <= 1000; score += 1) {
    const value = score / 10;
    const matches = matrix.individualBands.filter((band) => contains(band.range, value));
    assert.equal(matches.length, 1, `La puntuación ${value} debe pertenecer a una sola banda`);
  }
});

test("las bandas comparativas cubren todas las diferencias de 0 a 100", async () => {
  const matrix = await loadMatrix();

  for (let difference = 0; difference <= 1000; difference += 1) {
    const value = difference / 10;
    const matches = matrix.differenceBands.filter((band) => contains(band.range, value));
    assert.equal(matches.length, 1, `La diferencia ${value} debe pertenecer a una sola banda`);
  }
});

test("la matriz conjunta contiene todas las combinaciones posibles de niveles", async () => {
  const matrix = await loadMatrix();
  const bandIds = matrix.individualBands.map((band) => band.id);
  const combinations = new Set(
    matrix.jointSuitabilityMatrix.map((entry) => `${entry.geminiBandId}:${entry.notebookLmBandId}`)
  );

  assert.equal(combinations.size, bandIds.length ** 2);
  for (const geminiBandId of bandIds) {
    for (const notebookLmBandId of bandIds) {
      assert.ok(combinations.has(`${geminiBandId}:${notebookLmBandId}`));
    }
  }
});

test("incluye casos de referencia que distinguen nivel absoluto y diferencia", async () => {
  const matrix = await loadMatrix();
  const examples = new Map(matrix.referenceCases.map((entry) => [entry.id, entry]));

  assert.deepEqual(examples.get("limited-vs-suitable-53-71")?.scores, { gemini: 53, notebookLm: 71 });
  assert.equal(examples.get("very-low-vs-limited-36-41")?.differenceBandId, "slight");
  assert.equal(examples.get("very-suitable-vs-very-suitable-87-92")?.differenceBandId, "slight");
  assert.notEqual(
    examples.get("very-low-vs-limited-36-41")?.jointProfileId,
    examples.get("very-suitable-vs-very-suitable-87-92")?.jointProfileId
  );
});

test("los casos de referencia son coherentes con las bandas y la matriz", async () => {
  const matrix = await loadMatrix();

  for (const example of matrix.referenceCases) {
    const geminiBand = matrix.individualBands.find((band) => contains(band.range, example.scores.gemini));
    const notebookLmBand = matrix.individualBands.find((band) => contains(band.range, example.scores.notebookLm));
    const differenceBand = matrix.differenceBands.find((band) => contains(band.range, example.absoluteDifference));
    const jointEntry = matrix.jointSuitabilityMatrix.find((entry) => (
      entry.geminiBandId === geminiBand?.id && entry.notebookLmBandId === notebookLmBand?.id
    ));

    assert.equal(example.geminiBandId, geminiBand?.id, example.id);
    assert.equal(example.notebookLmBandId, notebookLmBand?.id, example.id);
    assert.equal(example.differenceBandId, differenceBand?.id, example.id);
    assert.equal(example.jointProfileId, jointEntry?.profileId, example.id);
    assert.equal(
      example.absoluteDifference,
      Math.abs(example.scores.gemini - example.scores.notebookLm),
      example.id
    );
  }
});

test("documenta prioridad, cautelas y acciones para cada resultado", async () => {
  const matrix = await loadMatrix();

  assert.equal(matrix.schemaVersion, "1.0.0");
  assert.ok(matrix.interpretationPipeline.length >= 4);
  assert.ok(matrix.guardrails.length >= 3);
  for (const band of matrix.individualBands) {
    assert.ok(band.interpretation);
    assert.ok(band.recommendedActions.length > 0);
  }
  for (const profile of matrix.jointProfiles) {
    assert.ok(profile.summary);
    assert.ok(profile.recommendedActions.length > 0);
  }
});

test("todas las referencias internas de la matriz existen", async () => {
  const matrix = await loadMatrix();
  const bandIds = new Set(matrix.individualBands.map((band) => band.id));
  const profileIds = new Set(matrix.jointProfiles.map((profile) => profile.id));

  for (const entry of matrix.jointSuitabilityMatrix) {
    assert.ok(bandIds.has(entry.geminiBandId));
    assert.ok(bandIds.has(entry.notebookLmBandId));
    assert.ok(profileIds.has(entry.profileId));
  }
});
