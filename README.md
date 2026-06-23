# ¿Qué herramienta utilizo?

Aplicación web estática para comparar Gemini y NotebookLM mediante un cuestionario ponderado. El objetivo es que pueda publicarse en GitHub Pages, ejecutarse localmente y personalizarse mediante forks sin depender de un backend.

## Estado

Las fases de modelo de datos, motor de cálculo y migración funcional están completas. `index.html` es la aplicación modular actual; `../eleccion_2.html` permanece como referencia histórica para las pruebas de regresión.

La aplicación permite editar pesos decimales, restaurarlos y descargar o importar dos tipos de JSON:

- Sesión completa: respuestas, categorías, pesos, versiones y resultados reproducibles.
- Configuración de pesos: ajustes compartibles sin respuestas.

Antes de aplicar una importación se muestra una vista previa. Los archivos incompatibles o mayores de 1 MB se rechazan sin modificar el estado local.

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

## Comandos previstos

Desde esta carpeta:

```powershell
python -m http.server 8000
```

Abrir después `http://localhost:8000`.

```powershell
node scripts/validate-questionnaire.mjs
node --test
```

## Decisiones pendientes

Los pesos admitirán valores decimales entre 1 y 10. JSON cubrirá tanto sesiones completas como configuraciones independientes de pesos. El proyecto mantendrá por ahora la identidad visual La Salle.

## Licencia

El código se distribuye bajo la [GNU Affero General Public License, versión 3](LICENSE), identificador SPDX `AGPL-3.0-only`.

La licencia se aplica al software. Los nombres, logotipos y demás elementos identificativos de La Salle conservan sus derechos correspondientes y no quedan relicenciados automáticamente por la AGPL.
