# Hoja de ruta

## Visión

Evolucionar la encuesta standalone hacia una aplicación estática modular, reproducible y personalizable, manteniendo la ausencia de backend como restricción de diseño.

## Fase 0 — Especificación y base del repositorio

- [x] Crear la carpeta local `github`.
- [x] Definir alcance, límites y criterios de éxito.
- [x] Definir estructura inicial compatible con GitHub Pages.
- [x] Preparar exclusiones básicas de Git.
- [x] Aprobar pesos decimales entre 1 y 10.
- [x] Confirmar JSON como único formato de intercambio.
- [x] Confirmar exportación independiente de pesos.
- [x] Adoptar GNU AGPLv3 para el código.
- [x] Adoptar la identidad visual expliCarlos.

### Punto de control

- [x] El propietario confirma las decisiones necesarias para iniciar el modelo de datos.

## Fase 1 — Modelo de datos versionado

### Tarea 1.1: Extraer el cuestionario

**Descripción:** trasladar categorías, criterios, colores y pesos desde `eleccion_2.html` a `data/questionnaire.v1.json`.

**Criterios de aceptación:**

- [x] Los 18 identificadores de categoría son únicos.
- [x] Los 103 criterios conservan texto, descripción y pesos.
- [x] La extracción no cambia los valores de la matriz actual.

**Verificación:** `node scripts/validate-questionnaire.mjs` y comparación automática con la fuente.

**Dependencias:** aprobación de la Fase 0.

### Tarea 1.2: Crear el validador de datos

**Descripción:** rechazar versiones, identificadores, colores o pesos inválidos antes de arrancar la aplicación.

**Criterios de aceptación:**

- [x] Detecta identificadores duplicados.
- [x] Detecta campos obligatorios y pesos fuera de rango.
- [x] Devuelve errores legibles con la ruta del campo.

**Verificación:** `node --test tests/questionnaire-validation.test.js`.

### Punto de control

- [x] El JSON contiene exactamente 18 categorías y 103 criterios.
- [x] Todos los tests de datos pasan.

## Fase 2 — Motor de cálculo independiente

### Tarea 2.1: Extraer normalización y ponderación

- [x] Implementar funciones puras sin DOM ni almacenamiento.
- [x] Cubrir resultados globales y por categoría.
- [x] Comparar resultados con casos capturados de `eleccion_2.html`.

### Tarea 2.2: Definir configuración efectiva de pesos

- [x] Combinar valores predeterminados y personalizados.
- [x] Restaurar pesos por criterio, categoría o cuestionario completo.
- [x] Evitar resultados no finitos o máximos inválidos.

### Punto de control

- [x] El motor reproduce los resultados del standalone.
- [x] Las pruebas unitarias pasan con entradas límite.

## Fase 3 — Aplicación modular funcional

### Tarea 3.1: Montar la interfaz desde JSON

- [x] Crear `index.html`, `css/app.css` y `js/app.js`.
- [x] Conservar las categorías y el comportamiento responsive al aplicar la identidad expliCarlos.
- [x] Mostrar un error recuperable si el JSON no puede cargarse.

### Tarea 3.2: Recuperar los flujos de encuesta

- [x] Navegación, progreso, validación y reinicio.
- [x] Resultado global y dashboards parciales.
- [x] Persistencia local con versión de cuestionario.

### Punto de control

- [x] El flujo principal funciona de extremo a extremo.
- [x] No hay errores de consola en escritorio ni móvil.

## Fase 4 — Edición de pesos

### Tarea 4.1: Editor de pesos de criterio

- [x] Cambiar pesos Gemini y NotebookLM dentro del rango aprobado.
- [x] Indicar valores modificados.
- [x] Restaurar valores predeterminados.

### Tarea 4.2: Recalcular y explicar

- [x] Actualizar resultados después de modificar pesos.
- [x] Mostrar qué configuración produjo el resultado.
- [x] Incluir pesos efectivos en las exportaciones.

## Fase 5 — Importación y exportación

### Tarea 5.1: Contrato JSON

- [x] Exportar sesión, respuestas, pesos, versiones y resultados.
- [x] Importar con validación y vista previa.
- [x] Rechazar archivos incompatibles sin modificar el estado actual.
- [x] Exportar e importar configuraciones de pesos separadas de las sesiones.

## Fase 6 — Publicación y forks

### Tarea 6.1: Automatización

- [x] Ejecutar validación, pruebas unitarias, E2E y accesibilidad en GitHub Actions.
- [x] Preparar la publicación de GitHub Pages únicamente si las comprobaciones pasan.
- [x] Documentar configuración, publicación y reversión del repositorio.
- [ ] Conectar el remoto, activar GitHub Pages y verificar la primera publicación.

### Tarea 6.2: Experiencia de fork

- [x] Documentar personalización de datos y tratamiento independiente de la marca.
- [x] Confirmar rutas relativas bajo nombres de repositorio diferentes mediante el empaquetado `_site/`.
- [x] Añadir guía de ejecución local y solución de problemas.

## Fase 7 — Interpretación de resultados

### Tarea 7.1: Contrato interpretativo

- [x] Definir bandas individuales de idoneidad y diferencias comparativas.
- [x] Cubrir las 36 combinaciones posibles entre los niveles de Gemini y NotebookLM.
- [x] Documentar casos de referencia como 36–41, 53–71 y 87–92.
- [x] Registrar la matriz en `data/result-interpretations.v1.json`.

### Tarea 7.2: Riesgos e integración

- [x] Identificar criterios de privacidad y no uso que no pueden compensarse con la puntuación global.
- [x] Incorporar polaridad y severidad al contrato del cuestionario y al evaluador interpretativo.
- [x] Implementar el evaluador que combine puntuaciones, respuestas crudas y matriz.
- [x] Mostrar informes interpretativos en la interfaz después de validar los bloqueos.

## Fase 8 — Preparación de producción y validación

### Tarea 8.1: Puertas de calidad

- [x] Comprobar sintaxis, JSON, formato y enlaces provisionales.
- [x] Automatizar los flujos críticos en Chromium de escritorio y móvil.
- [x] Incorporar axe y corregir infracciones graves de contraste.
- [x] Auditar dependencias y automatizar sus actualizaciones.

### Tarea 8.2: Evidencia metodológica

- [x] Documentar el protocolo de calibración y sus criterios de aceptación.
- [x] Automatizar la validación, las métricas y el informe de calibración sin publicar los casos reales.
- [ ] Ejecutar el piloto con casos reales y evaluadores expertos.
- [ ] Ajustar pesos y bandas únicamente si la evidencia lo justifica.
- [ ] Aprobar y versionar la primera matriz interpretativa no provisional.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---:|---|
| Cambiar pesos rompe la reproducibilidad | Alto | Exportar instantánea de pesos y versión |
| JSON editado manualmente es inválido | Alto | Validador local y control en CI |
| `file://` no permite cargar JSON | Medio | Servidor local documentado |
| Fork publicado bajo otra ruta | Medio | Solo rutas relativas |
| Importación maliciosa o corrupta | Alto | Validación, límites y renderizado seguro |
| Divergencia respecto al standalone | Alto | Casos de regresión con resultados conocidos |
| Datos personales terminan en Git | Alto | Política explícita y exportación solo local |
