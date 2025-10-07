(() => {
  // --------- Configuración ----------
  const START_POLLUTION = 50;
  const TURN_DRAW = 1;
  const START_HAND_SIZE = 5;
  const MATCH_TIME = 5 * 60; // 5 minutos
  const SLOTS = 5;

  // --------- Mazo base con imágenes ---------
  const baseDeck = [
    { label: "Acción Verde", info: "Reduce la contaminación", value: 2, image: "assets/Carta1.png" },
    { label: "Reciclaje", info: "Recoge residuos y reduce el impacto", value: 3, image: "assets/Carta2.png" },
    { label: "Energía Solar", info: "Paneles solares instalados", value: 4, image: "assets/Carta3.png" },
    { label: "Reforestación", info: "Plantas nuevos bosques", value: 5, image: "assets/Carta4.png" },
    { label: "Transporte Limpio", info: "Usa movilidad eléctrica", value: 6, image: "assets/Carta5.png" },
    { label: "Agua Pura", info: "Purificación y control de vertidos", value: 3, image: "assets/Carta6.png" },
    { label: "Protección Animal", info: "Cuidado de la fauna silvestre", value: 4, image: "assets/Carta7.png" },
    { label: "Agricultura Sostenible", info: "Reduce pesticidas", value: 5, image: "assets/Carta8.png" },
    { label: "Educación Ambiental", info: "Campañas de concienciación", value: 2, image: "assets/Carta9.png" },
    { label: "Energía Eólica", info: "Molinos de viento eficientes", value: 6, image: "assets/Carta10.png" },
  ];

  // --------- Estado ----------
  const state = {
    player: { pollution: START_POLLUTION, hand: [], slots: Array(SLOTS).fill(null) },
    enemy:  { pollution: START_POLLUTION, hand: [], slots: Array(SLOTS).fill(null) },
    current: 'player',
    timer: MATCH_TIME,
    intervalId: null
  };

  // --------- DOM ----------
  const $ = id => document.getElementById(id);
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
  const randInt = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const timeFmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const randFromDeck = () => {
    const c = structuredClone(baseDeck[randInt(0, baseDeck.length-1)]);
    c.id = `c-${Math.random().toString(36).slice(2,8)}`;
    return c;
  };

  // --------- Robar cartas ---------
  const draw = (owner, n=1, preview=false) => {
    for (let i=0;i<n;i++) state[owner].hand.push(randFromDeck());
    if (owner==='player' && preview && state.player.hand.length){
      showCardZoom(state.player.hand[state.player.hand.length-1]);
      setTimeout(hideCardZoom, 1100);
    }
    refreshHandUI();
  };

  const updatePollutionUI = () => {
    elPlayerPollution.textContent = state.player.pollution;
    elEnemyPollution.textContent  = state.enemy.pollution;
  };
  const pulse = who => {
    const el = who==='player'?elPlayerBubble:elEnemyBubble;
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  };
  const banner = txt => {
    turnBanner.textContent = txt;
    turnBanner.classList.remove('hidden');
    requestAnimationFrame(()=>turnBanner.classList.add('show'));
    setTimeout(()=>{turnBanner.classList.remove('show');setTimeout(()=>turnBanner.classList.add('hidden'),250)},3000);
  };

  // --------- Render de cartas ----------
  const cardHTML = (card, {inSlot=false}={}) => {
    const el = document.createElement('div');
    el.className = 'card' + (inSlot ? ' in-slot' : '') + ' has-image';
    el.dataset.cardId = card.id;

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const img = document.createElement('img');
    img.className = 'card-img';
    img.src = card.image;
    img.alt = card.label;

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = card.label;

    const num = document.createElement('div');
    num.className = 'number';
    num.textContent = `-${card.value}`;

    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.textContent = card.info;

    inner.append(img, title, num, tag);
    el.appendChild(inner);
    return el;
  };

  // ===== DRAG & DROP con Pointer Events (tap=zoom; ghost solo al mover) =====
  const DRAG_THRESHOLD = 12; // px: más tolerante para distinguir tap de drag
  let drag = {
    active:false, moved:false,
    id:null, card:null, originEl:null,
    startX:0, startY:0, startRect:null,
    ghost:null
  };

  const onPointerDownCard = (cardObj, cardEl) => (e) => {
    if (state.current !== 'player') return;
    e.preventDefault();

    drag.active = true; drag.moved = false;
    drag.id = cardObj.id; drag.card = cardObj; drag.originEl = cardEl;
    drag.startX = e.clientX; drag.startY = e.clientY;
    drag.startRect = cardEl.getBoundingClientRect();

    // Resaltamos slots (opcional, feedback)
    playerSlots.forEach(s=>s.classList.add('own-target'));

    // Escuchamos en document para robustez en móvil
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp, { once:true });
    document.addEventListener('pointercancel', onPointerCancel, { once:true });
  };

  const onPointerMove = (e) => {
    if (!drag.active) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    // Hasta superar el umbral, seguimos en "tap"
    if (!drag.moved) {
      if (Math.hypot(dx, dy) <= DRAG_THRESHOLD) return;

      // A partir de aquí SÍ es arrastre: creamos ghost y ocultamos original
      drag.moved = true;

      const g = drag.originEl.cloneNode(true);
      g.classList.add('fly');
      Object.assign(g.style, {
        left:`${drag.startRect.left}px`, top:`${drag.startRect.top}px`,
        width:`${drag.startRect.width}px`, height:`${drag.startRect.height}px`,
        transform:`translate(0,0)`, opacity:'0.95', transition:'none'
      });
      document.body.appendChild(g);
      drag.ghost = g;

      drag.originEl.style.visibility = 'hidden';
    }

    // Mover ghost
    if (drag.ghost) {
      drag.ghost.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  };

  const animateGhostTo = (slotEl, onEnd) => {
    if (!drag.ghost) return onEnd();
    const b = slotEl.getBoundingClientRect();
    const dxF = b.left - drag.startRect.left + (b.width - drag.startRect.width)/2;
    const dyF = b.top  - drag.startRect.top  + (b.height - drag.startRect.height)/2;
    drag.ghost.style.transition = 'transform 220ms ease, opacity 220ms ease';
    drag.ghost.style.transform  = `translate(${dxF}px, ${dyF}px)`;
    drag.ghost.style.opacity    = '0.2';
    setTimeout(onEnd, 230);
  };

  const animateGhostBack = (onEnd) => {
    if (!drag.ghost) return onEnd();
    drag.ghost.style.transition = 'transform 180ms ease, opacity 180ms ease';
    drag.ghost.style.transform  = 'translate(0,0)';
    drag.ghost.style.opacity    = '1';
    setTimeout(onEnd, 190);
  };

  const cleanupDrag = () => {
    if (drag.originEl) drag.originEl.style.visibility = '';
    if (drag.ghost) { try{ drag.ghost.remove(); }catch{} }
    playerSlots.forEach(s=>s.classList.remove('own-target'));
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointercancel', onPointerCancel);
    drag = { active:false, moved:false, id:null, card:null, originEl:null, startX:0, startY:0, startRect:null, ghost:null };
  };

  const onPointerUp = (e) => {
    if (!drag.active) return;

    // TAP sin mover ⇒ ZOOM (en la mano)
    if (!drag.moved) {
      cleanupDrag();
      showCardZoom(drag.card);
      return;
    }

    // Soltó arrastrando: buscamos slot jugador
    const dropEl = document.elementFromPoint(e.clientX, e.clientY);
    const slot = dropEl?.closest?.('.lane-player .slot');

    if (slot && state.current === 'player') {
      animateGhostTo(slot, () => {
        const idx = state.player.hand.findIndex(c=>c.id===drag.id);
        if (idx !== -1) {
          const card = state.player.hand.splice(idx,1)[0];
          const slotIdx = Number(slot.dataset.idx);
          state.player.slots[slotIdx] = card;
          renderSlots();
          flashSlot(slot);
          applyEffect('player', card);
          if (state.player.pollution === 0) { cleanupDrag(); endGame('win','¡Llegaste a 0 de contaminación!'); return; }
          refreshHandUI();
          cleanupDrag();
          nextTurn();
        } else {
          cleanupDrag();
        }
      });
    } else {
      // Fuera: volver a origen
      animateGhostBack(() => cleanupDrag());
    }
  };

  const onPointerCancel = () => {
    animateGhostBack(() => cleanupDrag());
  };
  // ===================================================================

  const renderSlots = () => {
    const renderLane = (owner, slotsEls) => {
      slotsEls.forEach((slotEl,i)=>{
        slotEl.innerHTML = '';
        const c = state[owner].slots[i];
        if (c){
          const view = cardHTML(c, {inSlot:true});
          // Zoom en cartas del tablero:
          view.addEventListener('click', ()=>showCardZoom(c));
          slotEl.appendChild(view);
        }
      });
    };
    renderLane('enemy', enemySlots);
    renderLane('player', playerSlots);
  };

  const refreshHandUI = () => {
    elPlayerHand.innerHTML = '';
    state.player.hand.forEach(c=>{
      const view = cardHTML(c);
      // Pointer Events (drag + tap=zoom)
      view.addEventListener('pointerdown', onPointerDownCard(c, view), { passive:false });
      elPlayerHand.appendChild(view);
    });
  };

  // --------- Zoom ----------
  const showCardZoom = (card) => {
    zoomCard.innerHTML = `
      <div class="title">${card.label}</div>
      <img src="${card.image}" alt="${card.label}">
      <div class="number">-${card.value}</div>
      <div class="tag" style="text-align:center;opacity:.95;margin-top:auto;">${card.info}</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
        <button class="btn" id="zoomClose">Cerrar</button>
      </div>`;
    cardZoom.classList.remove('hidden');
    $('zoomClose').onclick = hideCardZoom;
    cardZoom.onclick = (e)=>{ if (e.target===cardZoom) hideCardZoom(); };
  };
  const hideCardZoom = ()=> cardZoom.classList.add('hidden');

  // --------- Juego ---------
  const flashSlot = slot => { slot.classList.remove('flash'); void slot.offsetWidth; slot.classList.add('flash'); };
  const applyEffect = (who, card) => {
    state[who].pollution = Math.max(0, state[who].pollution - card.value);
    updatePollutionUI(); pulse(who);
  };

  // --------- Turnos ---------
  const nextTurn = () => {
    state.current = state.current==='player' ? 'enemy' : 'player';
    elTurnLabel.textContent = state.current==='player' ? 'Jugador' : 'Rival';
    banner(state.current==='player' ? 'Turno del Jugador' : 'Turno del Rival');
    draw(state.current, TURN_DRAW, state.current==='player');
    if (state.current==='enemy') setTimeout(enemyPlays, 700);
  };

  const enemyPlays = () => {
    const h = state.enemy.hand; if (!h.length) return nextTurn();
    let best=0; for (let i=1;i<h.length;i++) if (h[i].value>h[best].value) best=i;
    const card = h.splice(best,1)[0];
    let idx = state.enemy.slots.findIndex(s=>!s);
    if (idx === -1){ let min=Infinity, at=0; state.enemy.slots.forEach((c,i)=>{if(c.value<min){min=c.value;at=i}}); idx=at; }
    state.enemy.slots[idx]=card; flashSlot(enemySlots[idx]); renderSlots(); applyEffect('enemy',card);
    if (state.enemy.pollution === 0) return endGame('lose','El rival llegó a 0.');
    nextTurn();
  };

  // --------- Fin / tiempo ---------
  const endGame = (res, subtitle='') => {
    clearInterval(state.intervalId);
    overlay.classList.remove('hidden');
    overlayTitle.textContent = res==='win'?'¡Victoria!':res==='lose'?'Derrota':'Empate';
    overlaySubtitle.textContent = subtitle;
  };
  const decideByTime = () => {
    const p=state.player.pollution, e=state.enemy.pollution;
    if (p<e) endGame('win','Ganaste por menor contaminación.');
    else if (e<p) endGame('lose','El rival tenía menos contaminación.');
    else endGame('draw','Empate al agotar el tiempo.');
  };
  const tick = () => {
    state.timer--; elTimer.textContent = timeFmt(state.timer);
    if (state.timer<=0){ clearInterval(state.intervalId); decideByTime(); }
  };

  // --------- Inicio ---------
  const start = () => {
    Object.assign(state.player,{pollution:START_POLLUTION,hand:[],slots:Array(SLOTS).fill(null)});
    Object.assign(state.enemy ,{pollution:START_POLLUTION,hand:[],slots:Array(SLOTS).fill(null)});
    state.current='player'; state.timer=MATCH_TIME;
    clearInterval(state.intervalId); overlay.classList.add('hidden');

    updatePollutionUI(); renderSlots(); refreshHandUI();
    draw('player', START_HAND_SIZE, true);
    draw('enemy',  START_HAND_SIZE, false);
    elTimer.textContent = timeFmt(state.timer);
    state.intervalId = setInterval(tick, 1000);
    banner('Turno del Jugador');
  };

  restartBtn.addEventListener('click', start);
  start();
})();