import {
  calculateCategoryResult as calculateCategoryResultEngine,
  calculateSurveyResults as calculateSurveyResultsEngine,
  resetCategoryWeight,
  resetCriterionWeights,
  resolveWeightConfig
} from "./scoring.js";
import { validateQuestionnaire } from "./validation.js";

const questionnaire = await loadQuestionnaire();

if (questionnaire) {
  const MATRIX = questionnaire.categories.map(category => ({
    id: category.id,
    category: category.label,
    color: category.color,
    items: category.criteria.map(criterion => ({
      id: criterion.id,
      criterio: criterion.label,
      detalle: criterion.description,
      pesoGemini: criterion.defaultWeights.gemini,
      pesoNotebook: criterion.defaultWeights.notebooklm
    }))
  }));
  const SCALE = questionnaire.scale.map(option => ({
    value: option.value,
    label: option.label,
    hint: option.description
  }));

  const STORAGE_KEY = `gemini-notebooklm-survey-${questionnaire.questionnaireVersion}`;
      const $ = (selector, scope = document) => scope.querySelector(selector);
      const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
      const fmt = new Intl.NumberFormat("es-ES");
      const allItems = MATRIX.flatMap(category => category.items.map(item => ({ ...item, category: category.category, color: category.color })));
      const state = normaliseState(loadState());

      init();

      function init() {
        $("#statCats").textContent = MATRIX.length;
        $("#statQuestions").textContent = allItems.length;
        ensureActiveCategory();
        renderCategoryNav();
        renderCategoryControls();
        renderSurvey();
        bindGlobalEvents();
        updateProgress();
        updateNavState();
      }

      function loadState() {
        try {
          return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { answers: {} };
        } catch (error) {
          return { answers: {} };
        }
      }

      function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }

      function normaliseState(rawState) {
        const safeState = rawState && typeof rawState === "object" ? rawState : {};
        const active = Number.isInteger(Number(safeState.activeCategoryIndex)) ? Number(safeState.activeCategoryIndex) : 0;
        return {
          answers: safeState.answers && typeof safeState.answers === "object" ? safeState.answers : {},
          categoryPrefs: normaliseCategoryPrefs(safeState.categoryPrefs),
          weightOverrides: normaliseWeightOverrides(safeState.weightOverrides, safeState.categoryPrefs),
          activeCategoryIndex: Math.min(Math.max(active, 0), MATRIX.length - 1)
        };
      }

      function normaliseCategoryPrefs(prefs = {}) {
        return Object.fromEntries(MATRIX.map((category, index) => {
          const current = prefs[index] || {};
          return [index, {
            included: current.included !== false
          }];
        }));
      }

      function normaliseWeightOverrides(rawOverrides = {}, legacyPrefs = {}) {
        const overrides = { categories: {}, criteria: {} };
        const rawCategories = rawOverrides?.categories || {};
        const rawCriteria = rawOverrides?.criteria || {};

        questionnaire.categories.forEach((category, index) => {
          const legacyWeight = Number(legacyPrefs?.[index]?.relevance);
          const categoryWeight = Number(rawCategories[category.id] ?? legacyWeight);
          if (isValidWeight(categoryWeight) && categoryWeight !== category.defaultWeight) {
            overrides.categories[category.id] = categoryWeight;
          }
          category.criteria.forEach(criterion => {
            const candidate = rawCriteria[criterion.id];
            if (!candidate || typeof candidate !== "object") return;
            const weights = {};
            ["gemini", "notebooklm"].forEach(tool => {
              const value = Number(candidate[tool]);
              if (isValidWeight(value) && value !== criterion.defaultWeights[tool]) weights[tool] = value;
            });
            if (Object.keys(weights).length) overrides.criteria[criterion.id] = weights;
          });
        });
        return overrides;
      }

      function isValidWeight(value) {
        return Number.isFinite(value) && value >= 1 && value <= 10;
      }

      function ensureActiveCategory() {
        if (!Number.isInteger(state.activeCategoryIndex) || state.activeCategoryIndex < 0 || state.activeCategoryIndex >= MATRIX.length) {
          state.activeCategoryIndex = 0;
        }
      }

      function answerKey(itemId, tool) {
        return `${itemId}:${tool}`;
      }

      function getCategoryPreference(index) {
        if (!state.categoryPrefs[index]) {
          state.categoryPrefs[index] = { included: true };
        }
        return state.categoryPrefs[index];
      }

      function getEffectiveWeights() {
        return resolveWeightConfig(questionnaire, state.weightOverrides);
      }

      function getCategoryWeight(index) {
        return getEffectiveWeights().categories[MATRIX[index].id];
      }

      function getCriterionWeights(itemId) {
        return getEffectiveWeights().criteria[itemId];
      }

      function getCategoryMultiplier(index) {
        const pref = getCategoryPreference(index);
        return pref.included ? getCategoryWeight(index) : 0;
      }

      function getActiveCategories() {
        return MATRIX
          .map((category, index) => ({ category, index, multiplier: getCategoryMultiplier(index) }))
          .filter(row => row.multiplier > 0);
      }

      function getExpectedResponseCount() {
        return getActiveCategories().reduce((sum, row) => sum + row.category.items.length * 2, 0);
      }

      function getCompletedResponseCount() {
        return getActiveCategories().reduce((sum, row) => {
          return sum + row.category.items.reduce((itemSum, item) => {
            const g = state.answers[answerKey(item.id, "gemini")] ? 1 : 0;
            const n = state.answers[answerKey(item.id, "notebook")] ? 1 : 0;
            return itemSum + g + n;
          }, 0);
        }, 0);
      }

      function getCategoryStatus(index) {
        const category = MATRIX[index];
        const pref = getCategoryPreference(index);
        const completedQuestions = category.items.filter(item => isQuestionComplete(item)).length;
        const completedResponses = category.items.reduce((sum, item) => {
          return sum + (state.answers[answerKey(item.id, "gemini")] ? 1 : 0) + (state.answers[answerKey(item.id, "notebook")] ? 1 : 0);
        }, 0);
        return {
          included: pref.included,
          relevance: getCategoryWeight(index),
          totalQuestions: category.items.length,
          totalResponses: category.items.length * 2,
          completedQuestions,
          completedResponses,
          complete: completedQuestions === category.items.length && category.items.length > 0
        };
      }

      function isQuestionComplete(item) {
        return Boolean(state.answers[answerKey(item.id, "gemini")]) && Boolean(state.answers[answerKey(item.id, "notebook")]);
      }

      function score100(value, max) {
        if (!max) return 0;
        return Math.round((value / max) * 1000) / 10;
      }

      function formatScore(value) {
        return Number.isInteger(value) ? fmt.format(value) : fmt.format(Number(value).toFixed(1));
      }

      function formatWeight(value) {
        return Number(value).toLocaleString("es-ES", { maximumFractionDigits: 2 });
      }

      function renderCategoryNav() {
        const nav = $("#categoryNav");
        nav.innerHTML = MATRIX.map((category, index) => {
          const pref = getCategoryPreference(index);
          const categoryWeight = getCategoryWeight(index);
          return `
            <button type="button" class="cat-link" style="--cat:${category.color}" data-category-index="${index}" aria-label="Abrir categoría ${escapeAttr(category.category)}">
              <span class="cat-dot" aria-hidden="true"></span>
              <span class="cat-body">
                <span class="cat-name">${escapeHtml(category.category)}</span>
                <span class="cat-metrics" aria-hidden="true">
                  <span class="cat-metric" id="catQuestions-${index}">0/${category.items.length}</span>
                  <span class="cat-metric" id="catWeight-${index}">${pref.included ? formatWeight(categoryWeight) + "×" : "Off"}</span>
                </span>
              </span>
            </button>
          `;
        }).join("");
      }

      function renderCategoryControls() {
        const panel = $("#categoryConfig");
        const activeCount = getActiveCategories().length;
        const effectiveWeights = getEffectiveWeights();
        const modifiedCount = Object.keys(state.weightOverrides.categories).length + Object.keys(state.weightOverrides.criteria).length;
        panel.innerHTML = `
          <div class="category-config-head">
            <div>
              <h2 id="category-config-title">Categorías y ponderaciones</h2>
              <p>Activa las categorías relevantes y ajusta pesos decimales entre 1 y 10. Los resultados se recalculan con la configuración efectiva.</p>
            </div>
            <div class="category-config-actions">
              <button type="button" class="btn btn-soft" id="resetAllWeights" ${modifiedCount ? "" : "disabled"}>Restaurar todos los pesos</button>
              <button type="button" class="btn btn-dark" id="closeConfigBtn">Cerrar</button>
            </div>
          </div>
          <div class="weight-summary" role="status"><strong>${modifiedCount}</strong><span>${modifiedCount === 1 ? "grupo modificado" : "grupos modificados"}</span></div>
          <div class="category-config-grid">
            ${MATRIX.map((category, index) => {
              const pref = getCategoryPreference(index);
              const categoryWeight = effectiveWeights.categories[category.id];
              const categoryModified = Object.hasOwn(state.weightOverrides.categories, category.id);
              return `
                <article class="category-control${pref.included ? "" : " is-off"}" style="--cat:${category.color}">
                  <div class="category-control-title">
                    <label>
                      <input type="checkbox" data-pref-index="${index}" data-pref-type="included" ${pref.included ? "checked" : ""}>
                      <span>${escapeHtml(category.category)}</span>
                    </label>
                    ${categoryModified ? `<span class="modified-badge">Modificada</span>` : ""}
                  </div>
                  <div class="category-control-meta">
                    <span>${category.items.length} criterios · ${category.items.length * 2} respuestas</span>
                    <div class="category-weight-line">
                      <label for="categoryWeight-${index}">Peso de categoría</label>
                      <input id="categoryWeight-${index}" class="weight-input" type="number" min="1" max="10" step="0.1" value="${categoryWeight}" data-category-weight="${index}">
                      <button type="button" class="weight-reset" data-reset-category="${index}" ${categoryModified ? "" : "disabled"}>Restaurar</button>
                    </div>
                    <details class="criterion-weight-details">
                      <summary>Ajustar pesos de ${category.items.length} criterios</summary>
                      <div class="criterion-weight-list">
                        ${category.items.map((item, itemIndex) => {
                          const weights = effectiveWeights.criteria[item.id];
                          const modified = Object.hasOwn(state.weightOverrides.criteria, item.id);
                          return `<div class="criterion-weight-row${modified ? " is-modified" : ""}">
                            <div class="criterion-weight-name"><strong>${index + 1}.${itemIndex + 1}</strong><span>${escapeHtml(item.criterio)}</span>${modified ? `<span class="sr-only">Modificado</span>` : ""}</div>
                            <label>Gemini<input class="weight-input" type="number" min="1" max="10" step="0.1" value="${weights.gemini}" data-criterion-weight="${escapeAttr(item.id)}" data-weight-tool="gemini"></label>
                            <label>NotebookLM<input class="weight-input" type="number" min="1" max="10" step="0.1" value="${weights.notebooklm}" data-criterion-weight="${escapeAttr(item.id)}" data-weight-tool="notebooklm"></label>
                            <button type="button" class="weight-reset" data-reset-criterion="${escapeAttr(item.id)}" ${modified ? "" : "disabled"}>Restaurar</button>
                          </div>`;
                        }).join("")}
                      </div>
                    </details>
                  </div>
                </article>
              `;
            }).join("")}
          </div>
          <p class="normalization-note">Categorías activas: ${activeCount} de ${MATRIX.length}. Los pesos modificados se guardan únicamente en este dispositivo.</p>
        `;

        panel.querySelectorAll("input[data-pref-type='included']").forEach(input => {
          input.addEventListener("change", event => {
            const index = Number(event.currentTarget.dataset.prefIndex);
            getCategoryPreference(index).included = event.currentTarget.checked;
            saveState();
            renderCategoryNav();
            renderCategoryControls();
            renderSurvey();
            updateProgress();
            updateNavState();
            refreshResultsIfVisible();
          });
        });

        panel.querySelectorAll("[data-category-weight]").forEach(input => {
          input.addEventListener("change", event => updateCategoryWeight(event.currentTarget));
        });
        panel.querySelectorAll("[data-criterion-weight]").forEach(input => {
          input.addEventListener("change", event => updateCriterionWeight(event.currentTarget));
        });
        panel.querySelectorAll("[data-reset-category]").forEach(button => {
          button.addEventListener("click", event => {
            const index = Number(event.currentTarget.dataset.resetCategory);
            state.weightOverrides = resetCategoryWeight(state.weightOverrides, MATRIX[index].id);
            persistWeightChange();
          });
        });
        panel.querySelectorAll("[data-reset-criterion]").forEach(button => {
          button.addEventListener("click", event => {
            state.weightOverrides = resetCriterionWeights(state.weightOverrides, event.currentTarget.dataset.resetCriterion);
            persistWeightChange();
          });
        });
        $("#resetAllWeights")?.addEventListener("click", () => {
          if (!confirm("¿Restaurar todos los pesos predeterminados? Las respuestas no se modificarán.")) return;
          state.weightOverrides = { categories: {}, criteria: {} };
          persistWeightChange();
        });

        $("#closeConfigBtn")?.addEventListener("click", () => toggleCategoryConfig(false));
      }

      function updateCategoryWeight(input) {
        const index = Number(input.dataset.categoryWeight);
        const category = questionnaire.categories[index];
        const value = Number(input.value);
        if (!validateWeightInput(input, value)) return;
        if (value === category.defaultWeight) delete state.weightOverrides.categories[category.id];
        else state.weightOverrides.categories[category.id] = value;
        persistWeightChange();
      }

      function updateCriterionWeight(input) {
        const criterionId = input.dataset.criterionWeight;
        const tool = input.dataset.weightTool;
        const criterion = questionnaire.categories.flatMap(category => category.criteria).find(candidate => candidate.id === criterionId);
        const value = Number(input.value);
        if (!criterion || !validateWeightInput(input, value)) return;
        const current = { ...(state.weightOverrides.criteria[criterionId] || {}) };
        if (value === criterion.defaultWeights[tool]) delete current[tool];
        else current[tool] = value;
        if (Object.keys(current).length) state.weightOverrides.criteria[criterionId] = current;
        else delete state.weightOverrides.criteria[criterionId];
        persistWeightChange();
      }

      function validateWeightInput(input, value) {
        const valid = isValidWeight(value);
        input.setCustomValidity(valid ? "" : "Introduce un peso entre 1 y 10.");
        if (!valid) input.reportValidity();
        return valid;
      }

      function persistWeightChange() {
        saveState();
        renderCategoryNav();
        renderCategoryControls();
        renderSurvey();
        updateProgress();
        updateNavState();
        refreshResultsIfVisible();
      }

      function toggleCategoryConfig(force) {
        const panel = $("#categoryConfig");
        const shouldShow = typeof force === "boolean" ? force : !panel.classList.contains("is-visible");
        panel.classList.toggle("is-visible", shouldShow);
        $("#configBtn")?.setAttribute("aria-expanded", String(shouldShow));
        if (shouldShow) panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      function renderSurvey() {
        ensureActiveCategory();
        const root = $("#surveyRoot");
        root.innerHTML = MATRIX.map((category, categoryIndex) => {
          const pref = getCategoryPreference(categoryIndex);
          const status = getCategoryStatus(categoryIndex);
          const relevanceLabel = pref.included ? `Incluida · peso ${formatWeight(getCategoryWeight(categoryIndex))}×` : "No incluida en el resultado";
          const previousIndex = getPreviousCategoryIndex(categoryIndex);
          const nextIndex = getNextCategoryIndex(categoryIndex);
          const isCurrent = categoryIndex === state.activeCategoryIndex;
          return `
            <article class="category-section${isCurrent ? " is-current" : ""}${pref.included ? "" : " is-excluded"}" id="cat-${categoryIndex}" style="--cat:${category.color}" data-category-index="${categoryIndex}" ${isCurrent ? "" : "hidden"}>
              <header class="category-head">
                <div class="category-title">
                  <h2>${escapeHtml(category.category)}</h2>
                  <p>Categoría ${categoryIndex + 1} de ${MATRIX.length}. ${category.items.length} criterios operativos. <strong>${relevanceLabel}</strong>.</p>
                </div>
                <div class="category-badge${status.complete ? " is-complete" : ""}" id="sectionProgress-${categoryIndex}">${status.completedQuestions}/${status.totalQuestions}</div>
              </header>
              <div class="questions">
                ${category.items.map((item, itemIndex) => renderQuestion(category, item, categoryIndex, itemIndex)).join("")}
              </div>
              <div class="category-evaluate">
                <button type="button" class="btn evaluate-category" data-category-evaluate="${categoryIndex}">Evaluar solo esta categoría</button>
                <p class="category-evaluate-note" id="categoryEvaluateNote-${categoryIndex}" aria-live="polite">Completa las ${status.totalResponses} respuestas de esta categoría para ver su comparativa.</p>
              </div>
              <footer class="category-stepper" aria-label="Navegación entre categorías">
                <button type="button" class="btn btn-soft step-prev" data-goto="${previousIndex ?? ""}" ${previousIndex === null ? "disabled" : ""}>Categoría anterior</button>
                <div class="category-stepper-status">
                  ${escapeHtml(category.category)}
                  <span>${status.completedResponses}/${status.totalResponses} respuestas completadas · ${pref.included ? "incluida en el cálculo" : "excluida del cálculo"}</span>
                </div>
                ${nextIndex === null
                  ? `<button type="button" class="btn btn-primary step-finish">Finalizar encuesta</button>`
                  : `<button type="button" class="btn btn-primary step-next" data-goto="${nextIndex}">Siguiente categoría</button>`}
              </footer>
            </article>
          `;
        }).join("");

        root.querySelectorAll('input[type="radio"]').forEach(input => {
          input.addEventListener("change", event => {
            const target = event.currentTarget;
            state.answers[answerKey(target.dataset.itemId, target.dataset.tool)] = Number(target.value);
            saveState();
            $("#validationPanel").classList.remove("is-visible");
            target.closest(".question-card")?.classList.remove("is-pending");
            updateProgress();
            updateNavState();
            refreshResultsIfVisible();
          });
        });

        root.querySelectorAll(".step-prev, .step-next").forEach(button => {
          button.addEventListener("click", event => {
            const targetIndex = Number(event.currentTarget.dataset.goto);
            if (Number.isInteger(targetIndex)) setActiveCategory(targetIndex, { scroll: true });
          });
        });

        root.querySelectorAll(".step-finish").forEach(button => {
          button.addEventListener("click", finalizeSurvey);
        });

        root.querySelectorAll(".evaluate-category").forEach(button => {
          button.addEventListener("click", event => openCategoryDashboard(Number(event.currentTarget.dataset.categoryEvaluate)));
        });
      }

      function renderQuestion(category, item, categoryIndex, itemIndex) {
        const geminiValue = state.answers[answerKey(item.id, "gemini")];
        const notebookValue = state.answers[answerKey(item.id, "notebook")];
        const weights = getCriterionWeights(item.id);
        return `
          <article class="question-card" id="card-${item.id}" data-item-id="${item.id}">
            <div class="question-top">
              <div>
                <h3 class="question-title">${categoryIndex + 1}.${itemIndex + 1} · ${escapeHtml(item.criterio)}</h3>
                <p class="question-detail">${escapeHtml(item.detalle || "Criterio operativo de decisión.")}</p>
            </div>
            <div class="weights" aria-label="Ponderaciones de la matriz">
              <span class="weight-chip gemini">Gemini ×${formatWeight(weights.gemini)}</span>
              <span class="weight-chip notebook">NotebookLM ×${formatWeight(weights.notebooklm)}</span>
            </div>
          </div>
          <div class="rating-panel">
            ${renderToolRating(item, "gemini", "Gemini", weights.gemini, geminiValue)}
            ${renderToolRating(item, "notebook", "NotebookLM", weights.notebooklm, notebookValue)}
            </div>
          </article>
        `;
      }

      function renderToolRating(item, tool, label, weight, selectedValue) {
        const toolColor = tool === "gemini" ? "var(--gemini)" : "var(--notebook)";
        return `
          <fieldset class="tool-box" style="--tool:${toolColor}">
            <legend class="tool-label"><span><span class="mark" aria-hidden="true"></span>${label}</span><span>Peso ${weight}</span></legend>
            <div class="rating-grid" role="radiogroup" aria-label="${label} · ${escapeAttr(item.criterio)}">
              ${SCALE.map(option => `
                <label class="rating-option" title="${escapeAttr(option.hint)}">
                  <inpu
                    type="radio"
                    name="${item.id}-${tool}"
                    value="${option.value}"
                    data-item-id="${item.id}"
                    data-tool="${tool}"
                    ${Number(selectedValue) === option.value ? "checked" : ""}
                  >
                  <span>${option.label}<small>${option.value}</small></span>
                </label>
              `).join("")}
            </div>
          </fieldset>
        `;
      }

      function getPreviousCategoryIndex(currentIndex) {
        return currentIndex > 0 ? currentIndex - 1 : null;
      }

      function getNextCategoryIndex(currentIndex) {
        return currentIndex < MATRIX.length - 1 ? currentIndex + 1 : null;
      }

      function setActiveCategory(index, options = {}) {
        if (!Number.isInteger(index) || index < 0 || index >= MATRIX.length) return;
        state.activeCategoryIndex = index;
        saveState();
        renderSurvey();
        updateProgress();
        updateNavState();
        if (options.scroll !== false) {
          $("#surveyRoot")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }

      function updateNavState() {
        $$(".cat-link").forEach(link => {
          const index = Number(link.dataset.categoryIndex);
          const status = getCategoryStatus(index);
          link.classList.toggle("is-active", index === state.activeCategoryIndex);
          link.classList.toggle("is-muted", !status.included);
          link.classList.toggle("is-complete", status.complete);
          link.setAttribute("aria-current", index === state.activeCategoryIndex ? "true" : "false");
          link.setAttribute("aria-label", `${MATRIX[index].category}. ${status.completedQuestions} de ${status.totalQuestions} preguntas completas. ${status.included ? "Peso " + formatWeight(status.relevance) : "Excluida del cálculo"}.`);
        });
      }

      function bindGlobalEvents() {
        $("#categoryNav").addEventListener("click", event => {
          const button = event.target.closest(".cat-link");
          if (!button) return;
          setActiveCategory(Number(button.dataset.categoryIndex), { scroll: true });
        });

        $("#configBtn").addEventListener("click", () => toggleCategoryConfig());
        $("#finishBtn").addEventListener("click", finalizeSurvey);
        $("#resetBtn").addEventListener("click", () => {
          const shouldReset = confirm("¿Quieres borrar todas las respuestas de esta encuesta? Se mantendrá la selección de categorías y pesos.");
          if (!shouldReset) return;
          state.answers = {};
          saveState();
          $("#resultsPanel").classList.remove("is-visible");
          $("#validationPanel").classList.remove("is-visible");
          renderSurvey();
          updateProgress();
          updateNavState();
          $("#contenido")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        $("#categoryDashboard").addEventListener("click", event => {
          if (event.target === event.currentTarget || event.target.closest("[data-close-dashboard]")) closeCategoryDashboard();
        });
        document.addEventListener("keydown", event => {
          if (event.key === "Escape" && $("#categoryDashboard").classList.contains("is-visible")) closeCategoryDashboard();
        });
      }

      let dashboardReturnFocus = null;

      function calculateCategoryResults(categoryIndex) {
        const category = MATRIX[categoryIndex];
        if (!category) return null;
        return calculateCategoryResultEngine(questionnaire, category.id, state.answers, { weightOverrides: state.weightOverrides });
      }

      function openCategoryDashboard(categoryIndex) {
        const category = MATRIX[categoryIndex];
        const status = getCategoryStatus(categoryIndex);
        if (!category || !status) return;
        const note = $("#categoryEvaluateNote-" + categoryIndex);
        if (!status.complete) {
          const missingCount = status.totalResponses - status.completedResponses;
          if (note) {
            note.textContent = `Faltan ${missingCount} ${missingCount === 1 ? "respuesta" : "respuestas"} para evaluar esta categoría.`;
            note.classList.add("is-warning");
          }
          const firstMissing = category.items.find(item => !isQuestionComplete(item));
          const card = firstMissing ? $("#card-" + firstMissing.id) : null;
          card?.classList.add("is-pending");
          card?.scrollIntoView({ behavior: "smooth", block: "center" });
          card?.querySelector("input:not(:checked)")?.focus({ preventScroll: true });
          return;
        }

        if (note) {
          note.textContent = "Categoría completa. Abriendo comparativa normalizada sobre 100.";
          note.classList.remove("is-warning");
        }

        const results = calculateCategoryResults(categoryIndex);
        const modal = $("#categoryDashboard");
        const diff = results.diff;
        let verdict = "Ambas herramientas obtienen un resultado equilibrado en esta categoría.";
        if (diff >= 3) verdict = `Gemini destaca por ${formatScore(diff)} puntos sobre 100 en esta categoría.`;
        if (diff <= -3) verdict = `NotebookLM destaca por ${formatScore(Math.abs(diff))} puntos sobre 100 en esta categoría.`;
        $("#categoryDashboardContent").innerHTML = `
          <header class="category-dashboard-head" style="border-bottom:6px solid ${results.color}">
            <div><p class="category-dashboard-kicker">Resultado de una sola categoría</p><h2 id="categoryDashboardTitle">${escapeHtml(results.category)}</h2></div>
            <button type="button" class="btn dashboard-close" data-close-dashboard aria-label="Cerrar resultados de categoría">×</button>
          </header>
          <div class="category-dashboard-body">
            <div class="category-score-grid">
              ${renderCategoryScoreCard("Gemini", "gemini", results.geminiScore100, results.gemini, results.maxGemini)}
              ${renderCategoryScoreCard("NotebookLM", "notebook", results.notebookScore100, results.notebook, results.maxNotebook)}
            </div>
            <p class="category-dashboard-verdict">${escapeHtml(verdict)}</p>
            <div class="category-radar-panel">
              <div class="category-radar">${renderSingleCategoryRadar(results)}</div>
              <aside class="category-radar-copy">
                <h3>Comparativa por criterio</h3>
                <p>Cada eje representa un criterio de esta categoría. La escala va de 0 a 100: cuanto más lejos del centro, mayor es la valoración indicada.</p>
                <div class="dashboard-legend"><span><i style="--legend:var(--gemini)"></i>Gemini</span><span><i style="--legend:var(--notebook)"></i>NotebookLM</span></div>
              </aside>
            </div>
          </div>`;
        dashboardReturnFocus = document.activeElement;
        modal.classList.add("is-visible");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
        $(".category-dashboard-dialog", modal).focus();
      }

      function renderCategoryScoreCard(label, tool, score, raw, maximum) {
        return `<article class="category-score-card" style="--tool:var(--${tool})"><h3>${label}</h3><div class="category-score-value">${formatScore(score)}<small>/100</small></div><div class="category-score-meta">${fmt.format(raw)} puntos ponderados de ${fmt.format(maximum)} posibles</div><div class="bar" aria-hidden="true"><span style="width:${Math.min(score, 100)}%"></span></div></article>`;
      }

      function renderSingleCategoryRadar(results) {
        const rows = results.criteria;
        const size = 600;
        const center = 300;
        const radius = 190;
        const angleFor = index => -Math.PI / 2 + (Math.PI * 2 * index) / rows.length;
        const pointFor = (index, value, extra = 0) => {
          const angle = angleFor(index);
          const distance = ((value || 0) / 100) * radius + extra;
          return [center + Math.cos(angle) * distance, center + Math.sin(angle) * distance];
        };
        const pointsFor = key => rows.map((row, index) => pointFor(index, row[key]).map(value => value.toFixed(1)).join(",")).join(" ");
        const grid = [25, 50, 75, 100].map(level => `<polygon points="${rows.map((row, index) => pointFor(index, level).map(value => value.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="rgba(255,255,255,.18)" />`).join("");
        const axes = rows.map((row, index) => { const [x, y] = pointFor(index, 100); return `<line x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.16)" />`; }).join("");
        const labels = rows.map((row, index) => {
          const [x, y] = pointFor(index, 100, 40);
          const anchor = x < center - 14 ? "end" : x > center + 14 ? "start" : "middle";
          const labelX = anchor === "end" ? Math.max(x, 150) : anchor === "start" ? Math.min(x, 450) : x;
          const label = row.criterion.length > 24 ? row.criterion.slice(0, 22) + "…" : row.criterion;
          return `<text x="${labelX.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" fill="#FFFFFF" font-size="11" font-weight="800"><title>${escapeHtml(row.criterion)}</title>${escapeHtml(label)}</text>`;
        }).join("");
        return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-labelledby="singleRadarTitle singleRadarDesc"><title id="singleRadarTitle">Radar de ${escapeHtml(results.category)}</title><desc id="singleRadarDesc">Comparación de Gemini y NotebookLM por criterio, normalizada de cero a cien.</desc>${grid}${axes}<polygon points="${pointsFor("geminiScore100")}" fill="rgba(124,58,237,.30)" stroke="var(--gemini)" stroke-width="4"/><polygon points="${pointsFor("notebookScore100")}" fill="rgba(14,165,233,.25)" stroke="var(--notebook)" stroke-width="4"/>${labels}</svg>`;
      }

      function closeCategoryDashboard() {
        const modal = $("#categoryDashboard");
        modal.classList.remove("is-visible");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
        dashboardReturnFocus?.focus();
        dashboardReturnFocus = null;
      }

      function updateProgress() {
        const totalExpectedResponses = getExpectedResponseCount();
        const completedResponses = getCompletedResponseCount();
        const percent = totalExpectedResponses ? Math.round((completedResponses / totalExpectedResponses) * 100) : 0;
        $("#progressText").textContent = `${completedResponses} de ${totalExpectedResponses} respuestas activas completadas`;
        $("#progressPercent").textContent = `${percent}%`;
        $("#progressFill").style.width = `${percent}%`;

        MATRIX.forEach((category, index) => {
          const status = getCategoryStatus(index);
          const questions = $("#catQuestions-" + index);
          const weight = $("#catWeight-" + index);
          const section = $("#sectionProgress-" + index);
          if (questions) questions.textContent = `${status.completedQuestions}/${status.totalQuestions}`;
          if (weight) weight.textContent = status.included ? `${formatWeight(status.relevance)}×` : "Off";
          if (section) {
            section.textContent = status.included ? `${status.completedQuestions}/${status.totalQuestions} · ${formatWeight(status.relevance)}×` : "excluida";
            section.classList.toggle("is-complete", status.complete);
          }
        });
      }

      function finalizeSurvey() {
        const activeCategories = getActiveCategories();
        $("#resultsPanel").classList.remove("is-visible");
        $$(".question-card").forEach(card => card.classList.remove("is-pending"));

        if (!activeCategories.length) {
          showCategorySelectionWarning();
          return;
        }

        const pending = getPendingResponses();
        if (pending.length) {
          showValidation(pending);
          return;
        }

        const results = calculateResults();
        renderResults(results);
        $("#validationPanel").classList.remove("is-visible");
        $("#resultsPanel").classList.add("is-visible");
        $("#resultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
      }

      function showCategorySelectionWarning() {
        const panel = $("#validationPanel");
        panel.innerHTML = `
          <h2>Selecciona al menos una categoría</h2>
          <p>Todas las categorías están excluidas. Activa una o varias categorías para poder calcular el resultado sobre 100.</p>
          <button type="button" class="btn btn-primary" id="openConfigFromWarning">Abrir categorías y pesos</button>
        `;
        panel.classList.add("is-visible");
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
        $("#openConfigFromWarning").addEventListener("click", () => toggleCategoryConfig(true));
      }

      function getPendingResponses() {
        const pending = [];
        MATRIX.forEach((category, categoryIndex) => {
          if (getCategoryMultiplier(categoryIndex) === 0) return;
          category.items.forEach((item, itemIndex) => {
            const missingTools = [];
            if (!state.answers[answerKey(item.id, "gemini")]) missingTools.push("Gemini");
            if (!state.answers[answerKey(item.id, "notebook")]) missingTools.push("NotebookLM");
            if (missingTools.length) {
              pending.push({ ...item, category: category.category, categoryIndex, itemIndex, missingTools });
            }
          });
        });
        return pending;
      }

      function showValidation(pending) {
        const panel = $("#validationPanel");
        const first = pending[0];
        panel.innerHTML = `
          <h2>Faltan respuestas por completar</h2>
          <p>Quedan ${pending.length} preguntas incompletas. El botón abre la categoría correspondiente y enfoca la primera pregunta pendiente.</p>
          <button type="button" class="btn btn-primary" id="goFirstPending">Ir a la primera pendiente</button>
          <ul class="validation-list">
            ${pending.slice(0, 10).map(item => `<li><strong>${escapeHtml(item.category)}:</strong> ${escapeHtml(item.criterio)} · falta ${item.missingTools.join(" y ")}</li>`).join("")}
            ${pending.length > 10 ? `<li>… y ${pending.length - 10} preguntas más.</li>` : ""}
          </ul>
        `;
        panel.classList.add("is-visible");
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
        $("#goFirstPending").addEventListener("click", () => {
          setActiveCategory(first.categoryIndex, { scroll: false });
          updateProgress();
          updateNavState();
          setTimeout(() => {
            const card = $("#card-" + first.id);
            card?.classList.add("is-pending");
            card?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 60);
        });
      }

      function calculateResults() {
        const categorySettings = Object.fromEntries(MATRIX.map((category, index) => {
          const preference = getCategoryPreference(index);
          return [category.id, {
            included: preference.included
          }];
        }));
        return calculateSurveyResultsEngine(questionnaire, state.answers, {
          categorySettings,
          weightOverrides: state.weightOverrides
        });
      }

      function renderResults(results) {
        const diff = results.diff;
        let winnerText = "Resultado equilibrado: ambas herramientas tienen un encaje similar según las respuestas introducidas.";
        if (diff >= 3) winnerText = `Gemini queda por encima por ${formatScore(diff)} puntos sobre 100. Conviene revisar especialmente tareas creativas, conversacionales o de prototipado.`;
        if (diff <= -3) winnerText = `NotebookLM queda por encima por ${formatScore(Math.abs(diff))} puntos sobre 100. Conviene revisar especialmente tareas con fuentes, citas, estudio guiado y trazabilidad.`;

        const activeRows = results.categories.filter(row => row.included);
        const excludedRows = results.categories.filter(row => !row.included);

        $("#resultsPanel").innerHTML = `
          <div class="results-head">
            <h2 id="results-title">Resultados normalizados sobre 100</h2>
            <p>El total bruto suma cada respuesta multiplicada por la ponderación de la matriz y por el peso de categoría. Después se divide por la puntuación máxima posible de las categorías incluidas.</p>
          </div>
          <div class="score-grid">
            <article class="score-card" style="--tool:var(--gemini)">
              <h3>Gemini</h3>
              <div class="score-value">${formatScore(results.geminiScore100)}</div>
              <div class="score-sub">${fmt.format(results.gemini)} puntos de ${fmt.format(results.maxGemini)} posibles</div>
              <div class="bar" aria-hidden="true"><span style="width:${Math.min(results.geminiScore100, 100)}%"></span></div>
            </article>
            <article class="score-card" style="--tool:var(--notebook)">
              <h3>NotebookLM</h3>
              <div class="score-value">${formatScore(results.notebookScore100)}</div>
              <div class="score-sub">${fmt.format(results.notebook)} puntos de ${fmt.format(results.maxNotebook)} posibles</div>
              <div class="bar" aria-hidden="true"><span style="width:${Math.min(results.notebookScore100, 100)}%"></span></div>
            </article>
          </div>
          <div class="result-meta-grid">
            <div class="result-meta"><strong>${results.activeCategoryCount}</strong><span>categorías incluidas</span></div>
            <div class="result-meta"><strong>${formatWeight(results.categoryWeightTotal)}×</strong><span>suma de pesos de categoría</span></div>
            <div class="result-meta"><strong>${results.excludedCategoryCount}</strong><span>categorías excluidas</span></div>
            <div class="result-meta"><strong>${Object.keys(state.weightOverrides.categories).length + Object.keys(state.weightOverrides.criteria).length}</strong><span>grupos de pesos modificados</span></div>
          </div>
          <div class="winner">${escapeHtml(winnerText)}</div>
          <div class="breakdown-actions">
            <button type="button" class="btn btn-dark" id="breakdownBtn" aria-expanded="false" aria-controls="categoryDetails">Ver desglose por categoría</button>
          </div>
          <section class="category-details" id="categoryDetails" hidden>
            <div class="radar-panel">
              <div class="radar-card">${renderRadarChart(activeRows)}</div>
              <aside class="legend-card">
                <h3>Lectura del radar</h3>
                <p>Cada eje representa una categoría incluida. Cuanto más lejos del centro, mayor puntuación normalizada de la herramienta en esa categoría.</p>
                <div class="radar-legend-item"><span class="legend-dot" style="--legend:var(--gemini)"></span><span>Gemini</span></div>
                <div class="radar-legend-item"><span class="legend-dot" style="--legend:var(--notebook)"></span><span>NotebookLM</span></div>
              </aside>
            </div>
            ${renderCategoryTable(activeRows, excludedRows)}
          </section>
        `;

        $("#breakdownBtn")?.addEventListener("click", event => {
          const details = $("#categoryDetails");
          const isHidden = details.hasAttribute("hidden");
          details.toggleAttribute("hidden", !isHidden);
          event.currentTarget.setAttribute("aria-expanded", String(isHidden));
          event.currentTarget.textContent = isHidden ? "Ocultar desglose por categoría" : "Ver desglose por categoría";
          if (isHidden) details.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }

      function renderRadarChart(rows) {
        if (!rows.length) {
          return `<p>No hay categorías incluidas para dibujar el radar.</p>`;
        }
        const size = 640;
        const center = size / 2;
        const radius = 220;
        const levels = [25, 50, 75, 100];
        const angleFor = index => -Math.PI / 2 + (Math.PI * 2 * index) / rows.length;
        const pointFor = (index, value, extra = 0) => {
          const angle = angleFor(index);
          const r = ((value || 0) / 100) * radius + extra;
          return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
        };
        const poly = tool => rows.map((row, index) => pointFor(index, row[tool]).map(n => n.toFixed(1)).join(",")).join(" ");
        const grid = levels.map(level => `<polygon points="${rows.map((_, index) => pointFor(index, level).map(n => n.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1" />`).join("");
        const axes = rows.map((row, index) => {
          const [x, y] = pointFor(index, 100);
          return `<line x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.13)" stroke-width="1" />`;
        }).join("");
        const labels = rows.map((row, index) => {
          const [x, y] = pointFor(index, 100, 42);
          const label = row.category.length > 22 ? row.category.slice(0, 20) + "…" : row.category;
          const anchor = x < center - 16 ? "end" : x > center + 16 ? "start" : "middle";
          return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" fill="rgba(255,255,255,.86)" font-size="11" font-weight="800"><title>${escapeHtml(row.category)}</title>${escapeHtml(label)}</text>`;
        }).join("");
        const geminiPoints = rows.map((row, index) => pointFor(index, row.geminiScore100).map(n => n.toFixed(1)).join(",")).join(" ");
        const notebookPoints = rows.map((row, index) => pointFor(index, row.notebookScore100).map(n => n.toFixed(1)).join(",")).join(" ");

        return `
          <svg viewBox="0 0 ${size} ${size}" role="img" aria-labelledby="radarTitle radarDesc">
            <title id="radarTitle">Radar comparativo por categoría</title>
            <desc id="radarDesc">Comparación de Gemini y NotebookLM en puntuación normalizada de cero a cien por categoría incluida.</desc>
            <rect width="${size}" height="${size}" rx="24" fill="rgba(255,255,255,.04)" />
            ${grid}
            ${axes}
            <polygon points="${geminiPoints}" fill="rgba(124,58,237,.28)" stroke="var(--gemini)" stroke-width="4" />
            <polygon points="${notebookPoints}" fill="rgba(14,165,233,.24)" stroke="var(--notebook)" stroke-width="4" />
            ${rows.map((row, index) => {
              const [gx, gy] = pointFor(index, row.geminiScore100);
              const [nx, ny] = pointFor(index, row.notebookScore100);
              return `<circle cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" r="4" fill="var(--gemini)" /><circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="4" fill="var(--notebook)" />`;
            }).join("")}
            ${labels}
          </svg>
        `;
      }

      function renderCategoryTable(activeRows, excludedRows) {
        const active = activeRows.map(row => `
          <tr>
            <td><strong>${escapeHtml(row.category)}</strong><div class="muted">${row.questionCount} criterios</div></td>
            <td>Incluida</td>
            <td>${row.relevance}×</td>
            <td style="--tool:var(--gemini)">${formatScore(row.geminiScore100)}<div class="category-score-bar"><span style="width:${Math.min(row.geminiScore100, 100)}%"></span></div></td>
            <td style="--tool:var(--notebook)">${formatScore(row.notebookScore100)}<div class="category-score-bar"><span style="width:${Math.min(row.notebookScore100, 100)}%"></span></div></td>
            <td>${row.diff > 0 ? "+" : ""}${formatScore(row.diff)}</td>
            <td>${fmt.format(row.gemini)} / ${fmt.format(row.maxGemini)} · ${fmt.format(row.notebook)} / ${fmt.format(row.maxNotebook)}</td>
          </tr>
        `).join("");
        const excluded = excludedRows.map(row => `
          <tr>
            <td><strong>${escapeHtml(row.category)}</strong><div class="muted">${row.questionCount} criterios</div></td>
            <td>Excluida</td>
            <td>${row.relevance}×</td>
            <td colspan="4" class="muted">No entra en el cálculo normalizado.</td>
          </tr>
        `).join("");
        return `
          <div class="category-table-wrap">
            <table class="category-table">
              <caption>Desglose de puntuación por categoría</caption>
              <thead>
                <tr>
                  <th scope="col">Categoría</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Peso</th>
                  <th scope="col">Gemini /100</th>
                  <th scope="col">NotebookLM /100</th>
                  <th scope="col">Diferencia</th>
                  <th scope="col">Bruto / máximo</th>
                </tr>
              </thead>
              <tbody>${active}${excluded}</tbody>
            </table>
          </div>
        `;
      }

      function refreshResultsIfVisible() {
        const panel = $("#resultsPanel");
        if (!panel.classList.contains("is-visible")) return;
        if (!getActiveCategories().length) {
          panel.classList.remove("is-visible");
          return;
        }
        renderResults(calculateResults());
        panel.classList.add("is-visible");
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, "&#096;");
      }
}

async function loadQuestionnaire() {
  try {
    const response = await fetch("./data/questionnaire.v1.json");
    if (!response.ok) throw new Error(`Respuesta HTTP ${response.status}.`);
    const data = await response.json();
    const validation = validateQuestionnaire(data);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    return data;
  } catch (error) {
    renderLoadError(error instanceof Error ? error.message : String(error));
    return null;
  }
}

function renderLoadError(detail) {
  document.body.innerHTML = `
    <main class="load-error" role="alert">
      <p class="load-error-kicker">No se ha podido iniciar la encuesta</p>
      <h1>Revisa el archivo del cuestionario</h1>
      <p>La aplicación no ha podido cargar o validar <code>data/questionnaire.v1.json</code>.</p>
      <details><summary>Detalle técnico</summary><pre>${escapeForError(detail)}</pre></details>
      <button type="button" class="btn btn-primary" id="retryLoad">Intentar de nuevo</button>
    </main>`;
  document.querySelector("#retryLoad")?.addEventListener("click", () => location.reload());
}

function escapeForError(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
