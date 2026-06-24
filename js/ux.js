const initUX = () => {
  // --- Gestión de la Ventana Modal de Datos (Propuesta 1) ---
  const openBtn = document.getElementById('openDataDialogBtn');
  const dialog = document.getElementById('dataDialog');
  const closeBtn = document.getElementById('closeDataDialogBtn');
  const applyImportBtn = document.getElementById('applyImportBtn');

  if (openBtn && dialog) {
    openBtn.addEventListener('click', () => {
      dialog.showModal();
    });
  }
  if (closeBtn && dialog) {
    closeBtn.addEventListener('click', () => {
      dialog.close();
    });
  }
  dialog?.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.close();
    }
  });

  // Cerrar el modal al aplicar una importación
  if (applyImportBtn && dialog) {
    applyImportBtn.addEventListener('click', () => {
      dialog.close();
    });
  }

  // --- Gestión de estados "Completada" en Tarjetas de Pregunta (Propuesta 3) ---
  const surveyRoot = document.getElementById('surveyRoot');

  function updateCardCompletionStates() {
    const cards = document.querySelectorAll('.question-card');
    cards.forEach(card => {
      const geminiChecked = card.querySelector('input[data-tool="gemini"]:checked');
      const notebookChecked = card.querySelector('input[data-tool="notebook"]:checked');
      const isComplete = geminiChecked && notebookChecked;

      card.classList.toggle('is-complete', !!isComplete);

      // Gestionar indicador checkmark dinámico
      let check = card.querySelector('.completion-badge');
      if (isComplete) {
        if (!check) {
          check = document.createElement('span');
          check.className = 'completion-badge';
          check.textContent = '✓';
          // Obtener y aplicar el color dinámico de la categoría
          const categorySection = card.closest('.category-section');
          if (categorySection) {
            const catColor = categorySection.style.getPropertyValue('--cat');
            check.style.setProperty('--cat', catColor);
          }
          card.appendChild(check);
        }
      } else {
        check?.remove();
      }
    });
  }

  // Escuchar cambios en la encuesta para actualizar dinámicamente los estados de completado
  if (surveyRoot) {
    surveyRoot.addEventListener('change', () => {
      updateCardCompletionStates();
    });
  }

  // Observador para detectar cuándo el DOM cambia (inyección de tarjetas por app.js)
  const surveyObserver = new MutationObserver(() => {
    updateCardCompletionStates();
  });
  if (surveyRoot) {
    surveyObserver.observe(surveyRoot, { childList: true });
  }

  // Ejecutar inicialmente para configurar el estado actual
  updateCardCompletionStates();

};

// Asegurar ejecución segura según el estado de carga del DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUX);
} else {
  initUX();
}
