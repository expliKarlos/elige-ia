import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateQuestionnaire } from "../js/validation.js";

const questionnairePath = new URL("../data/questionnaire.v1.json", import.meta.url);

async function loadQuestionnaire() {
  return JSON.parse(await readFile(questionnairePath, "utf8"));
}

test("el cuestionario extraído conserva 18 categorías y 103 criterios", async () => {
  const questionnaire = await loadQuestionnaire();
  const criterionCount = questionnaire.categories.reduce(
    (total, category) => total + category.criteria.length,
    0
  );

  assert.equal(questionnaire.categories.length, 18);
  assert.equal(criterionCount, 103);
});

test("todos los identificadores son únicos y los pesos están entre 1 y 10", async () => {
  const questionnaire = await loadQuestionnaire();
  const validation = validateQuestionnaire(questionnaire);

  assert.deepEqual(validation.errors, []);
  assert.equal(validation.valid, true);
});

test("todos los criterios incluyen una pregunta directa y amigable", async () => {
  const questionnaire = await loadQuestionnaire();
  const criteria = questionnaire.categories.flatMap((category) => category.criteria);

  assert.equal(questionnaire.questionnaireVersion, "2.0.0");
  assert.ok(criteria.every((criterion) => criterion.question.startsWith("¿")));
  assert.ok(criteria.every((criterion) => criterion.question.endsWith("?")));
  assert.equal(criteria[0].question, "¿Necesitas que tus resultados sean creativos?");
});

test("los criterios sensibles declaran polaridad, severidad y umbral", async () => {
  const questionnaire = await loadQuestionnaire();
  const risks = questionnaire.categories.flatMap((category) => category.criteria).filter((criterion) => criterion.risk);

  assert.ok(risks.length >= 9);
  assert.ok(risks.some((criterion) => criterion.risk.severity === "blocking"));
  assert.ok(risks.some((criterion) => criterion.risk.severity === "conditional"));
  assert.equal(validateQuestionnaire(questionnaire).valid, true);
});

test("el validador acepta pesos decimales y rechaza valores fuera de rango", () => {
  const fixture = {
    schemaVersion: "1.0",
    questionnaireId: "fixture",
    questionnaireVersion: "1.0.0",
    categories: [{
      id: "category",
      label: "Categoría",
      color: "#003DA5",
      defaultWeight: 1.5,
      criteria: [{
        id: "criterion",
        label: "Criterio",
        question: "¿Necesitas este criterio?",
        description: "Descripción",
        defaultWeights: { gemini: 2.5, notebooklm: 10 }
      }]
    }]
  };

  assert.equal(validateQuestionnaire(fixture).valid, true);

  fixture.categories[0].criteria[0].defaultWeights.gemini = 0.9;
  const invalid = validateQuestionnaire(fixture);
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join("\n"), /defaultWeights\.gemini/);
});

test("el validador rechaza metadatos de riesgo ambiguos", () => {
  const fixture = {
    schemaVersion: "1.0",
    questionnaireId: "fixture",
    questionnaireVersion: "1.0.0",
    categories: [{
      id: "category",
      label: "Categoría",
      color: "#003DA5",
      defaultWeight: 1,
      criteria: [{
        id: "criterion",
        label: "Criterio",
        question: "¿Necesitas este criterio?",
        description: "Descripción",
        defaultWeights: { gemini: 2, notebooklm: 2 },
        risk: {
          polarity: "unknown",
          severity: "critical",
          triggerAnswerMinimum: 5,
          scope: "one_tool",
          message: ""
        }
      }]
    }]
  };

  const validation = validateQuestionnaire(fixture);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /risk\.polarity/);
  assert.match(validation.errors.join("\n"), /risk\.severity/);
  assert.match(validation.errors.join("\n"), /triggerAnswerMinimum/);
});

test("el JSON conserva la instantánea histórica de textos, colores e importancias", async () => {
  const questionnaire = await loadQuestionnaire();
  const extractedData = questionnaire.categories.map(category => ({
    label: category.label,
    color: category.color,
    criteria: category.criteria.map(criterion => ({
      id: criterion.id,
      label: criterion.label,
      description: criterion.description,
      defaultWeights: criterion.defaultWeights
    }))
  }));

  const digest = createHash("sha256")
    .update(JSON.stringify(extractedData))
    .digest("hex");

  assert.equal(digest, "928d9eb04fe89513c587fd962c96061e8d742a7c0fbd52e69b3afacfc575fcd8");
});
