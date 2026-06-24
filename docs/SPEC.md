# Especificación: aplicación estática modular para GitHub Pages

## Objetivo

Transformar la encuesta autocontenida de `eleccion_2.html` en una aplicación web estática, modular y versionable que:

- se publique directamente en GitHub Pages;
- se ejecute localmente mediante un servidor HTTP sencillo;
- pueda personalizarse mediante forks;
- permita cambiar pesos de categorías y criterios;
- importe y exporte sesiones reproducibles;
- no requiera backend, registro ni envío de respuestas a terceros.

El usuario principal es una persona o institución que necesita determinar qué herramienta encaja mejor con su propósito y conservar o compartir el resultado bajo su propio control.

## Alcance inicial

### Incluido

- Funcionalidad actual de `eleccion_2.html` sin regresiones.
- Cuestionario y pesos predeterminados en JSON externo y versionado.
- Edición local de pesos con restauración de valores predeterminados.
- Persistencia local de respuestas y configuración.
- Exportación e importación JSON.
- Exportación independiente de la configuración de pesos.
- Resultado global y resultado por categoría normalizados a 100.
- Diagnóstico rápido independiente, ponderado por categorías y con controles críticos de seguridad.
- Validación de archivos importados.
- Compatibilidad con rutas relativas de GitHub Pages.
- Pruebas del motor de cálculo, validación y flujos principales.

### Fuera de alcance

- Backend, base de datos o sincronización remota.
- Autenticación y cuentas de usuario.
- Almacenamiento centralizado de resultados.
- Edición colaborativa en tiempo real.
- Analítica institucional agregada.

## Stack técnico

- HTML5, CSS y JavaScript moderno mediante módulos ES.
- JSON como modelo de datos canónico.
- SVG generado en cliente para los gráficos.
- `localStorage` para continuidad local no sensible.
- Pruebas unitarias con `node:test`, sin dependencias obligatorias.
- Pruebas de navegador para los flujos críticos.
- GitHub Actions solo para validación, pruebas y publicación.

No se introducirá un framework ni una dependencia en tiempo de ejecución sin aprobación.

## Comandos

```powershell
# Desarrollo local
python -m http.server 8000

# Validación de datos
node scripts/validate-questionnaire.mjs

# Pruebas unitarias
node --test
```

No existirá un paso de compilación obligatorio en la primera versión.

## Estructura prevista

```text
index.html                   Entrada de la aplicación
css/app.css                  Identidad visual y responsive
js/app.js                    Orquestación e interfaz
js/scoring.js                Motor puro de cálculo
js/storage.js                Persistencia local
js/import-export.js          Importación y exportación JSON
js/validation.js             Validación y migración
data/questionnaire.v1.json   Preguntas y pesos predeterminados
data/result-interpretations.v1.json  Matriz versionada de interpretación
schemas/                     Contratos documentados de intercambio
scripts/                     Validadores ejecutables
tests/                       Pruebas unitarias y de integración
docs/                        Especificaciones y decisiones
```

## Contrato de datos

Cada categoría y criterio tendrá un identificador estable. Los textos visibles no se utilizarán como claves.

```json
{
  "schemaVersion": "1.0",
  "questionnaireId": "gemini-vs-notebooklm",
  "questionnaireVersion": "1.1.0",
  "categories": [
    {
      "id": "pedagogical-purpose",
      "label": "Finalidad pedagógica",
      "color": "#FF375F",
      "defaultWeight": 1,
      "criteria": [
        {
          "id": "open-creativity",
          "label": "Creatividad abierta",
          "description": "...",
          "defaultWeights": {
            "gemini": 7,
            "notebooklm": 3
          }
        }
      ]
    }
  ]
}
```

Una exportación de sesión incluirá como mínimo:

```json
{
  "formatVersion": "1.0",
  "questionnaireId": "gemini-vs-notebooklm",
  "questionnaireVersion": "1.1.0",
  "exportedAt": "2026-06-23T18:30:00Z",
  "weights": {},
  "answers": {},
  "results": {}
}
```

La exportación guardará una instantánea de los pesos utilizados. Así, un resultado seguirá siendo reproducible aunque cambien los valores predeterminados en versiones posteriores.

La configuración de pesos también podrá descargarse como un JSON independiente, sin respuestas ni resultados, para compartir ajustes entre forks o instalaciones.

## Reglas de cálculo

