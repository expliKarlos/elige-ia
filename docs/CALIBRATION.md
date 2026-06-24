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

## Cierre de la calibración

Para retirar la marca provisional se requiere:

1. Informe de resultados y discrepancias.
2. Aprobación explícita de los responsables pedagógico, técnico y de privacidad.
3. Nueva versión semántica de la matriz si cambia cualquier umbral o interpretación.
4. Casos de regresión añadidos antes de publicar la nueva versión.
