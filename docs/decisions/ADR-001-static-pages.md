# ADR-001: Aplicación estática y despliegue en GitHub Pages

## Estado

Aceptada — 2026-06-24.

## Contexto

La aplicación debe poder ejecutarse localmente, publicarse con coste operativo mínimo y reutilizarse mediante forks. Las respuestas no requieren sincronización, cuentas ni almacenamiento centralizado.

## Decisión

Mantener HTML, CSS, JavaScript y JSON estáticos, sin backend ni dependencias de ejecución. GitHub Actions valida y empaqueta los archivos públicos; GitHub Pages sirve el artefacto `_site/`.

Las herramientas de desarrollo —Playwright y axe— son dependencias exclusivas de calidad y no llegan al navegador del usuario.

## Alternativas consideradas

### Backend con base de datos

Permitiría analítica y sincronización, pero aumentaría riesgos de privacidad, coste y mantenimiento. Se descarta mientras no exista una necesidad institucional explícita.

### Framework frontend con compilación obligatoria

Facilitaría componentes y estado complejo, pero reduciría la portabilidad del fork y no aporta suficiente valor para el alcance actual.

### Publicación manual de archivos

Es sencilla, pero permite desplegar versiones sin pruebas y dificulta la reproducción. Se sustituye por un workflow con puertas de calidad.

## Consecuencias

- Las respuestas permanecen en el navegador o en archivos descargados por el usuario.
- No existe observabilidad central ni recuperación remota de sesiones.
- Cada cambio de producción debe pasar validación, pruebas unitarias, E2E, accesibilidad y auditoría de dependencias.
- La reversión se realiza mediante un commit de revert y una nueva publicación automática.
