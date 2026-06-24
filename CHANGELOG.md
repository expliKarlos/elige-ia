# Registro de cambios

## [Sin publicar]

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
