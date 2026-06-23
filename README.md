# ¿Qué herramienta utilizo?

Aplicación web estática para comparar Gemini y NotebookLM mediante un cuestionario ponderado. El objetivo es que pueda publicarse en GitHub Pages, ejecutarse localmente y personalizarse mediante forks sin depender de un backend.

## Estado

El proyecto está en fase de especificación y planificación. La referencia funcional actual permanece fuera de esta carpeta en `../eleccion_2.html` y no se modificará durante la modularización inicial.

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

Cuando se complete la primera implementación:

```powershell
node scripts/validate-questionnaire.mjs
node --test
```

## Decisiones pendientes

Los pesos admitirán valores decimales entre 1 y 10. JSON cubrirá tanto sesiones completas como configuraciones independientes de pesos. La licencia y la política de marca se resolverán antes de la publicación pública.
