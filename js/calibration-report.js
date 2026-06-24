export function renderCalibrationReport({ generatedAt, validation, metrics, technicalChecks }) {
  const hasFieldSample = metrics.realCaseCount >= 30;
  const fieldStatus = hasFieldSample
    ? "Muestra de campo disponible"
    : "Evidencia de campo insuficiente";
  const technicalSummary = hasFieldSample
    ? `La infraestructura de calibración es reproducible y la muestra alcanza el mínimo previsto: ${metrics.realCaseCount} casos reales. Las métricas con denominador disponible pueden estimarse; los criterios sin evidencia explícita permanecen como no evaluables.`
    : `La infraestructura de calibración es reproducible y las comprobaciones técnicas están operativas. La validez de campo no puede estimarse todavía: hay ${metrics.realCaseCount} casos reales frente al mínimo de 30 y, por tanto, los porcentajes dependientes de consenso se mantienen como no evaluables.`;
  const findingsTitle = hasFieldSample
    ? "La muestra permite contrastar el acuerdo con el criterio experto"
    : "La implementación es comprobable; la validez externa sigue abierta";
  const limitationsTitle = hasFieldSample
    ? "La evidencia pendiente limita la aceptación definitiva"
    : "La ausencia de observaciones impide estimar validez externa";
  const nextStepsTitle = hasFieldSample
    ? "La siguiente decisión es completar los criterios no evaluables"
    : "La siguiente decisión es iniciar la captura controlada";
  const nextSteps = hasFieldSample
    ? [
        "Documentar por caso si existía una contraindicación crítica y si fue detectada.",
        "Revisar los casos sin mayoría experta antes de modificar pesos o umbrales.",
        "Ejecutar y registrar la prueba de sensibilidad ante variaciones de peso inferiores al 5%.",
        "Retirar la marca provisional solo tras cumplir todos los criterios y obtener aprobación pedagógica, técnica y de privacidad."
      ]
    : [
        "Registrar 30 casos anonimizados sin indicar previamente la herramienta esperada.",
        "Obtener tres dictámenes independientes por caso.",
        "Ejecutar npm run calibrate después de cada lote y revisar discrepancias antes de cambiar pesos o umbrales.",
        "Retirar la marca provisional solo tras cumplir criterios y obtener aprobación pedagógica, técnica y de privacidad."
      ];
  const evidenceSummary = hasFieldSample
    ? "Los dictámenes independientes permiten estimar acuerdo experto y contrastar las recomendaciones automáticas. Las comprobaciones técnicas siguen midiendo coherencia interna y no sustituyen la revisión metodológica de los resultados de campo."
    : `La matriz contiene ${technicalChecks.referenceCases} casos de referencia y ${technicalChecks.matrixCombinations} combinaciones conjuntas, verificadas por ${technicalChecks.automatedTests} pruebas automatizadas. Estas comprobaciones demuestran coherencia interna, no acuerdo con decisiones expertas reales.`;
  const rows = [
    ["Casos reales", String(metrics.realCaseCount), "≥ 30"],
    ["Acuerdo entre evaluadores", formatRate(metrics.expertAgreement), "Descriptivo"],
    ["Acuerdo automático-consenso", formatRate(metrics.automaticConsensusAgreement), "≥ 80%"],
    ["Concordancia detallada-reducida", formatRate(metrics.detailedReducedConcordance), "≥ 75%"],
    ["Detección de contraindicaciones", formatRate(metrics.criticalContraindicationDetection), "100%"],
    ["Recomendaciones definitivas incompletas", String(metrics.incompleteDefinitiveCases), "0"],
    ["Estabilidad de pesos", formatWeightStability(metrics), "0 violaciones"]
  ];

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Calibración metodológica de Elige IA</title>
  <style>
    :root { color-scheme: light; --ink: #172033; --muted: #596579; --line: #d8dee8; --accent: #155e75; --warn: #9a3412; --paper: #ffffff; --bg: #f2f5f8; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    main { max-width: 940px; margin: 0 auto; padding: 48px 24px 72px; }
    header, section { margin-bottom: 28px; padding: 28px; background: var(--paper); border: 1px solid var(--line); border-radius: 16px; }
    h1, h2 { margin: 0 0 14px; line-height: 1.18; }
    h1 { font-size: clamp(2rem, 5vw, 3.3rem); letter-spacing: -0.04em; }
    h2 { font-size: 1.35rem; color: var(--accent); }
    p, li { line-height: 1.65; }
    .status { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #ffedd5; color: var(--warn); font-weight: 700; }
    .summary { font-size: 1.1rem; }
    table { width: 100%; border-collapse: collapse; margin: 18px 0; }
    th, td { padding: 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { color: var(--muted); font-size: 0.88rem; text-transform: uppercase; letter-spacing: 0.05em; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    pre { overflow-x: auto; padding: 16px; border-radius: 12px; background: #e8eef3; }
    .source { color: var(--muted); font-size: 0.88rem; }
  </style>
</head>
<body>
  <main data-report-audience="technical">
    <header data-contract-section="title">
      <h1>Calibración metodológica de Elige IA</h1>
      <p>Estado a ${escapeHtml(formatDate(generatedAt))}</p>
    </header>

    <section data-contract-section="technical-summary">
      <h2>Resumen técnico</h2>
      <p><span class="status">${fieldStatus}</span></p>
      <p class="summary">${technicalSummary}</p>
    </section>

    <section data-contract-section="key-findings">
      <h2>${findingsTitle}</h2>
      <p>${evidenceSummary}</p>
      <table>
        <thead><tr><th>Métrica de campo</th><th>Resultado</th><th>Criterio inicial</th></tr></thead>
        <tbody>${rows.map(([name, value, target]) => `<tr><td>${name}</td><td>${value}</td><td>${target}</td></tr>`).join("")}</tbody>
      </table>
      <p class="source">Evidencia: contrato versionado de calibración, matriz interpretativa y suite automatizada del repositorio.</p>
    </section>

    <section data-contract-section="scope-data-and-metric-definitions">
      <h2>Alcance, datos y definiciones</h2>
      <p>La unidad de análisis es un caso educativo anonimizado y observado. Solo los registros con <code>provenance: observed</code> participan en las métricas de campo. Cada caso requiere tres evaluadores independientes, un resultado detallado, un resultado reducido y evidencia explícita sobre contraindicaciones y sensibilidad a variaciones de peso inferiores al 5%.</p>
      <p>“Acuerdo automático-consenso” es la proporción de casos con mayoría experta donde la recomendación detallada coincide exactamente con esa mayoría. “Concordancia detallada-reducida” usa como denominador los casos con ambas recomendaciones disponibles.</p>
    </section>

    <section data-contract-section="methodology">
      <h2>Método reproducible</h2>
      <p>El ejecutor valida identificadores, procedencia, recomendaciones y evaluadores; calcula denominadores explícitos; evita porcentajes cuando el denominador es cero; y contrasta cada métrica con los criterios publicados.</p>
      <pre>consenso = mayoría estricta de al menos 3 evaluadores
acuerdo = coincidencias / casos con consenso
concordancia = coincidencias detallada-reducida / casos comparables
estabilidad = 0 cambios fuera de umbral ante variaciones de peso &lt; 5%</pre>
    </section>

    <section data-contract-section="limitations-uncertainty-and-robustness-checks">
      <h2>${limitationsTitle}</h2>
      <p>${escapeHtml(validation.warnings.join(" ") || "No se detectaron advertencias estructurales.")} No se han fabricado recomendaciones expertas ni respuestas para completar artificialmente la muestra.</p>
      <p>Las pruebas de cobertura de bandas, prioridad de bloqueos, sesiones incompletas y coherencia de casos de referencia funcionan como controles de robustez interna. No sustituyen el pilotaje con docentes y responsables de tecnología y privacidad.</p>
    </section>

    <section data-contract-section="recommended-next-steps">
      <h2>${nextStepsTitle}</h2>
      <ol>
        ${nextSteps.map((step) => `<li>${escapeHtml(step).replace("npm run calibrate", "<code>npm run calibrate</code>")}</li>`).join("\n        ")}
      </ol>
    </section>

    <section data-contract-section="further-questions">
      <h2>Preguntas que debe resolver el piloto</h2>
      <ul>
        <li>¿Las discrepancias se concentran en una etapa educativa o tipo de tarea?</li>
        <li>¿La versión reducida pierde señales de riesgo o solo granularidad?</li>
        <li>¿Los desacuerdos provienen de textos ambiguos, pesos o límites de banda?</li>
      </ul>
    </section>
  </main>
</body>
</html>`;
}

function formatRate(metric) {
  if (metric.rate === null) return `No evaluable (0/${metric.denominator})`;
  return `${(metric.rate * 100).toFixed(1)}% (${metric.numerator}/${metric.denominator})`;
}

function formatWeightStability(metrics) {
  if (metrics.weightSensitivityEvaluatedCases < metrics.realCaseCount) {
    return `No evaluable (${metrics.weightSensitivityEvaluatedCases}/${metrics.realCaseCount} casos)`;
  }
  return `${metrics.weightSensitivityViolations} violaciones`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeZone: "Europe/Madrid"
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
