(() => {
  // --------- Configuración ----------
  const START_POLLUTION = 50;
  const TURN_DRAW = 1;
  const START_HAND_SIZE = 5;
  const MATCH_TIME = 5 * 60;      // 5 minutos
  const CARD_MIN = 2, CARD_MAX = 9;
  const MAX_SLOTS = 5;

  // --------- Estado ----------
  const state = {
    player: { pollution: START_POLLUTION, hand: [], slots: [null,null,null,null,null] },
    enemy:  { pollution: START_POLLUTION, hand: [], slots: [null,null,null,null,null] },
    current: 'player',
    timer: MATCH_TIME,
    intervalId: null,
    draggingId: null,    // id carta arrastrada
  };

  // --------- DOM ----------
  const elPlayerPollution = document.getElementById('playerPollution');
  const elEnemyPollution  = document.getElementById('enemyPollution');
  const elPlayerBubble    = document.getElementById('playerBubble');
  const elEnemyBubble     = document.getElementById('enemyBubble');
  const elPlayerHand      = document.getElementById('playerHand');
  const elTurnLabel       = document.getElementById('turnLabel');
  const elTimer           = document.getElementById('timer');
  const overlay           = document.getElementById('overlay');
  const overlayTitle      = document.getElementById('overlayTitle');
  const overlaySubtitle   = document.getElementById('overlaySubtitle');
  const restartBtn        = document.getElementById('restartBtn');
  const turnBanner        = document.getElementById('turnBanner');
  const cardZoom          = document.getElementById('cardZoom');
  const zoomCard          = document.getElementById('zoomCard');

  const playerSlots = Array.from(document.querySelectorAll('.lane-player .slot'));
  const enemySlots  = Array.from(document.querySelectorAll('.lane-enemy .slot'));

  // --------- Utilidades ----------
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const makeCard = (owner) => {
    const id = `${owner}-${Math.random().toString(36).slice(2,8)}`;
    const value = randInt(CARD_MIN, CARD_MAX);
    return { id, value, label: "Acción Verde", info: "Reduce tu contaminación" };
  };

  const draw = (owner, n=1, showPreview=false) => {
    const cards = [];
    for(let i=0;i<n;i++){
      const c = makeCard(owner);
      state[owner].hand.push(c);
      cards.push(c);
    }
    // Vista previa: solo para el jugador por equilibrio
    if (owner === 'player' && showPreview && cards.length){
      showCardZoom(cards[cards.length-1]);
      // cerrar al hacer clic en cualquier lugar
      setTimeout(() => hideCardZoom(), 1100);
    }
    refreshHandUI();
  };

  const updatePollutionUI = () => {
    elPlayerPollution.textContent = state.player.pollution;
    elEnemyPollution.textContent  = state.enemy.pollution;
  };

  const pulseBubble = (owner) => {
    const el = owner === 'player' ? elPlayerBubble : elEnemyBubble;
    el.classList.remove('hit');
    // forzar reflow para reiniciar la animación
    void el.offsetWidth;
    el.classList.add('hit');
  };

  const updateTurnUI = () => {
    elTurnLabel.textContent = state.current === 'player' ? 'Jugador' : 'Rival';
    playerSlots.forEach(s => s.classList.toggle('own-target', state.current === 'player' && s.dataset.empty === 'true'));
    enemySlots.forEach(s => s.classList.toggle('enemy-target', state.current === 'enemy' && s.dataset.empty === 'true'));
  };

  const showTurnBanner = (text) => {
    turnBanner.textContent = text;
    turnBanner.classList.remove('hidden');
    requestAnimationFrame(() => {
      turnBanner.classList.add('show');
    });
    setTimeout(() => {
      turnBanner.classList.remove('show');
      setTimeout(() => turnBanner.classList.add('hidden'), 250);
    }, 3000);
  };

  const cardHTML = (card, {compact=false}={}) => {
    const cls = ['card'];
    if (compact) cls.push('compact');
    const div = document.createElement('div');
    div.className = cls.join(' ');
    div.innerHTML = `
      <div class="title">${card.label}</div>
      <div class="number">-${card.value}</div>
      <div class="tag">${card.info}</div>
    `;
    div.dataset.cardId = card.id;
    return div;
  };

  const asDraggable = (el) => {
    el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', (e) => {
      state.draggingId = el.dataset.cardId;
      e.dataTransfer.setData('text/plain', state.draggingId);
      // “carta fantasma” más pequeña
      e.dataTransfer.setDragImage(el, el.offsetWidth/2, el.offsetHeight/2);
      highlightPlayerEmptySlots(true);
    });
    el.addEventListener('dragend', () => {
      state.draggingId = null;
      highlightPlayerEmptySlots(false);
    });
  };

  const highlightPlayerEmptySlots = (on) => {
    if (!on){
      playerSlots.forEach(s => s.classList.remove('own-target'));
      return;
    }
    playerSlots.forEach(s => {
      if (s.dataset.empty === 'true') s.classList.add('own-target');
    });
  };

  // Render de slots (muestra carta compacta si hay)
  const renderSlots = () => {
    const renderLane = (owner, slotsEls) => {
      slotsEls.forEach((slotEl, i) => {
        const card = state[owner].slots[i];
        slotEl.innerHTML = '';
        if (card){
          const view = cardHTML(card, {compact:true});
          view.addEventListener('click', () => showCardZoom(card));
          slotEl.appendChild(view);
          slotEl.dataset.empty = 'false';
          slotEl.classList.remove('empty');
        } else {
          slotEl.dataset.empty = 'true';
          slotEl.classList.add('empty');
        }
      });
    };
    renderLane('enemy', enemySlots);
    renderLane('player', playerSlots);
  };

  // Mano
  const refreshHandUI = () => {
    elPlayerHand.innerHTML = '';
    state.player.hand.forEach(card => {
      const c = cardHTML(card);
      c.addEventListener('click', () => showCardZoom(card));
      asDraggable(c);
      elPlayerHand.appendChild(c);
    });
  };

  // Zoom de carta
  const showCardZoom = (card) => {
    zoomCard.innerHTML = `
      <div class="title" id="zoomTitle" style="font-weight:800">${card.label}</div>
      <div class="number" style="font-size:4rem; text-align:center; font-weight:900; margin: 18px 0">-${card.value}</div>
      <div style="text-align:center; opacity:.9; margin-bottom: 8px">${card.info}</div>
      <div style="display:flex; gap:8px; justify-content:center;">
        <button class="btn" id="zoomClose">Cerrar</button>
      </div>
    `;
    cardZoom.classList.remove('hidden');
    document.getElementById('zoomClose').onclick = hideCardZoom;
    cardZoom.onclick = (e)=>{ if (e.target === cardZoom) hideCardZoom(); };
  };
  const hideCardZoom = () => {
    cardZoom.classList.add('hidden');
  };

  // Colocar carta en slot (propietario y posición)
  const placeCardToSlot = (owner, card, idx) => {
    if (state[owner].slots[idx]) return false;
    state[owner].slots[idx] = card;
    renderSlots();
    return true;
  };

  // Efecto de carta (reduce contaminación propia)
  const applyCardEffect = (owner, card) => {
    state[owner].pollution = Math.max(0, state[owner].pollution - card.value);
    updatePollutionUI();
    pulseBubble(owner);
  };

  // Final de partida y por tiempo
  const endGame = (result, subtitle='') => {
    clearInterval(state.intervalId);
    overlay.classList.remove('hidden');
    overlayTitle.textContent =
      result === 'win'  ? '¡Victoria!' :
      result === 'lose' ? 'Derrota'   : 'Empate';
    overlaySubtitle.textContent = subtitle;
  };

  const decideByTime = () => {
    const pp = state.player.pollution;
    const ep = state.enemy.pollution;
    if (pp < ep) endGame('win', 'Ganaste por menor contaminación al agotar el tiempo.');
    else if (ep < pp) endGame('lose', 'Perdiste: el rival tenía menor contaminación al agotar el tiempo.');
    else endGame('draw', 'Empate perfecto al terminar el tiempo.');
  };

  // Turnos
  const nextTurn = () => {
    state.current = state.current === 'player' ? 'enemy' : 'player';
    updateTurnUI();
    showTurnBanner(state.current === 'player' ? 'Turno del Jugador' : 'Turno del Rival');

    // Robar al inicio del turno
    draw(state.current, TURN_DRAW, /*showPreview*/ state.current === 'player');

    // Comprobar slots completos para ambos
    const full = (p) => p.slots.filter(Boolean).length >= MAX_SLOTS;
    if (full(state.player) && full(state.enemy)) {
      // si nadie llegó a 0, decidir por tiempo
      decideByTime();
      return;
    }

    // IA simple
    if (state.current === 'enemy') {
      setTimeout(enemyPlays, 700);
    }
  };

  // Enemigo: juega en el primer hueco libre la carta que más reduce
  const enemyPlays = () => {
    const hand = state.enemy.hand;
    const freeIdx = state.enemy.slots.findIndex(s => !s);
    if (freeIdx === -1 || hand.length === 0) {
      nextTurn();
      return;
    }
    // elige carta de mayor valor
    let bestIdx = 0;
    for (let i=1;i<hand.length;i++){
      if (hand[i].value > hand[bestIdx].value) bestIdx = i;
    }
    const card = hand.splice(bestIdx,1)[0];
    placeCardToSlot('enemy', card, freeIdx);
    applyCardEffect('enemy', card);
    if (state.enemy.pollution === 0) {
      endGame('lose', 'El rival alcanzó 0 de contaminación.');
      return;
    }
    nextTurn();
  };

  // Timer
  const tick = () => {
    state.timer--;
    elTimer.textContent = formatTime(state.timer);
    if (state.timer <= 0) {
      clearInterval(state.intervalId);
      decideByTime();
    }
  };

  // Drag & Drop eventos para slots del jugador
  const setupSlotDnD = () => {
    playerSlots.forEach(slot => {
      slot.addEventListener('dragover', (e) => {
        if (state.current !== 'player') return;
        if (slot.dataset.empty === 'true') e.preventDefault();
      });
      slot.addEventListener('drop', (e) => {
        if (state.current !== 'player') return;
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        tryPlacePlayerCardTo(slot, id);
      });
      // Click en slot con carta: el renderSlots ya añade click en la carta compacta
    });
  };

  const tryPlacePlayerCardTo = (slotEl, cardId) => {
    // buscar carta en mano
    const idx = state.player.hand.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const card = state.player.hand.splice(idx,1)[0];

    // animación "vuelo" desde mano hasta slot
    flyCardToSlot(card, slotEl);

    const slotIdx = Number(slotEl.dataset.idx);
    placeCardToSlot('player', card, slotIdx);
    applyCardEffect('player', card);

    if (state.player.pollution === 0) {
      endGame('win', '¡Llegaste a 0 de contaminación!');
      return;
    }

    refreshHandUI();
    nextTurn();
  };

  const flyCardToSlot = (card, slotEl) => {
    // crear clon visual desde la mano
    const srcEl = elPlayerHand.querySelector(`[data-card-id="${card.id}"]`);
    if (!srcEl) return;
    const rectFrom = srcEl.getBoundingClientRect();
    const rectTo = slotEl.getBoundingClientRect();

    const ghost = srcEl.cloneNode(true);
    ghost.classList.add('fly');
    document.body.appendChild(ghost);

    // posición inicial
    ghost.style.left = `${rectFrom.left}px`;
    ghost.style.top = `${rectFrom.top}px`;
    ghost.style.width = `${rectFrom.width}px`;
    ghost.style.height = `${rectFrom.height}px`;
    ghost.style.transform = `translate(0,0)`;
    ghost.style.opacity = '0.95';

    // siguiente frame -> mover
    requestAnimationFrame(() => {
      const dx = rectTo.left - rectFrom.left + (rectTo.width - rectFrom.width)/2;
      const dy = rectTo.top - rectFrom.top + (rectTo.height - rectFrom.height)/2;
      ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.9)`;
      ghost.style.opacity = '0.15';
      setTimeout(() => ghost.remove(), 230);
    });
  };

  // Inicio/reinicio
  const start = () => {
    // reset
    Object.assign(state.player, { pollution: START_POLLUTION, hand: [], slots: [null,null,null,null,null] });
    Object.assign(state.enemy,  { pollution: START_POLLUTION, hand: [], slots: [null,null,null,null,null] });
    state.current = 'player';
    state.timer = MATCH_TIME;
    clearInterval(state.intervalId);

    overlay.classList.add('hidden');
    updatePollutionUI();
    renderSlots();
    refreshHandUI();
    updateTurnUI();

    // robar inicial
    draw('player', START_HAND_SIZE, /*preview*/ true);
    draw('enemy', START_HAND_SIZE, /*preview*/ false);

    // temporizador
    elTimer.textContent = formatTime(state.timer);
    state.intervalId = setInterval(tick, 1000);

    // turn banner inicial
    showTurnBanner('Turno del Jugador');
  };

  restartBtn.addEventListener('click', start);

  // Preparar DnD en slots
  setupSlotDnD();

  // Inicia el juego
  start();
})();