import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la aplicación utiliza HTML, CSS, JavaScript y JSON separados", async () => {
  const [html, css, app] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../css/app.css", import.meta.url), "utf8"),
    readFile(new URL("../js/app.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /<link rel="stylesheet" href="\.\/css\/app\.css">/);
  assert.match(html, /<script type="module" src="\.\/js\/app\.js"><\/script>/);
  assert.doesNotMatch(html, /<style[\s>]/);
  assert.doesNotMatch(html, /const MATRIX/);
  assert.match(css, /--lasalle-blue:\s*#003DA5/i);
  assert.match(app, /from "\.\/scoring\.js"/);
  assert.match(app, /from "\.\/validation\.js"/);
  assert.match(app, /fetch\("\.\/data\/questionnaire\.v1\.json"\)/);
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
  assert.match(app, /<input\s+type="radio"/);
  assert.doesNotMatch(app, /<inpu(?:\s|>)/);
});
