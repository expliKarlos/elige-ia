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
- [x] Mantener por ahora la identidad visual La Salle.

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

- [ ] Crear `index.html`, `css/app.css` y `js/app.js`.
- [ ] Conservar identidad La Salle, categorías y comportamiento responsive.
- [ ] Mostrar un error recuperable si el JSON no puede cargarse.

### Tarea 3.2: Recuperar los flujos de encuesta

- [ ] Navegación, progreso, validación y reinicio.
- [ ] Resultado global y dashboards parciales.
- [ ] Persistencia local con versión de cuestionario.

### Punto de control

- [ ] El flujo principal funciona de extremo a extremo.
- [ ] No hay errores de consola en escritorio ni móvil.

## Fase 4 — Edición de pesos

### Tarea 4.1: Editor de pesos de criterio

- [ ] Cambiar pesos Gemini y NotebookLM dentro del rango aprobado.
- [ ] Indicar valores modificados.
- [ ] Restaurar valores predeterminados.

### Tarea 4.2: Recalcular y explicar

- [ ] Actualizar resultados después de modificar pesos.
- [ ] Mostrar qué configuración produjo el resultado.
- [ ] Incluir pesos efectivos en las exportaciones.

## Fase 5 — Importación y exportación

### Tarea 5.1: Contrato JSON

- [ ] Exportar sesión, respuestas, pesos, versiones y resultados.
- [ ] Importar con validación y vista previa.
- [ ] Rechazar archivos incompatibles sin modificar el estado actual.
- [ ] Exportar e importar configuraciones de pesos separadas de las sesiones.

## Fase 6 — Publicación y forks

### Tarea 6.1: Automatización

- [ ] Ejecutar validación y pruebas en GitHub Actions.
- [ ] Publicar GitHub Pages únicamente si las comprobaciones pasan.
- [ ] Documentar configuración del repositorio.

### Tarea 6.2: Experiencia de fork

- [ ] Documentar personalización de datos y tratamiento independiente de la marca.
- [ ] Confirmar rutas relativas bajo nombres de repositorio diferentes.
- [ ] Añadir guía de ejecución local y solución de problemas.

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
