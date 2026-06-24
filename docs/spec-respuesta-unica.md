# Especificación: respuesta única por necesidad

## Objetivo

El usuario describe las necesidades de su caso educativo sin valorar directamente Gemini ni NotebookLM. Cada criterio y cada categoría reducida recoge una única respuesta de 1 a 4. Esa respuesta alimenta las dos matrices internas de pesos para calcular y comparar ambas herramientas.

## Contrato de datos

- Cuestionario detallado: `answers[criterionId] = 1..4`.
- Diagnóstico reducido: `ratings[categoryId] = 1..4`.
- Los pesos `defaultWeights.gemini` y `defaultWeights.notebooklm` se conservan.
- El motor detallado acepta temporalmente claves históricas `criterionId:gemini` y `criterionId:notebook` como compatibilidad de lectura, pero la interfaz y las nuevas exportaciones solo producen claves compartidas.
- La versión del cuestionario pasa a `2.0.0`; las sesiones de una versión anterior no se importan silenciosamente.
- Cada criterio incorpora un campo `question` terminado en signo de interrogación. `label` se conserva como nombre corto para tablas, pesos y gráficos.

## Cálculo

- Detallado: la misma necesidad se multiplica por el peso específico de cada herramienta y por el peso de categoría.
- Reducido: la necesidad de categoría se multiplica por la suma de pesos de criterios de cada herramienta dentro de esa categoría y por el peso de categoría.
- Se mantienen la normalización real 0–100, las exclusiones, los pesos configurables, las bandas, las recomendaciones y los bloqueos de seguridad.
- Los controles binarios de seguridad continúan separados de las escalas de necesidad.

## Interfaz

- Una tarjeta por criterio, con una sola escala de respuesta.
- Escala: `No lo necesito`, `Lo necesito poco`, `Lo necesito bastante`, `Es imprescindible`.
- El progreso detallado tiene un máximo de 103 respuestas, no 206.
- La versión reducida tiene una respuesta por categoría, no una por herramienta.
- Las matrices de pesos permanecen visibles como trazabilidad, pero no se pide al usuario valorar cada herramienta.

## Compatibilidad y privacidad

- No se añaden dependencias ni servicios externos.
- El almacenamiento sigue siendo local al navegador.
- Las exportaciones mantienen selección de categorías, pesos y resultados.
- Las sesiones incompatibles se rechazan con un mensaje explícito.

## Comandos

- Validación completa: `npm run check`
- Build estático: `npm run build`
- Calibración local: `$env:CALIBRATION_DATASET='data/calibration-cases.local.json'; npm run calibrate`
- Pruebas de navegador: `npm run test:e2e`

## Estructura afectada

- `data/questionnaire.v1.json`: preguntas, escala y versión.
- `js/scoring.js`, `js/reduced-scoring.js`: lectura y cálculo compartidos.
- `js/app.js`, `js/app-reducida.js`: interfaz, estado, progreso y validación.
- `js/import-export.js`: contrato de sesiones.
- `js/interpretation.js`: señales de riesgo con respuesta compartida.
- `tests/`: contratos, cálculo, importación e interfaz.

## Criterios de aceptación

1. Cada criterio detallado muestra exactamente un grupo de cuatro opciones.
2. Cada categoría reducida muestra exactamente un grupo de cuatro opciones.
3. La respuesta única produce resultados diferentes cuando las matrices de pesos de las herramientas difieren y el perfil de necesidades no es uniforme.
4. Todos los criterios presentan preguntas directas, comprensibles y terminadas en `?`.
5. Riesgos, pesos, exclusiones, normalización e interpretación siguen operativos.
6. Todas las pruebas, el build y la comprobación visual pasan sin errores.

## Límites

- No se recalibran pesos ni umbrales en esta migración.
- Los 50 escenarios y dictámenes expertos se conservan, pero sus resultados automáticos deberán regenerarse.
- No se publican datos de campo privados.
