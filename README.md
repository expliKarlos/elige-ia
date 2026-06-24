# ¿Qué herramienta utilizo? · expliCarlos

Aplicación web estática para comparar Gemini y NotebookLM mediante un cuestionario ponderado de necesidades. Cada respuesta del usuario se aplica a las matrices de pesos de ambas herramientas. El proyecto puede publicarse en GitHub Pages, ejecutarse localmente y personalizarse mediante forks sin depender de un backend.

## Estado

Las fases de modelo de datos, motor de cálculo y migración funcional están completas. `index.html` contiene la evaluación detallada y `index-reducida.html` ofrece un diagnóstico rápido ponderado por categorías. `../eleccion_2.html` permanece como referencia histórica para las pruebas de regresión.

La aplicación permite editar pesos decimales, restaurarlos y descargar o importar dos tipos de JSON:

- Sesión completa: respuestas, categorías, pesos, versiones y resultados reproducibles.
- Configuración de pesos: ajustes compartibles sin respuestas.

La evaluación detallada formula 103 preguntas directas y recoge una sola respuesta por criterio. El diagnóstico reducido resume el proceso en 18 respuestas de categoría y cinco controles de seguridad. El usuario no puntúa las herramientas: expresa la importancia de cada necesidad y el motor calcula ambas alternativas con sus pesos específicos.

El selector situado sobre la cabecera permite alternar entre los modos rápido y detallado. En el modo detallado se puede elegir una sola categoría, varias o todas; el progreso y el informe se limitan automáticamente al alcance seleccionado. Cada categoría completa puede evaluarse también mediante su informe individual.

El informe final incluye una interpretación conjunta, un desglose secuencial con resultados y radar para cada categoría y una vista de impresión preparada para guardarse como PDF sin la navegación lateral.

Antes de aplicar una importación se muestra una vista previa. Los archivos incompatibles o mayores de 1 MB se rechazan sin modificar el estado local.

La matriz versionada [`data/result-interpretations.v1.json`](data/result-interpretations.v1.json) define bandas individuales, diferencias, 36 combinaciones de idoneidad conjunta y casos de referencia. El informe de resultados la combina con la polaridad y severidad declaradas en los criterios para impedir que una contraindicación quede oculta por la puntuación global.

Si se excluye una categoría que contiene controles de riesgo, la comparación de puntuaciones continúa siendo válida, pero la adopción queda marcada como provisional hasta evaluar esos riesgos. Una contraindicación contestada afirmativamente sigue bloqueando la recomendación de ambas herramientas.

Con respuestas completas, el motor calcula primero una puntuación bruta de 25–100 y la reescala linealmente mediante `(puntuación bruta - 25) / 75 × 100`. El resultado mostrado e interpretado utiliza así una escala real de 0–100; la puntuación bruta se conserva solo para trazabilidad.

Los umbrales interpretativos están versionados, pero siguen siendo provisionales hasta completar el protocolo de calibración con evidencia de uso real.

## Principios

- Sin backend y sin cuentas de usuario.
- Datos personales y respuestas únicamente en el navegador o en archivos descargados.
- JSON como formato canónico de cuestionarios, pesos y sesiones.
- JSON como único formato de intercambio.
- Rutas relativas compatibles con GitHub Pages y forks.
- Cuestionarios versionados y resultados reproducibles.
- Sin proceso de compilación obligatorio.

## Documentación

- [Especificación](docs/SPEC.md)
- [Hoja de ruta](ROADMAP.md)
- [Preparación y publicación](docs/RELEASE.md)
- [Calibración metodológica](docs/CALIBRATION.md)
- [Informe de calibración actual](reports/calibration/report.html)
- [Decisión de arquitectura y despliegue](docs/decisions/ADR-001-static-pages.md)

## Inicio rápido

Desde esta carpeta:

```powershell
npm install
npm run check
npm run test:e2e
```

Para utilizar la aplicación localmente:

```powershell
python -m http.server 8000
```

Abrir después `http://localhost:8000`. El archivo no debe abrirse directamente mediante `file://`, porque los navegadores bloquean la carga de los JSON externos.

### Comandos

| Comando | Finalidad |
|---|---|
| `npm run check` | Formato, sintaxis, JSON, cuestionario y pruebas unitarias |
| `npm run test:e2e` | Flujos críticos en escritorio/móvil y auditoría axe |
| `npm run build` | Genera `_site/` con los únicos archivos que se publicarán |
| `npm audit --audit-level=high` | Rechaza dependencias con vulnerabilidades altas o críticas |

## Publicación

Los workflows de GitHub Actions validan cada cambio y publican `_site/` en GitHub Pages solo si todas las comprobaciones pasan. La activación inicial, protección de la rama y procedimiento de reversión están documentados en [docs/RELEASE.md](docs/RELEASE.md).

## Personalización y forks

- Los textos, categorías, colores y pesos se modifican en `data/questionnaire.v1.json` manteniendo identificadores estables y una nueva versión cuando cambie su significado.
- La configuración del diagnóstico rápido está en `data/reduced-survey.v1.json`.
- La matriz de interpretación se mantiene separada en `data/result-interpretations.v1.json`.
- La identidad visual se concentra en `css/` e `img/`. Un fork puede sustituirla, pero las licencias del código y contenido no conceden derechos sobre el nombre o logotipo de expliCarlos.
- Todas las rutas públicas deben seguir siendo relativas para funcionar bajo cualquier nombre de repositorio.

## Estado metodológico

La aplicación es apta para un piloto controlado. No debe presentarse como instrumento institucional validado hasta revisar pesos, bandas y recomendaciones mediante el protocolo de [calibración](docs/CALIBRATION.md).

## Licencia

El código se distribuye bajo la [GNU Affero General Public License, versión 3](LICENSE), identificador SPDX `AGPL-3.0-only`.

La licencia AGPL se aplica al software. El contenido se publica bajo CC BY-SA 4.0 y la identidad visual expliCarlos conserva los derechos que le correspondan.