- La escala de respuesta continuará siendo 1–4.
- Cada respuesta se multiplicará por el peso efectivo del criterio.
- El peso efectivo podrá diferir entre Gemini y NotebookLM.
- Los pesos aceptarán valores decimales entre 1 y 10, ambos incluidos.
- El peso de categoría se aplicará al resultado global.
- Cada puntuación se normalizará sobre su máximo posible y se expresará entre 0 y 100.
- Los cálculos globales y parciales utilizarán una única implementación del motor.
- Los datos incompletos no producirán un resultado definitivo sin advertencia explícita.
- Con la escala 1–4, una sesión completa produce una puntuación bruta entre 25 y 100.
- La puntuación publicada se reescalará mediante `(puntuación bruta - 25) / 75 × 100` para ocupar el intervalo real 0–100.
- La interpretación combinará nivel absoluto, perfil conjunto y diferencia, en ese orden.
- Las contraindicaciones de privacidad y no uso prevalecerán sobre las puntuaciones globales y no podrán compensarse mediante una media.
- Excluir una categoría que contenga controles de riesgo conservará la comparación, pero condicionará cualquier decisión de adopción hasta completar esos controles.
- El evaluador interpretativo aplicará polaridad y severidad por criterio antes de emitir recomendaciones.
- La puntuación bruta se conservará en resultados exportados para permitir auditoría, pero las bandas y recomendaciones utilizarán exclusivamente la puntuación reescalada.

## Estilo de código

- Módulos pequeños con una responsabilidad principal.
- Funciones puras para cálculo, validación y serialización.
- Nombres técnicos en inglés y contenido visible en español.
- Punto y coma y comillas dobles, siguiendo el código actual.
- Sin acceso directo al DOM desde el motor de cálculo.

```javascript
export function scoreTo100(value, maximum) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) {
    return 0;
  }

  const rawScore = (value / maximum) * 100;
  const normalizedScore = ((rawScore - 25) / 75) * 100;
  return Math.round(Math.min(Math.max(normalizedScore, 0), 100) * 10) / 10;
}
```

## Estrategia de pruebas

- Unitarias: normalización, ponderación, validación y serialización JSON.
- Integración: carga del cuestionario y restauración de una sesión.
- Navegador: Playwright verifica reinicio, diagnóstico reducido y bloqueos en escritorio y móvil.
- Regresión: misma entrada y pesos que `eleccion_2.html` deben producir el mismo resultado.
- Accesibilidad: auditoría axe sin infracciones graves o críticas en las entradas principales, además de navegación por teclado, nombres accesibles y cierre de diálogos.

## Límites operativos

### Hacer siempre

- Validar datos externos antes de utilizarlos.
- Mantener identificadores y versiones estables.
- Usar rutas relativas.
- Ejecutar validación y pruebas antes de publicar.
- Mantener las respuestas dentro del dispositivo salvo descarga iniciada por el usuario.

### Consultar antes

- Añadir frameworks o dependencias de producción.
- Cambiar la escala de respuesta o la fórmula de cálculo.
- Cambiar límites permitidos para los pesos.
- Incorporar telemetría, servicios externos o almacenamiento remoto.
- Cambiar la licencia GNU AGPLv3 adoptada para el proyecto.
- Retirar o sustituir la identidad visual expliCarlos.

### No hacer

- Incluir secretos o datos personales en el repositorio.
- Importar archivos sin validación.
- Depender de rutas absolutas asociadas al nombre del repositorio.
- Modificar silenciosamente el significado de una versión publicada.

## Criterios de éxito

- Publicación funcional desde cualquier fork de GitHub Pages.
- Funcionamiento local mediante `python -m http.server 8000`.
- La aplicación carga preguntas y pesos desde JSON externo.
- Los pesos de categoría y criterio pueden editarse y restaurarse.
- Una sesión exportada puede importarse y reproduce las mismas puntuaciones.
- Las sesiones y configuraciones de pesos se descargan como JSON sin enviar datos a servidores.
- El motor reproduce los resultados de la versión standalone.
- Las pruebas automatizadas y la validación de datos pasan sin errores.

## Decisiones aprobadas

- Pesos de criterio: números decimales entre 1 y 10, ambos incluidos.
- Intercambio: exclusivamente JSON; XML queda fuera de alcance.
- Exportaciones: sesión completa y configuración de pesos por separado.
- Marca: la implementación utilizará la identidad visual expliCarlos.
- Licencia del código: GNU Affero General Public License, versión 3 (`AGPL-3.0-only`).
- Licencia del contenido: Creative Commons Atribución-CompartirIgual 4.0 Internacional (`CC BY-SA 4.0`).

Las licencias del código y del contenido no conceden por sí mismas derechos sobre el nombre, el logotipo ni otros signos identificativos de expliCarlos.
