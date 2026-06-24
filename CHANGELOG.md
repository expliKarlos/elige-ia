# Registro de cambios

## [Sin publicar]

### Añadido

- Selector superior para cambiar entre el diagnóstico rápido y la evaluación detallada.
- Elección explícita de una, varias o todas las categorías antes de responder el modo detallado.
- Contador dinámico de categorías y preguntas incluidas en el informe.

### Corregido

- El modo detallado ya no muestra el contador histórico de dos respuestas por criterio.
- El informe de categoría compara ahora las baremaciones Gemini/NotebookLM sobre 10 y muestra por separado la necesidad indicada sobre 4.

## [0.3.0] - 2026-06-24

### Añadido

- Preguntas directas y orientadas a la necesidad para los 103 criterios.
- Contrato documentado de respuesta única aplicado a las matrices de ambas herramientas.

### Cambiado

- La evaluación detallada solicita 103 respuestas en lugar de 206 valoraciones por herramienta.
- El diagnóstico reducido solicita 18 respuestas de categoría y conserva cinco controles de seguridad independientes.
- Las sesiones y exportaciones utilizan claves compartidas de criterio; solo se migran respuestas históricas coincidentes.

### Corregido

- El generador del cuestionario conserva preguntas y metadatos de riesgo al regenerar los datos.
- Corregido un atributo ARIA no permitido en la escala del diagnóstico reducido.

## [0.2.0] - 2026-06-24

### Añadido

- Pipeline reproducible de calibración con métricas, controles de privacidad e informe técnico.

### Cambiado

- Reescalado lineal de la puntuación bruta 25–100 a una escala real 0–100.
- Migración de bandas, diferencias y casos interpretativos a la nueva escala.
- Conservación de las puntuaciones brutas como datos de auditoría.

## [0.1.1] - 2026-06-24

### Corregido

- La prueba de regresión histórica ya no depende de un archivo situado fuera del repositorio y puede ejecutarse en CI.

## [0.1.0] - 2026-06-24

### Añadido

- Diagnóstico rápido ponderado por categorías.
- Interpretación versionada de resultados y controles de riesgo.
- Exportación de informes a PDF.
- Pruebas Playwright en escritorio y móvil.
- Auditoría de accesibilidad con axe.
- Automatización de calidad y publicación en GitHub Pages.
- Protocolo de calibración metodológica.

### Corregido

- Reinicio completo de respuestas, categorías y pesos.
- Interpretación de comparaciones con categorías de riesgo excluidas.
- Contraste WCAG AA del botón principal y textos auxiliares.
