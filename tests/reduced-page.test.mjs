import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index-reducida.html", import.meta.url), "utf8");
const config = JSON.parse(
  await readFile(new URL("../data/reduced-survey.v1.json", import.meta.url), "utf8")
);
const questionnaire = JSON.parse(
  await readFile(new URL("../data/questionnaire.v1.json", import.meta.url), "utf8")
);

test("la versión reducida es independiente y carga recursos propios", () => {
  assert.match(html, /css\/reduced\.css/);
  assert.match(html, /js\/app-reducida\.js/);
  assert.match(html, /id="reducedSurveyRoot"/);
  assert.match(html, /id="safetyRoot"/);
  assert.match(html, /id="reducedResults"/);
});

test("el contrato reducido utiliza las 18 categorías y una escala 1–4", () => {
  assert.equal(questionnaire.categories.length, 18);
  assert.equal(config.mode, "category-weighted");
  assert.deepEqual(config.scale.map((item) => item.value), [1, 2, 3, 4]);
});

test("los controles de seguridad remiten a contraindicaciones reales", () => {
  const criteria = new Map(questionnaire.categories.flatMap((category) => (
    category.criteria.map((criterion) => [criterion.id, criterion])
  )));

  assert.ok(config.safetyChecks.length >= 4);
  config.safetyChecks.forEach((check) => {
    const criterion = criteria.get(check.criterionId);
    assert.ok(criterion, check.criterionId);
    assert.equal(criterion.risk?.severity, "blocking", check.criterionId);
  });
});

test("la página explica que el diagnóstico es orientativo", () => {
  assert.match(html, /diagnóstico rápido/i);
  assert.match(html, /orientativ/i);
  assert.match(html, /evaluación detallada/i);
});
