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
    draggingId: null,
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
    if (owner === 'player' && showPreview && cards.length){
      showCardZoom(cards[cards.length-1]);
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
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  };

  const isPlayerBoardFull = () => state.player.slots.every(Boolean);

  const updateTurnUI = () => {
    elTurnLabel.textContent = state.current === 'player' ? 'Jugador' : 'Rival';

    // resaltar objetivos válidos
    const highlight = (slotEl) => {
      const idx = Number(slotEl.dataset.idx);
      const empty = !state.player.slots[idx];
      const canDrop = state.current === 'player' && (empty || isPlayerBoardFull());
      slotEl.classList.toggle('own-target', canDrop);
    };
    playerSlots.forEach(highlight);
    enemySlots.forEach(s => s.classList.toggle('enemy-target', state.current === 'enemy' && !state.enemy.slots[Number(s.dataset.idx)]));
  };

  const showTurnBanner = (text) => {
    turnBanner.textContent = text;
    turnBanner.classList.remove('hidden');
    requestAnimationFrame(() => turnBanner.classList.add('show'));
    setTimeout(() => {
      turnBanner.classList.remove('show');
      setTimeout(() => turnBanner.classList.add('hidden'), 250);
    }, 3000);
  };

  const cardHTML = (card, {inSlot=false}={}) => {
    const cls = ['card'];
    if (inSlot) cls.push('in-slot');
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
      e.dataTransfer.setDragImage(el, el.offsetWidth/2, el.offsetHeight/2);
      highlightPlayerSlots(true);
    });
    el.addEventListener('dragend', () => {
      state.draggingId = null;
      highlightPlayerSlots(false);
    });
  };

  const highlightPlayerSlots = (on) => {
    if (!on){ playerSlots.forEach(s => s.classList.remove('own-target')); return; }
    playerSlots.forEach(s => {
      const idx = Number(s.dataset.idx);
      const empty = !state.player.slots[idx];
      if (empty || isPlayerBoardFull()) s.classList.add('own-target');
    });
  };

  // Render de slots (muestra carta adaptada al hueco)
  const renderSlots = () => {
    const renderLane = (owner, slotsEls) => {
      slotsEls.forEach((slotEl, i) => {
        const card = state[owner].slots[i];
        slotEl.innerHTML = '';
        if (card){
          const view = cardHTML(card, {inSlot:true});
          view.addEventListener('click', () => showCardZoom(card));
          slotEl.appendChild(view);
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
  const hideCardZoom = () => { cardZoom.classList.add('hidden'); };

  // Colocar carta en slot (juega y aplica efecto; si board lleno y slot ocupado, sustituye)
  const playCardIntoPlayerSlot = (slotEl, card) => {
    const slotIdx = Number(slotEl.dataset.idx);
    const targetOccupied = !!state.player.slots[slotIdx];

    if (targetOccupied && !isPlayerBoardFull()) return false; // si no está lleno, solo permitimos en hueco vacío

    // animación vuelo
    flyCardToSlot(card, slotEl);

    // sustituir o colocar
    state.player.slots[slotIdx] = card;
    renderSlots();

    // aplicar efecto de la carta
    applyCardEffect('player', card);
    if (state.player.pollution === 0) {
      endGame('win', '¡Llegaste a 0 de contaminación!');
      return true;
    }

    refreshHandUI();
    nextTurn();
    return true;
  };

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
    draw(state.current, TURN_DRAW, state.current === 'player');

    // si ambos llenos y nadie a 0, decidir por tiempo
    const full = (p) => p.slots.every(Boolean);
    if (full(state.player) && full(state.enemy)) decideByTime();

    if (state.current === 'enemy') setTimeout(enemyPlays, 700);
  };

  // Enemigo: juega en primer hueco libre; si lleno, sustituye el de menor valor (para ganar algo de IA)
  const enemyPlays = () => {
    const hand = state.enemy.hand;
    if (hand.length === 0) { nextTurn(); return; }

    // carta de mayor valor
    let bestIdx = 0;
    for (let i=1;i<hand.length;i++) if (hand[i].value > hand[bestIdx].value) bestIdx = i;
    const card = hand.splice(bestIdx,1)[0];

    let slotIdx = state.enemy.slots.findIndex(s => !s);
    if (slotIdx === -1) {
      // si lleno, sustituye el de menor valor
      let minVal = Infinity; let minIdx = 0;
      state.enemy.slots.forEach((c, i) => { if (c.value < minVal){ minVal=c.value; minIdx=i; } });
      slotIdx = minIdx;
    }

    const slotEl = enemySlots[slotIdx];
    flyEnemyCardToSlot(slotEl); // animación simple
    state.enemy.slots[slotIdx] = card;
    renderSlots();
    applyCardEffect('enemy', card);

    if (state.enemy.pollution === 0) { endGame('lose', 'El rival alcanzó 0 de contaminación.'); return; }
    nextTurn();
  };

  // Timer
  const tick = () => {
    state.timer--;
    elTimer.textContent = formatTime(state.timer);
    if (state.timer <= 0) { clearInterval(state.intervalId); decideByTime(); }
  };

  // Drag & Drop eventos para slots del jugador
  const setupSlotDnD = () => {
    playerSlots.forEach(slot => {
      slot.addEventListener('dragover', (e) => {
        if (state.current !== 'player') return;
        const idx = Number(slot.dataset.idx);
        const empty = !state.player.slots[idx];
        if (empty || isPlayerBoardFull()) e.preventDefault();
      });
      slot.addEventListener('drop', (e) => {
        if (state.current !== 'player') return;
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        // buscar carta en mano
        const i = state.player.hand.findIndex(c => c.id === id);
        if (i === -1) return;
        const card = state.player.hand.splice(i,1)[0];
        playCardIntoPlayerSlot(slot, card);
      });
    });
  };

  // Animación: vuelo desde la mano al slot
  const flyCardToSlot = (card, slotEl) => {
    const srcEl = elPlayerHand.querySelector(`[data-card-id="${card.id}"]`);
    if (!srcEl) return;
    const rectFrom = srcEl.getBoundingClientRect();
    const rectTo = slotEl.getBoundingClientRect();

    const ghost = srcEl.cloneNode(true);
    ghost.classList.add('fly');
    document.body.appendChild(ghost);

    ghost.style.left = `${rectFrom.left}px`;
    ghost.style.top = `${rectFrom.top}px`;
    ghost.style.width = `${rectFrom.width}px`;
    ghost.style.height = `${rectFrom.height}px`;
    ghost.style.transform = `translate(0,0)`;
    ghost.style.opacity = '0.95';

    requestAnimationFrame(() => {
      const dx = rectTo.left - rectFrom.left + (rectTo.width - rectFrom.width)/2;
      const dy = rectTo.top - rectFrom.top + (rectTo.height - rectFrom.height)/2;
      ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.9)`;
      ghost.style.opacity = '0.15';
      setTimeout(() => ghost.remove(), 230);
    });
  };

  // Animación simple para enemigo
  const flyEnemyCardToSlot = (slotEl) => {
    const rectTo = slotEl.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'card fly';
    ghost.style.left = `${rectTo.left + rectTo.width/2}px`;
    ghost.style.top = `-60px`;
    ghost.style.width = `120px`;
    ghost.style.height = `160px`;
    ghost.style.transform = `translate(-50%, 0)`;
    ghost.style.opacity = '0.0';
    ghost.innerHTML = `<div class="title">Acción Verde</div><div class="number">-?</div><div class="tag">Reduce</div>`;
    document.body.appendChild(ghost);
    requestAnimationFrame(() => {
      ghost.style.transform = `translate(-50%, ${rectTo.top + 40}px)`;
      ghost.style.opacity = '0.2';
      setTimeout(()=> ghost.remove(), 240);
    });
  };

  // Inicio/reinicio
  const start = () => {
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
    draw('player', START_HAND_SIZE, true);
    draw('enemy', START_HAND_SIZE, false);

    // temporizador
    elTimer.textContent = formatTime(state.timer);
    state.intervalId = setInterval(tick, 1000);

    // banner inicial
    showTurnBanner('Turno del Jugador');
  };

  restartBtn.addEventListener('click', start);

  // Preparar DnD en slots
  setupSlotDnD();

  // Inicia el juego
  start();
})();