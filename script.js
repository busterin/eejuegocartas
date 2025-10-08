(() => {
  // --------- Configuración ----------
  const START_POLLUTION = 50;
  const TURN_DRAW = 1;
  const START_HAND_SIZE = 5;
  const MATCH_TIME = 5 * 60; // 5 minutos
  const SLOTS = 5;

  // Paths / Cartas clave
  const SOL_IMG       = "assets/Carta1.png"; // SOL
  const PANELES_IMG   = "assets/Carta2.png"; // PANELES SOLARES
  const LUCES_IMG     = "assets/Carta3.png"; // LUCES APAGADAS
  const RECICLAJE_IMG = "assets/Carta4.png"; // RECICLAJE
  const PLANTAR_IMG   = "assets/Carta5.png"; // PLANTAR
  const AGUA_IMG      = "assets/Carta6.png"; // AGUA
  const CAMBIO_IMG    = "assets/Carta7.png"; // CAMBIO

  // --------- Mazo base: 7 cartas ---------
  const baseDeck = [
    { label: "Sol",               value: 2, image: SOL_IMG },
    { label: "Paneles Solares",   value: 3, image: PANELES_IMG },
    { label: "Luces Apagadas",    value: 0, image: LUCES_IMG },
    { label: "Reciclaje",         value: 2, image: RECICLAJE_IMG },
    { label: "Plantar",           value: 5, image: PLANTAR_IMG },
    { label: "Agua",              value: 3, image: AGUA_IMG },
    { label: "Cambio",            value: 4, image: CAMBIO_IMG },
  ];

  // --------- Estado ----------
  const state = {
    player: { pollution: START_POLLUTION, hand: [], slots: Array(SLOTS).fill(null) },
    enemy:  { pollution: START_POLLUTION, hand: [], slots: Array(SLOTS).fill(null) },
    current: 'player',
    timer: MATCH_TIME,
    intervalId: null,
    nullifyNext: { player: false, enemy: false }, // Luces Apagadas
    doubleNext:  { player: false, enemy: false }, // Agua
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
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const randFromDeck = () => {
    const proto = structuredClone(baseDeck[randInt(0, baseDeck.length-1)]);
    proto.id = `c-${Math.random().toString(36).slice(2,8)}`;
    return proto;
  };
  const randFromDeckExcept = (imagePathToExclude) => {
    const pool = baseDeck.filter(c => c.image !== imagePathToExclude);
    const proto = structuredClone(pool[randInt(0, pool.length-1)]);
    proto.id = `c-${Math.random().toString(36).slice(2,8)}`;
    return proto;
  };

  // --------- Toaster ----------
  let toastContainer;
  const ensureToastContainer = () => {
    if (toastContainer) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
    return toastContainer;
  };
  const createToast = (msg) => {
    const wrap = ensureToastContainer();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    wrap.appendChild(t);
    requestAnimationFrame(()=> t.classList.add('in'));
    setTimeout(()=> {
      t.classList.remove('in');
      t.classList.add('out');
      setTimeout(()=> t.remove(), 300);
    }, 2200);
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
    img.alt = card.label || '';

    const num = document.createElement('div');
    num.className = 'number';
    num.textContent = `-${card.value}`;

    inner.append(img, num);
    el.appendChild(inner);
    return el;
  };

  // ===== DRAG & TAP-TO-ZOOM (cross desktop/móvil) =====
  const DRAG_THRESHOLD = 12; // px
  let drag = {
    active:false, moved:false,
    id:null, card:null, originEl:null,
    startX:0, startY:0, startRect:null,
    ghost:null
  };
  let justDragged = false;

  const onPointerDownCard = (cardObj, cardEl) => (e) => {
    if (state.current !== 'player') return;

    e.preventDefault();
    drag.active = true; drag.moved = false;
    drag.id = cardObj.id; drag.card = cardObj; drag.originEl = cardEl;
    drag.startX = e.clientX; drag.startY = e.clientY;
    drag.startRect = cardEl.getBoundingClientRect();

    document.addEventListener('pointermove', onPointerMove, { passive:false });
    document.addEventListener('pointerup', onPointerUp, { once:true, capture:true });
    cardEl.addEventListener('pointerup', onPointerUp, { once:true });
    document.addEventListener('pointercancel', onPointerCancel, { once:true, capture:true });
  };

  const onPointerMove = (e) => {
    if (!drag.active) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (!drag.moved) {
      if (Math.hypot(dx, dy) <= DRAG_THRESHOLD) return;

      drag.moved = true;
      const g = drag.originEl.cloneNode(true);
      g.classList.add('fly');
      Object.assign(g.style, {
        left:`${drag.startRect.left}px`,
        top:`${drag.startRect.top}px`,
        width:`${drag.startRect.width}px`,
        height:`${drag.startRect.height}px`,
        transform:`translate(0,0)`,
        opacity:'0.95',
        transition:'none'
      });
      document.body.appendChild(g);
      drag.ghost = g;

      drag.originEl.style.visibility = 'hidden';
    }

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
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointercancel', onPointerCancel, true);
    drag = { active:false, moved:false, id:null, card:null, originEl:null, startX:0, startY:0, startRect:null, ghost:null };
  };

  const onPointerUp = (e) => {
    if (!drag.active) return;

    // TAP sin mover ⇒ ZOOM
    if (!drag.moved) {
      cleanupDrag();
      showCardZoom(drag.card);
      return;
    }

    // Arrastre: intentar soltar en slot jugador
    const dropEl = document.elementFromPoint(e.clientX, e.clientY);
    const slot = dropEl?.closest?.('.lane-player .slot');

    if (slot && state.current === 'player') {
      const slotIdx = Number(slot.dataset.idx);
      animateGhostTo(slot, () => {
        const idx = state.player.hand.findIndex(c=>c.id===drag.id);
        if (idx !== -1) {
          const card = state.player.hand.splice(idx,1)[0];
          state.player.slots[slotIdx] = card;
          renderSlots();
          flashSlot(slot);

          if (state.nullifyNext.player) {
            state.nullifyNext.player = false;
            triggerNullifySweep('player');
            markSlotNullified(slot);
            createToast("Tu carta ha sido anulada por LUCES APAGADAS");
          } else {
            applyEffect('player', card);
            applySpecialEffects('player', card, slotIdx);
          }

          if (state.player.pollution === 0) { cleanupDrag(); endGame('win','¡Llegaste a 0 de contaminación!'); return; }
          refreshHandUI();
          cleanupDrag();
          justDragged = true; setTimeout(()=>justDragged=false, 50);
          nextTurn();
        } else {
          cleanupDrag();
        }
      });
    } else {
      // Soltó fuera: volver
      animateGhostBack(() => {
        cleanupDrag();
        justDragged = true; setTimeout(()=>justDragged=false, 50);
      });
    }
  };

  const onPointerCancel = () => {
    animateGhostBack(() => cleanupDrag());
  };

  // --------- Render de slots ----------
  const renderSlots = () => {
    const renderLane = (owner, slotsEls) => {
      slotsEls.forEach((slotEl,i)=>{
        slotEl.innerHTML = '';
        const c = state[owner].slots[i];
        if (c){
          const view = cardHTML(c, {inSlot:true});
          // En el tablero: click/tap = zoom
          view.addEventListener('click', ()=>showCardZoom(c));
          slotEl.appendChild(view);
        }
      });
    };
    renderLane('enemy', enemySlots);
    renderLane('player', playerSlots);
  };

  // --------- Mano del jugador ----------
  const refreshHandUI = () => {
    elPlayerHand.innerHTML = '';
    state.player.hand.forEach(c=>{
      const view = cardHTML(c);
      view.addEventListener('pointerdown', onPointerDownCard(c, view), { passive:false });
      view.addEventListener('click', () => {
        if (justDragged) return;
        showCardZoom(c);
      });
      elPlayerHand.appendChild(view);
    });
  };

  // --------- Zoom (sin botón cerrar) ----------
  const showCardZoom = (card) => {
    zoomCard.innerHTML = `
      <img src="${card.image}" alt="${card.label || ''}">
      <div class="number">-${card.value}</div>`;
    cardZoom.classList.remove('hidden');

    // Cerrar tocando/clicando fuera de la tarjeta
    cardZoom.onclick = (e)=>{ if (e.target===cardZoom) hideCardZoom(); };

    // Cerrar con ESC
    const onEsc = (ev) => { if (ev.key === 'Escape') { hideCardZoom(); } };
    document.addEventListener('keydown', onEsc, { once:true });
  };
  const hideCardZoom = ()=> cardZoom.classList.add('hidden');

  // --------- Efectos visuales auxiliares ----------
  const flashSlot = slot => { slot.classList.remove('flash'); void slot.offsetWidth; slot.classList.add('flash'); };

  const triggerSolarSweep = (owner) => {
    const laneEl = owner === 'enemy' ? document.querySelector('.lane-enemy')
                                     : document.querySelector('.lane-player');
    if (!laneEl) return;
    laneEl.classList.remove('solar-sweep'); void laneEl.offsetWidth; laneEl.classList.add('solar-sweep');
    setTimeout(()=> laneEl.classList.remove('solar-sweep'), 700);
  };

  const triggerNullifySweep = (nullifiedOwner) => {
    const laneEl = nullifiedOwner === 'enemy' ? document.querySelector('.lane-enemy')
                                              : document.querySelector('.lane-player');
    if (!laneEl) return;
    laneEl.classList.remove('nullify-sweep'); void laneEl.offsetWidth; laneEl.classList.add('nullify-sweep');
    setTimeout(()=> laneEl.classList.remove('nullify-sweep'), 700);
  };

  const markSlotNullified = (slotEl) => {
    slotEl.classList.remove('nullified'); void slotEl.offsetWidth; slotEl.classList.add('nullified');
    setTimeout(()=> slotEl.classList.remove('nullified'), 700);
  };

  const markSlotMorph = (slotEl) => {
    slotEl.classList.remove('morph'); void slotEl.offsetWidth; slotEl.classList.add('morph');
    setTimeout(()=> slotEl.classList.remove('morph'), 700);
  };

  // --------- Juego: efectos básicos y especiales ---------
  const applyEffect = (who, card) => {
    // Doble efecto base si está activo AGUA para este bando
    const mult = state.doubleNext[who] ? 2 : 1;
    const base = (card.value || 0) * mult;
    if (state.doubleNext[who]) state.doubleNext[who] = false; // se consume

    state[who].pollution = Math.max(0, state[who].pollution - base);
    updatePollutionUI(); pulse(who);
  };

  const applySpecialEffects = (whoPlayed, card, slotIdx) => {
    // PANELes SOLARES => elimina SOL del rival y devuelve contaminación
    if (card.image === PANELES_IMG) {
      const opponent = whoPlayed === 'player' ? 'enemy' : 'player';
      const opponentSlots = state[opponent].slots;
      const slotsEls = opponent === 'enemy' ? enemySlots : playerSlots;

      let restored = 0;
      let removedCount = 0;

      opponentSlots.forEach((c, i) => {
        if (c && c.image === SOL_IMG) {
          restored += c.value;
          removedCount++;
          opponentSlots[i] = null;

          const slotEl = slotsEls[i];
          if (slotEl){
            slotEl.classList.remove('sun-pop'); void slotEl.offsetWidth; slotEl.classList.add('sun-pop');
            setTimeout(()=> slotEl.classList.remove('sun-pop'), 450);
          }
        }
      });

      if (removedCount > 0) {
        triggerSolarSweep(opponent);
        state[opponent].pollution = clamp(state[opponent].pollution + restored, 0, START_POLLUTION);
        updatePollutionUI(); pulse(opponent);
        renderSlots();
        const whoTxt = opponent === 'enemy' ? 'Rival' : 'Jugador';
        createToast(`Paneles Solares elimina ${removedCount} Sol · +${restored} contaminación para ${whoTxt}`);
      }
    }

    // LUCES APAGADAS => anula la siguiente carta del rival
    if (card.image === LUCES_IMG) {
      const opponent = whoPlayed === 'player' ? 'enemy' : 'player';
      state.nullifyNext[opponent] = true;
      triggerNullifySweep(opponent);
      const whoTxt = opponent === 'enemy' ? 'Rival' : 'Jugador';
      createToast(`LUCES APAGADAS: la siguiente carta del ${whoTxt} no tendrá efecto`);
    }

    // RECICLAJE => se transforma en otra carta (no Carta4)
    if (card.image === RECICLAJE_IMG) {
      const ownerSlots = state[whoPlayed].slots;
      const slotsEls = whoPlayed === 'player' ? playerSlots : enemySlots;
      const slotEl = slotsEls[slotIdx];
      markSlotMorph(slotEl);

      const newCard = randFromDeckExcept(RECICLAJE_IMG);
      ownerSlots[slotIdx] = newCard;
      renderSlots();
      createToast(`RECICLAJE → se transforma`);
    }

    // PLANTAR => -2 por cada carta en tu propio tablero (incluida esta)
    if (card.image === PLANTAR_IMG) {
      const count = state[whoPlayed].slots.filter(Boolean).length;
      const extra = 2 * count;
      if (extra > 0) {
        state[whoPlayed].pollution = Math.max(0, state[whoPlayed].pollution - extra);
        updatePollutionUI(); pulse(whoPlayed);
        createToast(`PLANTAR: -${extra} adicional (${count} cartas en mesa)`);
      }
    }

    // AGUA => duplica el efecto base de la PRÓXIMA carta del mismo bando
    if (card.image === AGUA_IMG) {
      state.doubleNext[whoPlayed] = true;
      createToast(`AGUA: tu próxima carta resta el doble`);
    }

    // CAMBIO => intercambia con la carta del rival enfrente (mismo índice)
    if (card.image === CAMBIO_IMG) {
      const opponent = whoPlayed === 'player' ? 'enemy' : 'player';
      // Si el índice no se pasó (seguridad), no hacemos nada
      if (typeof slotIdx === 'number') {
        const mySlots = state[whoPlayed].slots;
        const oppSlots = state[opponent].slots;

        const tmp = mySlots[slotIdx];
        mySlots[slotIdx] = oppSlots[slotIdx];
        oppSlots[slotIdx] = tmp;

        renderSlots();
        const mySlotEl  = (whoPlayed === 'player' ? playerSlots : enemySlots)[slotIdx];
        const oppSlotEl = (opponent    === 'enemy' ? enemySlots  : playerSlots)[slotIdx];
        if (mySlotEl)  { mySlotEl.classList.remove('flash'); void mySlotEl.offsetWidth; mySlotEl.classList.add('flash'); }
        if (oppSlotEl) { oppSlotEl.classList.remove('flash'); void oppSlotEl.offsetWidth; oppSlotEl.classList.add('flash'); }
        createToast(`CAMBIO: intercambio de cartas en el hueco ${slotIdx+1}`);
      }
    }
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

    // IA: prioriza Paneles si el jugador tiene Sol en mesa
    const idxPaneles = h.findIndex(c => c.image === PANELES_IMG);
    const playerHasSolOnBoard = state.player.slots.some(c => c && c.image === SOL_IMG);

    let playIndex = 0;
    if (idxPaneles !== -1 && playerHasSolOnBoard) {
      playIndex = idxPaneles;
    } else {
      // si no, juega la carta de mayor valor (puede ser SOL/PLANTAR/AGUA/CAMBIO/etc.)
      for (let i=1;i<h.length;i++) if (h[i].value>h[playIndex].value) playIndex=i;
    }

    const card = h.splice(playIndex,1)[0];
    // Hueco enemigo: libre o sustituye el de menor valor
    let idx = state.enemy.slots.findIndex(s=>!s);
    if (idx === -1){ let min=Infinity, at=0; state.enemy.slots.forEach((c,i)=>{if(c && c.value<min){min=c.value;at=i}}); idx=at; }

    state.enemy.slots[idx]=card; flashSlot(enemySlots[idx]); renderSlots();

    // ¿Está anulada la próxima carta del rival (enemy)?
    if (state.nullifyNext.enemy) {
      state.nullifyNext.enemy = false;
      triggerNullifySweep('enemy');
      markSlotNullified(enemySlots[idx]);
      createToast("Carta del Rival anulada por LUCES APAGADAS");
    } else {
      applyEffect('enemy',card);
      applySpecialEffects('enemy', card, idx);
    }

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
    state.nullifyNext = { player:false, enemy:false };
    state.doubleNext  = { player:false, enemy:false };
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