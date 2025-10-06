(() => {
  // --------- Configuración básica ----------
  const START_POLLUTION = 50;           // Contaminación inicial
  const TURN_DRAW = 1;                  // Robas 1 carta al inicio de tu turno
  const START_HAND_SIZE = 5;            // Mano inicial
  const TURN_TIME_TOTAL = 5 * 60;       // 5 minutos en segundos
  const CARD_MIN = 2, CARD_MAX = 9;     // Rango del valor de cartas (resta contaminación propia)
  const MAX_SLOTS = 5;

  // --------- Estado de juego ----------
  const state = {
    player: {
      pollution: START_POLLUTION,
      hand: [],
      slotsUsed: 0
    },
    enemy: {
      pollution: START_POLLUTION,
      hand: [],
      slotsUsed: 0
    },
    current: 'player', // 'player' | 'enemy'
    timer: TURN_TIME_TOTAL,
    intervalId: null,
    selectedCardId: null
  };

  // --------- Referencias DOM ----------
  const elPlayerPollution = document.getElementById('playerPollution');
  const elEnemyPollution  = document.getElementById('enemyPollution');
  const elPlayerHand      = document.getElementById('playerHand');
  const elTurnLabel       = document.getElementById('turnLabel');
  const elTimer           = document.getElementById('timer');
  const overlay           = document.getElementById('overlay');
  const overlayTitle      = document.getElementById('overlayTitle');
  const overlaySubtitle   = document.getElementById('overlaySubtitle');
  const restartBtn        = document.getElementById('restartBtn');

  // Slots
  const playerSlots = Array.from(document.querySelectorAll('.lane-player .slot'));
  const enemySlots  = Array.from(document.querySelectorAll('.lane-enemy .slot'));

  // --------- Utilidades ----------
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const makeCard = (owner) => {
    const id = `${owner}-${Math.random().toString(36).slice(2,8)}`;
    return {
      id,
      value: randInt(CARD_MIN, CARD_MAX),
      label: "Acción Verde",
      info: "Reduce tu contaminación"
    };
  };

  const draw = (owner, n=1) => {
    for(let i=0;i<n;i++){
      state[owner].hand.push(makeCard(owner));
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s/60);
    const r = s % 60;
    const mm = m < 10 ? `0${m}` : `${m}`;
    const rr = r < 10 ? `0${r}` : `${r}`;
    return `${mm}:${rr}`;
  };

  const updatePollutionUI = () => {
    elPlayerPollution.textContent = state.player.pollution;
    elEnemyPollution.textContent = state.enemy.pollution;
  };

  const updateTurnUI = () => {
    elTurnLabel.textContent = state.current === 'player' ? 'Jugador' : 'Rival';
    // Target highlights
    playerSlots.forEach(s => s.classList.toggle('own-target', state.current === 'player'));
    enemySlots.forEach(s => s.classList.toggle('enemy-target', state.current === 'enemy'));
  };

  const refreshHandUI = () => {
    elPlayerHand.innerHTML = '';
    state.player.hand.forEach(card => {
      const c = document.createElement('div');
      c.className = 'card';
      c.dataset.cardId = card.id;
      c.innerHTML = `
        <div class="title">${card.label}</div>
        <div class="number">-${card.value}</div>
        <div class="tag">${card.info}</div>
      `;
      c.addEventListener('click', () => onSelectCard(card.id));
      if (state.selectedCardId === card.id) c.classList.add('selected');
      elPlayerHand.appendChild(c);
    });
  };

  const resetSlotsUI = () => {
    [...playerSlots, ...enemySlots].forEach(s => {
      s.innerHTML = '';
      s.classList.add('empty');
    });
  };

  const renderSlots = () => {
    // show simple tokens for used slots
    playerSlots.forEach((slot, idx) => {
      slot.classList.toggle('empty', idx >= state.player.slotsUsed);
      if (idx < state.player.slotsUsed) slot.innerHTML = chipHTML('Tú');
    });
    enemySlots.forEach((slot, idx) => {
      slot.classList.toggle('empty', idx >= state.enemy.slotsUsed);
      if (idx < state.enemy.slotsUsed) slot.innerHTML = chipHTML('Rival');
    });
  };

  const chipHTML = (who) => `
    <div style="display:grid;place-items:center;gap:6px">
      <div style="
        width:44px;height:44px;border-radius:12px;
        background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02));
        border:2px solid rgba(255,255,255,.14);
        box-shadow:${'0 8px 18px rgba(0,0,0,.35)'};
      "></div>
      <div style="font-size:.8rem;opacity:.8">${who}</div>
    </div>
  `;

  // --------- Flujo de partida ----------
  const start = () => {
    // Estado inicial
    state.player.pollution = START_POLLUTION;
    state.enemy.pollution  = START_POLLUTION;
    state.player.hand = [];
    state.enemy.hand  = [];
    state.player.slotsUsed = 0;
    state.enemy.slotsUsed  = 0;
    state.current = 'player';
    state.selectedCardId = null;
    state.timer = TURN_TIME_TOTAL;
    clearInterval(state.intervalId);

    // UI
    updatePollutionUI();
    updateTurnUI();
    resetSlotsUI();
    renderSlots();
    overlay.classList.add('hidden');
    overlayTitle.textContent = '';
    overlaySubtitle.textContent = '';
    document.body.focus();

    // Robar cartas iniciales
    draw('player', START_HAND_SIZE);
    draw('enemy', START_HAND_SIZE);
    refreshHandUI();

    // Iniciar temporizador
    elTimer.textContent = formatTime(state.timer);
    state.intervalId = setInterval(tick, 1000);

    // Activar clicks en slots del jugador
    playerSlots.forEach(slot => {
      slot.addEventListener('click', () => onClickPlayerSlot(slot));
    });
  };

  const tick = () => {
    state.timer--;
    elTimer.textContent = formatTime(state.timer);
    if (state.timer <= 0) {
      clearInterval(state.intervalId);
      decideByTime();
    }
  };

  const decideByTime = () => {
    const pp = state.player.pollution;
    const ep = state.enemy.pollution;
    if (pp < ep) endGame('win', 'Ganaste por menor contaminación al agotar el tiempo.');
    else if (ep < pp) endGame('lose', 'Perdiste: el rival tenía menor contaminación al agotar el tiempo.');
    else endGame('draw', 'Empate perfecto: misma contaminación al terminar el tiempo.');
  };

  const endGame = (result, subtitle='') => {
    clearInterval(state.intervalId);
    overlay.classList.remove('hidden');
    overlayTitle.textContent =
      result === 'win'  ? '¡Victoria!' :
      result === 'lose' ? 'Derrota'   : 'Empate';
    overlaySubtitle.textContent = subtitle;
  };

  const onSelectCard = (cardId) => {
    if (state.current !== 'player') return;
    state.selectedCardId = cardId;
    refreshHandUI();
  };

  const onClickPlayerSlot = (slotEl) => {
    if (state.current !== 'player') return;
    if (!slotEl.classList.contains('empty')) return; // ya ocupado
    if (state.player.slotsUsed >= MAX_SLOTS) return;
    if (!state.selectedCardId) return;

    // Jugar la carta seleccionada
    playCard('player', state.selectedCardId);
  };

  const playCard = (owner, cardId) => {
    const hand = state[owner].hand;
    const idx = hand.findIndex(c => c.id === cardId);
    if (idx === -1) return;

    const card = hand.splice(idx, 1)[0];

    // Efecto: Reduce la contaminación PROPIA del que juega
    state[owner].pollution = Math.max(0, state[owner].pollution - card.value);
    updatePollutionUI();

    // Ocupa un hueco
    state[owner].slotsUsed = Math.min(MAX_SLOTS, state[owner].slotsUsed + 1);
    renderSlots();

    // ¿Victoria instantánea?
    if (state[owner].pollution === 0) {
      endGame(owner === 'player' ? 'win' : 'lose', '¡Llegaste a 0 de contaminación!');
      return;
    }

    // Siguiente turno
    nextTurn();
  };

  const nextTurn = () => {
    // Cambia turno
    state.current = state.current === 'player' ? 'enemy' : 'player';
    state.selectedCardId = null;
    updateTurnUI();
    refreshHandUI();

    const who = state.current;

    // Robar al inicio del turno
    draw(who, TURN_DRAW);
    if (who === 'player') {
      refreshHandUI();
      // Si ya no quedan huecos para nadie y no se llegó a 0 -> decidir por menor contaminación
      if (state.player.slotsUsed >= MAX_SLOTS && state.enemy.slotsUsed >= MAX_SLOTS) decideByTime();
    } else {
      // Turno del enemigo (IA simple)
      setTimeout(enemyPlays, 650);
    }
  };

  const enemyPlays = () => {
    // Si no puede jugar porque no hay huecos, pasa turno
    if (state.enemy.slotsUsed >= MAX_SLOTS || state.enemy.hand.length === 0) {
      nextTurn();
      return;
    }

    // Elige una carta aleatoria
    const i = randInt(0, state.enemy.hand.length - 1);
    const card = state.enemy.hand[i];

    // Juega
    playCard('enemy', card.id);
  };

  restartBtn.addEventListener('click', start);

  // Inicia el juego
  start();
})();
