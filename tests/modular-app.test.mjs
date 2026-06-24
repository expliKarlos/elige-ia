import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la aplicación utiliza HTML, CSS, JavaScript y JSON separados", async () => {
  const [html, css, app, ux] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../css/app.css", import.meta.url), "utf8"),
    readFile(new URL("../js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../js/ux.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /<link rel="stylesheet" href="\.\/css\/app\.css">/);
  assert.match(html, /<script type="module" src="\.\/js\/app\.js"><\/script>/);
  assert.match(html, /<script type="module" src="\.\/js\/ux\.js"><\/script>/);
  assert.doesNotMatch(html, /<style[\s>]/);
  assert.doesNotMatch(html, /const MATRIX/);
  assert.match(css, /--exp-azul-tinta:\s*#1F3A5F/i);
  assert.match(app, /from "\.\/scoring\.js"/);
  assert.match(app, /from "\.\/validation\.js"/);
  assert.match(app, /from "\.\/interpretation\.js"/);
  assert.match(app, /fetch\("\.\/data\/questionnaire\.v1\.json"\)/);
  assert.match(app, /fetch\("\.\/data\/result-interpretations\.v1\.json"\)/);
  assert.match(app, /interpretSurveyResults/);
  assert.match(app, /id="closeValidationBtn"/);
  assert.match(app, /aria-label="Cerrar aviso de respuestas pendientes"/);
  assert.match(app, /closeValidationPanel/);
  assert.doesNotMatch(app, /const MATRIX\s*=\s*\[/);
  assert.match(app, /data-category-weight/);
  assert.match(app, /data-criterion-weight/);
  assert.match(app, /id="resetAllWeights"/);
  assert.match(app, /weightOverrides/);
  assert.match(app, /from "\.\/import-export\.js"/);
  assert.match(html, /id="exportSessionBtn"/);
  assert.match(html, /id="exportWeightsBtn"/);
  assert.match(html, /id="importJsonFile"/);
  assert.match(html, /id="importDialog"/);
  assert.match(html, /expliCarlos/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.doesNotMatch(html, /\bobten\b/i);
  assert.doesNotMatch(css, /Â|Plus Jakarta Sans|Fraunces|IBM Plex Mono|['"]Inter['"]/);
  assert.doesNotMatch(ux, /recommendation-tags|Redacción Creativa|Prototipado y Código/);
  assert.match(app, /<input\s+type="radio"/);
  assert.doesNotMatch(app, /<inpu(?:\s|>)/);
});

test("la interfaz detallada recoge una única necesidad por criterio", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /function renderNeedRating/);
  assert.doesNotMatch(source, /data-tool=/);
  assert.match(source, /state\.answers\[answerKey\(target\.dataset\.itemId\)\]/);
});

test("las dos interfaces enlazan el repositorio público desde el pie", async () => {
  const pages = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../index-reducida.html", import.meta.url), "utf8")
  ]);

  for (const html of pages) {
    assert.match(html, /<footer class="app-footer">[\s\S]*href="https:\/\/github\.com\/expliKarlos\/elige-ia"[\s\S]*>expliKarlos\/elige-ia<\/a>[\s\S]*<\/footer>/);
  }
});

test("las páginas no muestran la denominación Avant-Garde", async () => {
  const pages = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../index-reducida.html", import.meta.url), "utf8")
  ]);

  for (const html of pages) assert.doesNotMatch(html, /Avant-Garde/i);
});
