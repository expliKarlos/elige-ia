import { interpretSurveyResults, validateInterpretationMatrix } from "./interpretation.js";
import {
  calculateReducedResults,
  createReducedRiskAnswers,
  validateReducedResponses
} from "./reduced-scoring.js";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
const STORAGE_KEY = "gemini-notebooklm-reduced-v1";
const TOOL_LABELS = { gemini: "Gemini", notebooklm: "NotebookLM" };

const applicationData = await loadApplicationData();

if (applicationData) {
  const { questionnaire, config, interpretationMatrix } = applicationData;
  const safetyCriterionIds = config.safetyChecks.map((check) => check.criterionId);
  const state = normaliseState(loadState(), questionnaire, safetyCriterionIds);
  init();

  function init() {
    $("#statCats").textContent = String(questionnaire.categories.length);
    renderScale();
    renderCategories();
    renderSafetyChecks();
    bindEvents();
    updateProgress();
  }

  function renderScale() {
    $("#reducedScale").innerHTML = config.scale.map((option) => `
      <div class="compact-scale-item">
        <strong>${option.value} · ${escapeHtml(option.label)}</strong>
        <small>${escapeHtml(option.description)}</small>
      </div>`).join("");
  }

  function renderCategories() {
    const root = $("#reducedSurveyRoot");
    root.innerHTML = questionnaire.categories.map((category, index) => renderCategory(category, index)).join("");
    root.setAttribute("aria-busy", "false");
  }

  function renderCategory(category, index) {
    const setting = getCategorySetting(category);
    return `
      <article class="reduced-category${setting.included ? "" : " is-excluded"}" id="reduced-${escapeAttr(category.id)}" style="--cat:${escapeAttr(category.color)}">
        <header class="reduced-category-head">
          <div>
            <p class="reduced-category-number">CATEGORÍA ${index + 1} DE ${questionnaire.categories.length}</p>
            <h3>${escapeHtml(category.label)}</h3>
          </div>
          <div class="category-options">
            <label class="include-category">
              <input type="checkbox" class="category-include" data-category-id="${escapeAttr(category.id)}" ${setting.included ? "checked" : ""}>
              <span>Incluir</span>
            </label>
            <label class="category-weight">
              <span>Peso 1–10</span>
              <input type="number" class="category-weight-input" data-category-id="${escapeAttr(category.id)}" min="1" max="10" step="0.1" value="${setting.weight}" ${setting.included ? "" : "disabled"}>
            </label>
          </div>
        </header>
        <details class="category-scope">
          <summary>Qué se considera en esta categoría</summary>
          <ul>${category.criteria.map((criterion) => `<li>${escapeHtml(criterion.label)}</li>`).join("")}</ul>
        </details>
        <div class="reduced-ratings">
          ${renderToolRating(category, "gemini", setting.included)}
          ${renderToolRating(category, "notebooklm", setting.included)}
        </div>
      </article>`;
  }

  function renderToolRating(category, tool, enabled) {
    const selected = Number(state.ratings[`${category.id}:${tool}`]);
    const cssTool = tool === "gemini" ? "gemini" : "notebook";
    return `
      <fieldset class="reduced-tool" style="--tool:var(--${cssTool})" ${enabled ? "" : "disabled"}>
        <legend>${TOOL_LABELS[tool]}</legend>
        <div class="reduced-rating-grid">
          ${config.scale.map((option) => `
            <label class="reduced-rating-option" title="${escapeAttr(option.description)}">
              <input type="radio" name="${escapeAttr(category.id)}-${tool}" value="${option.value}" data-rating data-category-id="${escapeAttr(category.id)}" data-tool="${tool}" ${selected === option.value ? "checked" : ""}>
              <span>${option.value}<small class="sr-only"> · ${escapeHtml(option.label)}</small></span>
            </label>`).join("")}
        </div>
      </fieldset>`;
  }

  function renderSafetyChecks() {
    const root = $("#safetyRoot");
    root.innerHTML = config.safetyChecks.map((check, index) => `
      <article class="safety-check" id="safety-${escapeAttr(check.criterionId)}">
        <p><strong>${index + 1}.</strong> ${escapeHtml(check.prompt)}</p>
        <div class="binary-options" role="radiogroup" aria-label="${escapeAttr(check.prompt)}">
          ${["no", "yes"].map((answer) => `
            <label>
              <input type="radio" name="safety-${escapeAttr(check.criterionId)}" value="${answer}" data-safety-id="${escapeAttr(check.criterionId)}" ${state.safetyAnswers[check.criterionId] === answer ? "checked" : ""}>
              <span>${answer === "yes" ? "Sí" : "No"}</span>
            </label>`).join("")}
        </div>
      </article>`).join("");
    root.setAttribute("aria-busy", "false");
  }

  function bindEvents() {
    $("#reducedSurveyRoot").addEventListener("change", handleSurveyChange);
    $("#reducedSurveyRoot").addEventListener("input", handleWeightInput);
    $("#safetyRoot").addEventListener("change", handleSafetyChange);
    [$("#finishReducedBtn"), $("#finishReducedBottomBtn")].forEach((button) => button.addEventListener("click", finalizeSurvey));
    $("#resetReducedBtn").addEventListener("click", resetSurvey);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && $("#reducedValidation").classList.contains("is-visible")) closeValidation();
    });
  }

  function handleSurveyChange(event) {
    const target = event.target;
    if (target.matches("[data-rating]")) {
      state.ratings[`${target.dataset.categoryId}:${target.dataset.tool}`] = Number(target.value);
      target.closest(".reduced-category")?.classList.remove("is-pending");
      persistAndRefresh();
      return;
    }
    if (target.matches(".category-include")) {
      const category = findCategory(target.dataset.categoryId);
      state.categorySettings[category.id] = {
        ...getCategorySetting(category),
        included: target.checked
      };
      persistAndRefresh();
      renderCategories();
      updateProgress();
      $(`.category-include[data-category-id="${cssEscape(category.id)}"]`)?.focus();
      return;
    }
    if (target.matches(".category-weight-input")) saveWeight(target);
  }

  function handleWeightInput(event) {
    if (!event.target.matches(".category-weight-input")) return;
    const value = event.target.valueAsNumber;
    event.target.setAttribute("aria-invalid", String(!Number.isFinite(value) || value < 1 || value > 10));
  }

  function saveWeight(input) {
    const value = input.valueAsNumber;
    if (!Number.isFinite(value) || value < 1 || value > 10) {
      input.setAttribute("aria-invalid", "true");
      return;
    }
    const category = findCategory(input.dataset.categoryId);
    state.categorySettings[category.id] = { ...getCategorySetting(category), weight: value };
    input.setAttribute("aria-invalid", "false");
    persistAndRefresh();
  }

  function handleSafetyChange(event) {
    const criterionId = event.target.dataset.safetyId;
    if (!criterionId) return;
    state.safetyAnswers[criterionId] = event.target.value;
    event.target.closest(".safety-check")?.classList.remove("is-pending");
    persistAndRefresh();
  }

  function persistAndRefresh() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateProgress();
    $("#reducedResults").classList.remove("is-visible");
  }

  function updateProgress() {
    const included = questionnaire.categories.filter((category) => getCategorySetting(category).included);
    const total = included.length * 2 + safetyCriterionIds.length;
    const categoryCompleted = included.reduce((count, category) => count
      + Number(isValidRating(state.ratings[`${category.id}:gemini`]))
      + Number(isValidRating(state.ratings[`${category.id}:notebooklm`])), 0);
    const safetyCompleted = safetyCriterionIds.filter((id) => ["yes", "no"].includes(state.safetyAnswers[id])).length;
    const completed = categoryCompleted + safetyCompleted;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    $("#progressText").textContent = `${completed} de ${total} respuestas`;
    $("#progressPercent").textContent = `${percent}%`;
    $("#progressFill").style.width = `${percent}%`;
  }

  function finalizeSurvey() {
    closeValidation();
    $$(".is-pending").forEach((element) => element.classList.remove("is-pending"));
    const invalidWeights = $$(".category-weight-input[aria-invalid='true']");
    const validation = validateReducedResponses({
      questionnaire,
      ratings: state.ratings,
      safetyAnswers: state.safetyAnswers,
      safetyCriterionIds,
      categorySettings: state.categorySettings
    });

    if (!validation.complete || invalidWeights.length) {
      showValidation(validation, invalidWeights);
      return;
    }

    const results = calculateReducedResults(questionnaire, state.ratings, {
      categorySettings: state.categorySettings
    });
    const riskAnswers = createReducedRiskAnswers(state.safetyAnswers);
    const interpretation = interpretSurveyResults({
      matrix: interpretationMatrix,
      questionnaire,
      answers: riskAnswers,
      results,
      context: {
        isComplete: true,
        weightOverrideCount: countWeightOverrides()
      }
    });
    renderResults(results, interpretation);
    $("#reducedResults").classList.add("is-visible");
    $("#reducedResults").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showValidation(validation, invalidWeights) {
    const missingCategoryIds = [...new Set(validation.missingRatings.map((item) => item.categoryId))];
    missingCategoryIds.forEach((id) => $(`#reduced-${cssEscape(id)}`)?.classList.add("is-pending"));
    validation.missingSafety.forEach((id) => $(`#safety-${cssEscape(id)}`)?.classList.add("is-pending"));
    const panel = $("#reducedValidation");
    panel.innerHTML = `
      <div class="validation-head">
        <div><h2>Faltan datos por completar</h2><p>Revisa los campos señalados para generar un diagnóstico fiable.</p></div>
        <button type="button" class="validation-close" id="closeReducedValidation" aria-label="Cerrar aviso">×</button>
      </div>
      <ul class="validation-list">
        ${validation.missingRatings.length ? `<li>${validation.missingRatings.length} valoraciones de categoría pendientes.</li>` : ""}
        ${validation.missingSafety.length ? `<li>${validation.missingSafety.length} controles de seguridad pendientes.</li>` : ""}
        ${invalidWeights.length ? `<li>${invalidWeights.length} pesos deben estar entre 1 y 10.</li>` : ""}
      </ul>`;
    panel.classList.add("is-visible");
    $("#closeReducedValidation").addEventListener("click", closeValidation);
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
    $("#closeReducedValidation").focus({ preventScroll: true });
  }

  function closeValidation() {
    const panel = $("#reducedValidation");
    panel.classList.remove("is-visible");
    panel.innerHTML = "";
  }

  function renderResults(results, interpretation) {
    const activeRows = results.categories.filter((row) => row.included);
    const panel = $("#reducedResults");
    panel.innerHTML = `
      <header class="results-head">
        <p class="section-kicker">DIAGNÓSTICO RÁPIDO</p>
        <h2 id="results-title">Resultado normalizado sobre 100</h2>
        <p>La puntuación combina la valoración global y el peso asignado a cada categoría incluida.</p>
      </header>
      <div class="score-grid">
        ${renderScoreCard("Gemini", "gemini", results.geminiScore100, results.gemini, results.maxGemini, interpretation.tools.gemini.band)}
        ${renderScoreCard("NotebookLM", "notebook", results.notebookScore100, results.notebook, results.maxNotebook, interpretation.tools.notebookLm.band)}
      </div>
      <div class="result-meta-grid">
        <div class="result-meta"><strong>${results.activeCategoryCount}</strong><span>categorías incluidas</span></div>
        <div class="result-meta"><strong>${formatWeight(results.categoryWeightTotal)}×</strong><span>suma de pesos</span></div>
        <div class="result-meta"><strong>${formatScore(interpretation.comparison.absoluteDifference)}</strong><span>diferencia absoluta</span></div>
        <div class="result-meta"><strong>${escapeHtml(interpretation.comparison.band?.label || "—")}</strong><span>ventaja relativa</span></div>
      </div>
      ${renderInterpretation(interpretation)}
      <p class="diagnostic-note"><strong>Alcance del resultado:</strong> esta lectura es orientativa porque resume cada categoría en una única valoración. Utiliza la evaluación detallada cuando necesites justificar la decisión por criterios concretos.</p>
      <section class="reduced-result-detail" aria-labelledby="reduced-detail-title">
        <h3 id="reduced-detail-title">Comparativa por categorías</h3>
        <div class="reduced-radar" tabindex="0" aria-label="Gráfico comparativo desplazable por categorías">${renderRadar(activeRows)}</div>
        ${renderCategoryTable(results.categories)}
      </section>
      <div class="reduced-result-actions">
        <button type="button" class="btn btn-ghost" id="downloadReducedBtn">Descargar resultado JSON</button>
        <button type="button" class="btn btn-primary" id="printReducedBtn">Guardar informe como PDF</button>
        <a class="btn btn-ghost" href="./index.html">Continuar con la evaluación detallada</a>
      </div>`;
    $("#downloadReducedBtn").addEventListener("click", () => downloadResult(results, interpretation));
    $("#printReducedBtn").addEventListener("click", () => window.print());
  }

  function renderScoreCard(label, tool, score, raw, maximum, band) {
    return `
      <article class="score-card" style="--tool:var(--${tool})">
        <h3>${label}</h3>
        <div class="score-value">${formatScore(score)}</div>
        <div class="score-sub">${formatScore(raw)} puntos ponderados de ${formatScore(maximum)} posibles</div>
        <div class="score-band">${escapeHtml(band?.label || "Sin clasificación")}</div>
        <div class="bar" aria-hidden="true"><span style="width:${Math.min(score, 100)}%"></span></div>
      </article>`;
  }

  function renderInterpretation(interpretation) {
    const titleByStatus = {
      ready: "Interpretación del resultado",
      conditional: "Resultado condicionado",
      blocked: "Uso no recomendado",
      not_interpretable: "Resultado no interpretable"
    };
    const signals = interpretation.signals.length
      ? `<div class="interpretation-signals"><h4>Condiciones detectadas</h4><ul>${interpretation.signals.map((signal) => `<li class="is-${escapeAttr(signal.severity)}"><strong>${escapeHtml(signal.criterionLabel)}:</strong> ${escapeHtml(signal.message)}</li>`).join("")}</ul></div>`
      : "";
    return `
      <section class="interpretation-report is-${escapeAttr(interpretation.status)}">
        <div class="interpretation-heading"><p>Lectura conjunta · ${escapeHtml(interpretation.comparison.band?.label || "Sin clasificación")}</p><h3>${titleByStatus[interpretation.status]}</h3></div>
        <p class="interpretation-primary">${escapeHtml(interpretation.primaryMessage)}</p>
        ${signals}
        <div class="interpretation-actions"><h4>Actuación sugerida</h4><ul>${interpretation.recommendedActions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul></div>
      </section>`;
  }

  function renderRadar(rows) {
    const size = 680;
    const center = size / 2;
    const radius = 225;
    const angleFor = (index) => -Math.PI / 2 + (Math.PI * 2 * index) / rows.length;
    const pointFor = (index, value, extra = 0) => {
      const angle = angleFor(index);
      const distance = ((value || 0) / 100) * radius + extra;
      return [center + Math.cos(angle) * distance, center + Math.sin(angle) * distance];
    };
    const polygon = (level) => rows.map((_, index) => pointFor(index, level).map((value) => value.toFixed(1)).join(",")).join(" ");
    const dataPolygon = (key) => rows.map((row, index) => pointFor(index, row[key]).map((value) => value.toFixed(1)).join(",")).join(" ");
    const labels = rows.map((row, index) => {
      const [x, y] = pointFor(index, 100, 42);
      const anchor = x < center - 15 ? "end" : x > center + 15 ? "start" : "middle";
      const label = row.category.length > 19 ? `${row.category.slice(0, 18)}…` : row.category;
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" fill="rgba(255,255,255,.88)" font-size="11" font-weight="800"><title>${escapeHtml(row.category)}</title>${escapeHtml(label)}</text>`;
    }).join("");
    return `
      <svg viewBox="0 0 ${size} ${size}" role="img" aria-labelledby="reducedRadarTitle reducedRadarDesc">
        <title id="reducedRadarTitle">Comparación de Gemini y NotebookLM por categorías</title>
        <desc id="reducedRadarDesc">Radar con las valoraciones normalizadas sobre cien de las categorías incluidas.</desc>
        ${[25, 50, 75, 100].map((level) => `<polygon points="${polygon(level)}" fill="none" stroke="rgba(255,255,255,.18)"></polygon>`).join("")}
        ${rows.map((_, index) => { const [x, y] = pointFor(index, 100); return `<line x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.14)"></line>`; }).join("")}
        <polygon points="${dataPolygon("geminiScore100")}" fill="rgba(124,58,237,.28)" stroke="var(--gemini)" stroke-width="4"></polygon>
        <polygon points="${dataPolygon("notebookScore100")}" fill="rgba(14,165,233,.24)" stroke="var(--notebook)" stroke-width="4"></polygon>
        ${labels}
      </svg>`;
  }

  function renderCategoryTable(rows) {
    return `
      <div class="reduced-table-wrap" tabindex="0" aria-label="Tabla desplazable de valoraciones por categoría">
        <table class="reduced-table">
          <caption>Detalle de las valoraciones utilizadas</caption>
          <thead><tr><th>Categoría</th><th>Estado</th><th>Peso</th><th>Gemini</th><th>NotebookLM</th></tr></thead>
          <tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.category)}</strong></td><td>${row.included ? "Incluida" : "Excluida"}</td><td>${formatWeight(row.weight)}×</td><td>${row.included ? formatScore(row.geminiScore100) : "—"}</td><td>${row.included ? formatScore(row.notebookScore100) : "—"}</td></tr>`).join("")}</tbody>
        </table>
      </div>`;
  }

  function downloadResult(results, interpretation) {
    const payload = {
      schemaVersion: "1.0.0",
      kind: "reduced-survey-result",
      exportedAt: new Date().toISOString(),
      questionnaireVersion: questionnaire.questionnaireVersion,
      mode: config.mode,
      categorySettings: state.categorySettings,
      ratings: state.ratings,
      safetyAnswers: state.safetyAnswers,
      results,
      interpretation
    };
    const blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `diagnostico-rapido-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function resetSurvey() {
    if (!confirm("¿Quieres borrar las valoraciones, pesos y controles de esta versión reducida?")) return;
    state.ratings = {};
    state.safetyAnswers = {};
    state.categorySettings = {};
    localStorage.removeItem(STORAGE_KEY);
    renderCategories();
    renderSafetyChecks();
    updateProgress();
    closeValidation();
    $("#reducedResults").classList.remove("is-visible");
    $("#contenido").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function countWeightOverrides() {
    return questionnaire.categories.filter((category) => {
      const setting = getCategorySetting(category);
      return setting.weight !== (category.defaultWeight ?? 1);
    }).length;
  }

  function getCategorySetting(category) {
    const setting = state.categorySettings[category.id] || {};
    return {
      included: setting.included !== false,
      weight: setting.weight ?? category.defaultWeight ?? 1
    };
  }

  function findCategory(categoryId) {
    return questionnaire.categories.find((category) => category.id === categoryId);
  }
}

async function loadApplicationData() {
  try {
    const [questionnaireResponse, configResponse, interpretationResponse] = await Promise.all([
      fetch("./data/questionnaire.v1.json", { cache: "no-store" }),
      fetch("./data/reduced-survey.v1.json", { cache: "no-store" }),
      fetch("./data/result-interpretations.v1.json", { cache: "no-store" })
    ]);
    if (![questionnaireResponse, configResponse, interpretationResponse].every((response) => response.ok)) {
      throw new Error("No se han podido cargar los datos del diagnóstico.");
    }
    const [questionnaire, config, interpretationMatrix] = await Promise.all([
      questionnaireResponse.json(), configResponse.json(), interpretationResponse.json()
    ]);
    if (!validateInterpretationMatrix(interpretationMatrix).valid) {
      throw new Error("La matriz interpretativa no es válida.");
    }
    return { questionnaire, config, interpretationMatrix };
  } catch (error) {
    const root = $("#contenido");
    root.innerHTML = `<section class="load-error"><p class="load-error-kicker">ERROR DE CARGA</p><h2>No se puede iniciar el diagnóstico</h2><p>${escapeHtml(error instanceof Error ? error.message : "Error desconocido.")}</p></section>`;
    return null;
  }
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function normaliseState(raw, questionnaire, safetyCriterionIds) {
  const knownCategories = new Set(questionnaire.categories.map((category) => category.id));
  const ratings = Object.fromEntries(Object.entries(raw?.ratings || {}).filter(([key, value]) => {
    const [categoryId, tool] = key.split(":");
    return knownCategories.has(categoryId) && ["gemini", "notebooklm"].includes(tool) && isValidRating(value);
  }).map(([key, value]) => [key, Number(value)]));
  const safetyAnswers = Object.fromEntries(Object.entries(raw?.safetyAnswers || {}).filter(([id, value]) => (
    safetyCriterionIds.includes(id) && ["yes", "no"].includes(value)
  )));
  const categorySettings = Object.fromEntries(Object.entries(raw?.categorySettings || {}).filter(([id, setting]) => (
    knownCategories.has(id) && setting && typeof setting === "object"
  )).map(([id, setting]) => [id, {
    included: setting.included !== false,
    ...(Number.isFinite(Number(setting.weight)) && Number(setting.weight) >= 1 && Number(setting.weight) <= 10
      ? { weight: Number(setting.weight) }
      : {})
  }]));
  return { ratings, safetyAnswers, categorySettings };
}

function isValidRating(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 4;
}

function formatScore(value) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value);
}

function formatWeight(value) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, useGrouping: false }).format(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function cssEscape(value) {
  return globalThis.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
