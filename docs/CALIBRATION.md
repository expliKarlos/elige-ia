# Protocolo de calibración metodológica

## Objetivo

Determinar si los pesos, bandas e interpretaciones representan adecuadamente casos educativos reales. Hasta completar este proceso, la matriz mantiene el estado `active-provisional-thresholds`.

## Muestra mínima recomendada

- 30 casos de uso diferentes para una primera calibración exploratoria.
- Al menos 3 evaluadores con experiencia pedagógica, tecnológica y de privacidad.
- Representación de distintas etapas educativas, niveles de autonomía y tipos de tarea.
- Inclusión deliberada de casos adecuados para ambas herramientas, para una sola y para ninguna.

## Procedimiento

1. Describir cada caso sin indicar qué herramienta se espera que gane.
2. Completar de forma independiente la evaluación detallada y la reducida.
3. Solicitar a los expertos una recomendación previa independiente: Gemini, NotebookLM, ambas, ninguna o información insuficiente.
4. Comparar esa recomendación con la clasificación automática.
5. Registrar discrepancias por categoría, banda, diferencia y señal de riesgo.
6. Revisar primero textos ambiguos; modificar pesos o umbrales solo cuando exista un patrón repetido.

## Métricas

- Acuerdo entre evaluadores expertos.
- Acuerdo entre resultado automático y consenso experto.
- Falsos positivos: la aplicación recomienda una herramienta que el consenso descarta.
- Falsos negativos: la aplicación descarta una herramienta considerada adecuada.
- Sensibilidad de la recomendación a cambios pequeños de peso.
- Concordancia entre versión reducida y detallada.
- Detección completa de contraindicaciones conocidas.

## Criterios de aceptación iniciales

- 100% de contraindicaciones críticas detectadas.
- Ningún caso incompleto presentado como recomendación definitiva.
- Al menos 80% de acuerdo con el consenso experto en la clasificación principal.
- Al menos 75% de concordancia entre versión reducida y detallada; las discrepancias deben explicarse por pérdida de granularidad.
- Ningún cambio de recomendación provocado por variaciones de peso inferiores al 5% salvo en resultados situados junto a un umbral declarado.

Estos valores son objetivos operativos iniciales, no propiedades demostradas del instrumento.

## Datos a conservar

Los casos se almacenarán anonimizados. No se incluirán nombres, cuentas, documentos del alumnado ni información sensible. Cada registro contendrá versión del cuestionario, pesos efectivos, respuestas, resultado, recomendación experta y observaciones.

### Formato operativo

El contrato versionado se mantiene en `data/calibration-cases.example.json`. Los casos reales se guardan en `data/calibration-cases.local.json`, excluido de Git para impedir su publicación accidental. Solo los registros con `provenance: "observed"` participan en las métricas de campo. Los escenarios construidos pueden utilizarse para regresión, pero nunca cuentan como casos reales.

Cada caso observado utiliza esta forma mínima:

```json
{
  "id": "case-001",
  "provenance": "observed",
  "scenario": "Descripción anonimizada del caso educativo",
  "expertRatings": [
    { "evaluatorId": "pedagogy", "recommendation": "notebooklm" },
    { "evaluatorId": "technology", "recommendation": "notebooklm" },
    { "evaluatorId": "privacy", "recommendation": "notebooklm" }
  ],
  "detailed": { "status": "ready", "recommendation": "notebooklm" },
  "reduced": { "status": "ready", "recommendation": "notebooklm" },
  "incomplete": false,
  "criticalContraindication": { "expected": false, "detected": false },
  "weightSensitivity": { "withinFivePercentChanged": false, "nearThreshold": false }
}
```

Valores admitidos para una recomendación: `gemini`, `notebooklm`, `both`, `neither` e `insufficient_information`.

### Ejecución reproducible

```powershell
Copy-Item data/calibration-cases.example.json data/calibration-cases.local.json
$env:CALIBRATION_DATASET = "data/calibration-cases.local.json"
npm run calibrate
```

El comando valida la muestra y genera `reports/calibration/results.v1.json` y `reports/calibration/report.html`. Si un denominador es cero, la métrica se marca como no evaluable en lugar de producir un porcentaje artificial.

## Cierre de la calibración

Para retirar la marca provisional se requiere:

1. Informe de resultados y discrepancias.
2. Aprobación explícita de los responsables pedagógico, técnico y de privacidad.
3. Nueva versión semántica de la matriz si cambia cualquier umbral o interpretación.
4. Casos de regresión añadidos antes de publicar la nueva versión.
