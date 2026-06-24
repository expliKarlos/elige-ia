# Preparación, publicación y reversión

## Estado

El proyecto puede ejecutarse y verificarse completamente en local. La publicación permanece pendiente hasta crear o conectar el repositorio remoto y activar GitHub Pages.

## Requisitos

- Node.js 22.
- Git.
- Una cuenta con permisos de administración sobre el repositorio de GitHub.
- GitHub Pages configurado con **GitHub Actions** como origen.

## Comprobación local obligatoria

```powershell
npm ci
npm run check
npm audit --audit-level=high
npx playwright install chromium
npm run test:e2e
npm run build
```

La salida publicable queda en `_site/`. Debe contener únicamente `index.html`, `index-reducida.html`, `LICENSE` y los directorios `css`, `data`, `img` y `js`.

## Primera publicación

1. Crear el repositorio remoto sin archivos iniciales adicionales.
2. Añadirlo como `origin` y subir la rama `main`.
3. En **Settings → Pages**, seleccionar **GitHub Actions** como origen.
4. En **Settings → Branches**, proteger `main` y exigir el workflow **Calidad** antes de integrar cambios.
5. Ejecutar manualmente **Publicar GitHub Pages** o subir un cambio a `main`.
6. Verificar en la URL publicada:
   - carga de `index.html` e `index-reducida.html`;
   - ausencia de errores de consola y recursos 404;
   - finalización de ambos diagnósticos;
   - exportación JSON y vista de impresión.

## Solución de problemas

- **Los JSON no cargan en local:** utilizar un servidor HTTP; no abrir mediante `file://`.
- **Pages devuelve 404:** confirmar que el workflow terminó correctamente y que el origen es GitHub Actions.
- **Una ruta falla en un fork:** revisar que el código nuevo use rutas relativas (`./`) y que el archivo esté incluido por `scripts/build-static.mjs`.
- **Playwright no encuentra Chromium:** ejecutar `npx playwright install chromium`.

## Reversión

La publicación es un artefacto inmutable generado desde Git. Si una versión falla:

1. Detener nuevas integraciones en `main`.
2. Revertir el commit defectuoso mediante un nuevo commit, sin reescribir el historial.
3. Ejecutar `npm run check` y `npm run test:e2e`.
4. Subir el revert a `main`; el workflow publicará automáticamente la versión restaurada.
5. Verificar los dos flujos críticos en la URL pública.

## Comprobación posterior a la publicación

Durante el primer día se registrarán manualmente: errores comunicados, navegadores utilizados, fallos de importación/exportación y casos interpretativos dudosos. No se incorporará telemetría sin una decisión explícita sobre privacidad.
