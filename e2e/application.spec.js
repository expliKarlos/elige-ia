import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la encuesta completa restaura su estado inicial", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/index.html");
  await expect(page.locator(".question-card")).toHaveCount(103);
  await page.locator("#openCategorySelectionBtn").click();
  await expect(page.locator("#categoryConfig")).toHaveClass(/is-visible/);
  await page.locator('input[data-pref-index="0"]').uncheck();
  await page.locator("#categoryWeight-1").fill("7.5");
  await page.locator("#categoryWeight-1").press("Enter");
  await page.getByRole("button", { name: "Datos y copia de seguridad" }).click();
  await page.getByRole("button", { name: "Reiniciar encuesta" }).click();
  await page.locator("#openCategorySelectionBtn").click();

  await expect(page.locator('input[data-pref-type="included"]:checked')).toHaveCount(18);
  await expect(page.locator(".cat-link")).toHaveCount(18);
  await expect(page.locator("#categoryWeight-1")).toHaveValue("1");
  await expect(page.locator(".weight-summary strong")).toHaveText("0");
  await expect(page.locator("#progressText")).toContainText("0 de 103");
  await expect(page.locator(".question-card").first().getByRole("radio")).toHaveCount(4);
  await expect(page.locator(".question-card").first().getByRole("heading", { level: 3 })).toContainText("¿Necesitas que tus resultados sean creativos?");
  await expectNoSeriousAxeViolations(page, "encuesta completa con configuración abierta");
});

test("el modo detallado permite limitar el informe a una categoría", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator(".question-card")).toHaveCount(103);
  await page.locator("#openCategorySelectionBtn").click();
  await expect(page.locator("#categoryConfig")).toHaveClass(/is-visible/);
  await page.getByRole("button", { name: "Desmarcar todas" }).click();
  await page.locator('input[data-pref-index="0"]').check();
  await expect(page.locator("#selectedCategoryCount")).toHaveText("1 categoría seleccionada");
  await expect(page.locator("#progressText")).toContainText("0 de 6");
});

test("el informe de categoría compara baremaciones y muestra la necesidad", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator(".question-card")).toHaveCount(103);
  for (const criterionId of ["c01q01", "c01q02", "c01q03", "c01q04", "c01q05", "c01q06"]) {
    await page.locator(`#card-${criterionId} input[value="4"]`).check();
  }
  await page.locator('[data-category-evaluate="0"]').click();
  await expect(page.locator("#categoryDashboard")).toHaveClass(/is-visible/);
  await expect(page.locator("#categoryDashboard .criterion-comparison-row")).toHaveCount(6);
  await expect(page.locator("#categoryDashboard .criterion-comparison-row").first()).toContainText("Necesidad 4/4");
  await expect(page.locator("#categoryDashboard .criterion-comparison-row").first()).toContainText("9/10");
  await expect(page.locator("#categoryDashboard .criterion-comparison-row").first()).toContainText("5/10");
  await expectNoSeriousAxeViolations(page, "comparativa de baremaciones por categoría");
});

test("la versión reducida completa el diagnóstico y detecta bloqueos", async ({ page }) => {
  await page.goto("/index-reducida.html");
  await expect(page.locator(".reduced-category")).toHaveCount(18);
  await expect(page.locator(".safety-check")).toHaveCount(5);
  for (const input of await page.locator('input[data-rating][value="3"]').all()) await input.check();
  for (const input of await page.locator('input[data-safety-id][value="no"]').all()) await input.check();

  await expect(page.locator("#progressText")).toHaveText("23 de 23 respuestas");
  await page.getByRole("button", { name: "Obtener diagnóstico", exact: true }).click();
  await expect(page.locator("#reducedResults")).toHaveClass(/is-visible/);
  await expect(page.locator(".score-value")).toHaveText(["66,7", "66,7"]);
  await expect(page.locator(".score-sub").first()).toContainText("Puntuación bruta 75");
  await expect(page.locator(".reduced-radar svg")).toHaveCount(1);
  await expectNoSeriousAxeViolations(page, "resultado del diagnóstico reducido");

  await page.locator('input[data-safety-id="c11q03"][value="yes"]').check();
  await page.getByRole("button", { name: "Obtener diagnóstico", exact: true }).click();
  await expect(page.locator(".interpretation-heading h3")).toHaveText("Uso no recomendado");
});

test("las dos entradas no presentan infracciones axe graves", async ({ page }) => {
  for (const path of ["/index.html", "/index-reducida.html"]) {
    await page.goto(path);
    await expectNoSeriousAxeViolations(page, path);
  }
});

async function expectNoSeriousAxeViolations(page, context) {
  const report = await new AxeBuilder({ page }).analyze();
  const seriousViolations = report.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
  expect(seriousViolations, `${context}: ${seriousViolations.map((item) => item.id).join(", ")}`).toEqual([]);
}
