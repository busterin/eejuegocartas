(() => {
  // --------- Configuración ----------
  const START_POLLUTION = 50;
  const TURN_DRAW = 1;
  const START_HAND_SIZE = 5;
  const MATCH_TIME = 5 * 60; // 5 minutos
  const CARD_MIN = 2, CARD_MAX = 9;
  const SLOTS = 5;

  // --------- Estado ----------
  const state = {
    player: { pollution: START_POLLUTION, hand: [], slots: Array(SLOTS).fill(null) },
    enemy:  { pollution: START_POLLUTION, hand: [], slots: Array(SLOTS).fill(null) },
    current: 'player',
    timer: MATCH_TIME,
    intervalId: null
  };

  // --------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const elPlayerPollution = $('playerPollution');
  const elEnemyPollution  = $('enemyPollution');
  const elPlayerBubble    = $('playerBubble');
  const elEnemyBubble     = $('enemyBubble');
  const elPlayerHand      = $('playerHand');
  const elTurnLabel       = $('turnLabel');
  const elTimer           = $('timer');
  const overlay           = $('overlay');
  const overlayTitle      = $('overlayTitle');
  const overlaySubtitle   = $('overlaySubtitle');
  const restartBtn        = $('restartBtn');
  const turnBanner        = $('turnBanner');
  const cardZoom          = $('cardZoom');
  const zoomCard          = $('zoomCard');
  const playerSlots = Array.from(document.querySelectorAll('.lane-player .slot'));
  const enemySlots  = Array.from(document.querySelectorAll('.lane-enemy .slot'));

  // --------- Utilidades ----------
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const makeCard = (owner, image = null) => {
    const id = `${owner}-${Math.random().toString(36).slice(2,8)}`;
    const value = randInt(CARD_MIN, CARD_MAX);
    return { id, value, label: "Acción Verde", info: "Reduce tu contaminación", image };
  };

  // Robar cartas; si es arranque, la primera del jugador lleva imagen
  const draw = (owner, n=1, showPreview=false) => {
    for (let i=0;i<n;i++){
      const shouldHaveImage = owner === 'player' && state.player.hand.length === 0 && state.player.slots.every(v=>v===null);
      const img = shouldHaveImage ? 'assets/Carta1.png' : null;
      state[owner].hand.push(makeCard(owner, img));
    }
    if (owner === 'player' && showPreview && state.player.hand.length){
      showCardZoom(state.player.hand[state.player.hand.length-1]);
      setTimeout(hideCardZoom, 1100);
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

  const showTurnBanner = (text) => {
    turnBanner.textContent = text;
    turnBanner.classList.remove('hidden');
    requestAnimationFrame(() => turnBanner.classList.add('show'));
    setTimeout(() => {
      turnBanner.classList.remove('show');
      setTimeout(() => turnBanner.classList.add('hidden'), 250);
    }, 3000);
  };

  // --------- Render cartas ----------
  const cardHTML = (card, {inSlot=false}={}) => {
    const div = document.createElement('div');
    div.className = 'card' + (inSlot ? ' in-slot' : '');
    div.dataset.cardId = card.id;
    div.innerHTML = `
      <div class="title">${card.label}</div>
      ${card.image ? `<img class="media" src="${card.image}" alt="${card.label}">` : ''}
      <div class="number">-${card.value}</div>
      <div class="tag">${card.info}</div>
    `;
    return div;
  };

  const asDraggable = (el) => {
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', el.dataset.cardId);
      e.dataTransfer.setDragImage(el, el.offsetWidth/2, el.offsetHeight/2);
      playerSlots.forEach(s => s.classList.add('own-target'));
    });
    el.addEventListener('dragend', () => {
      playerSlots.forEach(s => s.classList.remove('own-target'));
    });
  };

  const renderSlots = () => {
    const renderLane = (owner, slotsEls) => {
      slotsEls.forEach((slotEl, i) => {
        slotEl.innerHTML = '';
        const card = state[owner].slots[i];
        if (card){
          const el = cardHTML(card, {inSlot:true});
          el.addEventListener('click', () => showCardZoom(card));
          slotEl.appendChild(el);
        }
      });
    };
    renderLane('enemy', enemySlots);
    renderLane('player', playerSlots);
  };

  const refreshHandUI = () => {
    elPlayerHand.innerHTML = '';
    state.player.hand.forEach(card => {
      const c = cardHTML(card);
      c.addEventListener('click', () => showCardZoom(card));
      asDraggable(c);
      elPlayerHand.appendChild(c);
    });
  };

  // --------- Zoom ----------
  const showCardZoom = (card) => {
    zoomCard.innerHTML = `
      <div class="title" style="font-weight:800">${card.label}</div>
      ${card.image ? `<img class="media" src="${card.image}" alt="${card.label}" style="height:55%;object-fit:cover;">` : ''}
      <div class="number" style="font-size:4rem;text-align:center;font-weight:900;">-${card.value}</div>
      <div style="text-align:center;opacity:.9;margin-bottom:8px">${card.info}</div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="btn" id="zoomClose">Cerrar</button>
      </div>`;
    cardZoom.classList.remove('hidden');
    $('zoomClose').onclick = hideCardZoom;
    cardZoom.onclick = (e)=>{ if (e.target === cardZoom) hideCardZoom(); };
  };
  const hideCardZoom = () => cardZoom.classList.add('hidden');

  // --------- Juego de cartas ----------
  const flashSlot = (slotEl) => {
    slotEl.classList.remove('flash'); void slotEl.offsetWidth; slotEl.classList.add('flash');
  };

  const applyCardEffect = (owner, card) => {
    state[owner].pollution = Math.max(0, state[owner].pollution - card.value);
    updatePollutionUI();
    pulseBubble(owner);
  };

  const playCardIntoPlayerSlot = (slotEl, card) => {
    const idx = Number(slotEl.dataset.idx);

    // animación de vuelo
    flyCardFromHandTo(slotEl, card.id);

    // sustituye o coloca
    state.player.slots[idx] = card;
    flashSlot(slotEl);
    renderSlots();

    applyCardEffect('player', card);
    if (state.player.pollution === 0) return endGame('win','¡Llegaste a 0 de contaminación!');

    refreshHandUI();
    nextTurn();
  };

  // --------- Turnos y fin ----------
  const nextTurn = () => {
    state.current = state.current === 'player' ? 'enemy' : 'player';
    elTurnLabel.textContent = state.current === 'player' ? 'Jugador' : 'Rival';
    showTurnBanner(state.current === 'player' ? 'Turno del Jugador' : 'Turno del Rival');

    draw(state.current, TURN_DRAW, state.current === 'player');

    if (state.current === 'enemy') setTimeout(enemyPlays, 700);
  };

  const enemyPlays = () => {
    const h = state.enemy.hand;
    if (!h.length) return nextTurn();

    // juega la carta de mayor valor
    let best = 0;
    for (let i=1;i<h.length;i++) if (h[i].value > h[best].value) best = i;
    const card = h.splice(best,1)[0];

    // primer hueco libre o sustituir el de menor valor
    let idx = state.enemy.slots.findIndex(s => !s);
    if (idx === -1) {
      let minVal = Infinity, minIdx = 0;
      state.enemy.slots.forEach((c,i)=>{ if(c.value<minVal){minVal=c.value;minIdx=i;} });
      idx = minIdx;
    }

    state.enemy.slots[idx] = card;
    flashSlot(enemySlots[idx]);
    renderSlots();
    applyCardEffect('enemy', card);

    if (state.enemy.pollution === 0) return endGame('lose','El rival llegó a 0.');
    nextTurn();
  };

  const endGame = (result, subtitle='') => {
    clearInterval(state.intervalId);
    overlay.classList.remove('hidden');
    overlayTitle.textContent = result === 'win' ? '¡Victoria!' :
                               result === 'lose' ? 'Derrota' : 'Empate';
    overlaySubtitle.textContent = subtitle;
  };

  const decideByTime = () => {
    const { player, enemy } = state;
    if (player.pollution < enemy.pollution) endGame('win','Ganaste por menor contaminación.');
    else if (enemy.pollution < player.pollution) endGame('lose','El rival tenía menos contaminación.');
    else endGame('draw','Empate al agotar el tiempo.');
  };

  const tick = () => {
    state.timer--;
    elTimer.textContent = formatTime(state.timer);
    if (state.timer <= 0) {
      clearInterval(state.intervalId);
      decideByTime();
    }
  };

  // --------- DnD ----------
  const setupDnD = () => {
    playerSlots.forEach(slot=>{
      slot.addEventListener('dragover',e=>{
        if(state.current==='player') e.preventDefault(); // permitir drop siempre (para sustituir)
      });
      slot.addEventListener('drop',e=>{
        if(state.current!=='player') return;
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        const i = state.player.hand.findIndex(c=>c.id===id);
        if(i===-1) return;
        const card = state.player.hand.splice(i,1)[0];
        playCardIntoPlayerSlot(slot, card);
      });
    });
  };

  // --------- Animaciones ----------
  const flyCardFromHandTo = (slotEl, cardId) => {
    const srcEl = elPlayerHand.querySelector(`[data-card-id="${cardId}"]`);
    if (!srcEl) return;
    const a = srcEl.getBoundingClientRect();
    const b = slotEl.getBoundingClientRect();

    const ghost = srcEl.cloneNode(true);
    ghost.classList.add('fly');
    document.body.appendChild(ghost);
    ghost.style.left = `${a.left}px`;  ghost.style.top = `${a.top}px`;
    ghost.style.width = `${a.width}px`; ghost.style.height = `${a.height}px`;
    ghost.style.transform = `translate(0,0)`; ghost.style.opacity = '0.95';

    requestAnimationFrame(()=>{
      const dx = b.left - a.left + (b.width - a.width)/2;
      const dy = b.top  - a.top  + (b.height - a.height)/2;
      ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.9)`;
      ghost.style.opacity = '0.15';
      setTimeout(()=> ghost.remove(), 230);
    });
  };

  // --------- Inicio ----------
  const start = () => {
    Object.assign(state.player,{pollution:START_POLLUTION,hand:[],slots:Array(SLOTS).fill(null)});
    Object.assign(state.enemy ,{pollution:START_POLLUTION,hand:[],slots:Array(SLOTS).fill(null)});
    state.current='player'; state.timer=MATCH_TIME;
    clearInterval(state.intervalId);
    overlay.classList.add('hidden');

    updatePollutionUI(); renderSlots(); refreshHandUI();

    // mano inicial (primera carta del jugador con imagen)
    draw('player', START_HAND_SIZE, true);
    draw('enemy',  START_HAND_SIZE, false);

    elTimer.textContent = formatTime(state.timer);
    state.intervalId = setInterval(tick, 1000);
    showTurnBanner('Turno del Jugador');
  };

  restartBtn.addEventListener('click', start);
  setupDnD();
  start();
})();