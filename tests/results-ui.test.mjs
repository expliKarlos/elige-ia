import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app, reducedApp, css] = await Promise.all([
  readFile(new URL("../js/app.js", import.meta.url), "utf8"),
  readFile(new URL("../js/app-reducida.js", import.meta.url), "utf8"),
  readFile(new URL("../css/app.css", import.meta.url), "utf8")
]);

test("el desglose comienza oculto y el botón describe la acción disponible", () => {
  assert.match(app, /id="categoryDetails" hidden/);
  assert.match(app, />Ver desglose por categoría<\/button>/);
  assert.match(app, /isHidden \? "Ocultar desglose por categoría" : "Ver desglose por categoría"/);
  assert.match(css, /\.category-details\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
});

test("la interpretación visible se centra en el resultado y omite la horquilla", () => {
  assert.doesNotMatch(app, /interpretation-range|recorrido útil 25–100|Horquilla efectiva/);
  assert.match(app, /class="score-band">\$\{escapeHtml\(interpretation\.tools\.gemini\.band\.label\)\}/);
});

test("las dos interfaces explican el reescalado real y muestran la puntuación bruta como trazabilidad", () => {
  for (const source of [app, reducedApp]) {
    assert.match(source, /escala real de 0 a 100/i);
    assert.match(source, /Puntuación bruta/);
    assert.match(source, /RawScore100/);
  }
});

test("el desglose encadena resultados y radar para cada categoría", () => {
  assert.match(app, /renderCategoryBreakdownSections/);
  assert.match(app, /class="category-breakdown-card"/);
  assert.match(app, /renderSingleCategoryRadar\(categoryResults\)/);
});

test("el informe puede enviarse a PDF sin imprimir la navegación", () => {
  assert.match(app, /id="printReportBtn"/);
  assert.match(app, /window\.print\(\)/);
  assert.match(css, /@media print/);
  assert.match(css, /\.category-nav[^}]*display:\s*none\s*!important/s);
  assert.match(css, /#resultsPanel/);
});

test("reiniciar restaura respuestas, categorías, pesos y categoría activa", () => {
  assert.match(app, /const initialState\s*=\s*normaliseState\(\{\}\)/);
  assert.match(app, /Object\.assign\(state, initialState\)/);
  assert.match(app, /renderCategoryNav\(\)[\s\S]*renderCategoryControls\(\)[\s\S]*renderSurvey\(\)/);
});
