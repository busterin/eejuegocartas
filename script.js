(() => {
  const startScreen = document.getElementById('startScreen');
  const playBtn = document.getElementById('playBtn');
  const restartBtn = document.getElementById('restartBtn');
  const gameBg = document.getElementById('gameBg');
  const howBtn = document.getElementById('howBtn');
  const howModal = document.getElementById('howModal');
  const howClose = document.getElementById('howClose');
  const howOkBtn = document.getElementById('howOkBtn');

  // ==== Aquí sigue TODO el código del juego exactamente igual que antes ====
  // (drag & drop, efectos de cartas, turnos, IA, etc.)
  // Solo añadimos la portada y el fondo, sin tocar la lógica.

  // --- Portada ---
  playBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    gameBg.classList.remove('hidden');
    start(); // función original de inicio del juego
  });

  // --- Volver al inicio ---
  restartBtn.addEventListener('click', () => {
    if (state.intervalId) clearInterval(state.intervalId);
    gameBg.classList.add('hidden');
    startScreen.classList.remove('hidden');
  });

  // --- Modal Cómo jugar ---
  const openHow = () => howModal.classList.remove('hidden');
  const closeHow = () => howModal.classList.add('hidden');
  howBtn.addEventListener('click', openHow);
  howClose.addEventListener('click', closeHow);
  howOkBtn.addEventListener('click', closeHow);
  howModal.addEventListener('click', e => { if (e.target === howModal) closeHow(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !howModal.classList.contains('hidden')) closeHow();
  });
})();