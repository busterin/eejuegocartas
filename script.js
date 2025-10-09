(() => {
  // --------- Configuración ----------
  const START_POLLUTION = 50;
  const TURN_DRAW = 1;
  const START_HAND_SIZE = 5;
  const MATCH_TIME = 5 * 60; // 5 minutos
  const SLOTS = 5;

  // Tiempos de turno / robo
  const DRAW_DELAY = 1200;      // espera antes de robar al empezar cada turno
  const AFTER_DRAW_PAUSE = 700; // pausa tras animar robo antes de que el rival juegue

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
    { label: "Sol",               value: 8, image: SOL_IMG },
    { label: "Paneles Solares",   value: 6, image: PANELES_IMG },
    { label: "Luces Apagadas",    value: 4, image: LUCES_IMG },
    { label: "Reciclaje",         value: 0, image: RECICLAJE_IMG },
    { label: "Plantar",           value: 0, image: PLANTAR_IMG },
    { label: "Agua",              value: 2, image: AGUA_IMG },
    { label: "Cambio",            value: 0, image: CAMBIO_IMG },
  ];

  // --------- Estado ----------
  const state = {
    player: { pollution: START_POLLUTION, hand: [], slots: Array(SLOTS).fill(null) },
    enemy:  { pollution: START_POLLUTION, hand: [], slots: Array(SLOTS).fill(null) },
    current: 'player',
    timer: MATCH_TIME,
    intervalId: null,
    nullifyNext: { player: false, enemy: false }, // Luces Apagadas anula próxima
    doubleNext:  { player: false, enemy: false }, // Agua duplica próxima
    firstTurnNoDrawDone: false // no robar en el primer turno de la partida
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

  // Portada / fondo
  const startScreen = $('startScreen');
  const playBtn     = $('playBtn');
  const gameBg      = $('gameBg');

  // Modal “Cómo jugar”
  const howBtn    = $('howBtn');
  const howModal  = $('howModal');
  const howClose  = $('howClose');
  const howOkBtn  = $('howOkBtn');

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

  // === Imagen de tablero: usar ...tablero.png sólo en la miniatura de mesa ===
  const boardThumb = (imgPath) => {
    if (typeof imgPath === 'string' && imgPath.endsWith('.png')) {
      const base = imgPath.slice(0, -4);
      return `${base}tablero.png`;
    }
    return imgPath;
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

  // --------- Pop de daño visual (sobre burbujas) ----------
  const showDamage = (who, amount) => {
    if (!amount) return;
    const bubble = who === 'player' ? elPlayerBubble : elEnemyBubble;
    const span = document.createElement('div');
    span.textContent = (amount > 0 ? '-' : '+') + Math.abs(amount);
    Object.assign(span.style, {
      position:'absolute',
      left:'50%', top:'-6px', transform:'translate(-50%,0)',
      color:'#fff', fontWeight:'900', textShadow:'0 2px 8px rgba(0,0,0,.6)',
      background:'rgba(0,0,0,.35)', padding:'2px 6px', borderRadius:'8px',
      pointerEvents:'none', opacity:'0', transition:'transform .4s ease, opacity .4s ease', zIndex:'100'
    });
    bubble.style.position = 'relative';
    bubble.appendChild(span);
    requestAnimationFrame(()=>{ span.style.opacity='1'; span.style.transform='translate(-50%,-18px)'; });
    setTimeout(()=>{ span.style.opacity='0'; span.style.transform='translate(-50%,-34px)'; setTimeout(()=> span.remove(), 250); }, 550);
  };

  // --------- UI básica ----------
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

  // --------- Animación de ROBO desde origen invisible ---------
  const animateDraw = (card, owner) => {
    const origin = {
      left: window.innerWidth + 60,
      top:  Math.max(40, window.innerHeight * 0.28)
    };
    const g = document.createElement('div');
    g.className = 'draw-card';
    g.innerHTML = `<img src="${card.image}" alt=""><div class="number">-${card.value}</div>`;
    let dest = { left: window.innerWidth/2, top: window.innerHeight-20 };
    if (owner === 'player') {
      const handRect = elPlayerHand.getBoundingClientRect();
      dest.left = handRect.right - (handRect.width * 0.25);
      dest.top  = handRect.top + 12;
    } else {
      const enemyLane = document.querySelector('.lane-enemy').getBoundingClientRect();
      dest.left = enemyLane.left + enemyLane.width * 0.5;
      dest.top  = enemyLane.top - 10;
    }
    Object.assign(g.style, { left: `${origin.left}px`, top: `${origin.top}px` });
    document.body.appendChild(g);
    requestAnimationFrame(()=>{
      g.classList.add('in');
      const dx = dest.left - origin.left;
      const dy = dest.top  - origin.top;
      g.style.setProperty('--dx', `${dx}px`);
      g.style.setProperty('--dy', `${dy}px`);
    });
    setTimeout(()=>{ g.remove(); }, 460);
  };

  // --------- Robar cartas ---------
  const draw = (owner, n=1, preview=false, {animate=false}={}) => {
    for (let i=0;i<n;i++) {
      const newC = randFromDeck();
      state[owner].hand.push(newC);
      if (animate) animateDraw(newC, owner);
    }
    if (owner==='player' && preview && state.player.hand.length){
      showCardZoom(state.player.hand[state.player.hand.length-1]);
      setTimeout(hideCardZoom, 1100);
    }
    refreshHandUI();
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
    img.src = inSlot ? boardThumb(card.image) : card.image;
    img.alt = card.label || '';

    const num = document.createElement('div');
    num.className = 'number';
    num.textContent = `-${card.value}`;

    inner.append(img, num);
    el.appendChild(inner);
    return el;
  };

  // ===== DRAG & TAP-TO-ZOOM =====
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
          // En el tablero: click/tap = zoom (zoom usa imagen original)
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

  // Nuevo: animación visual de CAMBIO
  const markSwapSlots = (slotA, slotB) => {
    if (slotA) { slotA.classList.remove('swap'); void slotA.offsetWidth; slotA.classList.add('swap'); }
    if (slotB) { slotB.classList.remove('swap'); void slotB.offsetWidth; slotB.classList.add('swap'); }
    // flip de la carta dentro del slot
    const cardA = slotA?.querySelector('.card');
    const cardB = slotB?.querySelector('.card');
    if (cardA) { cardA.classList.remove('swap-flip'); void cardA.offsetWidth; cardA.classList.add('swap-flip'); }
    if (cardB) { cardB.classList.remove('swap-flip'); void cardB.offsetWidth; cardB.classList.add('swap-flip'); }
    setTimeout(()=>{
      slotA?.classList.remove('swap');
      slotB?.classList.remove('swap');
      cardA?.classList.remove('swap-flip');
      cardB?.classList.remove('swap-flip');
    }, 700);
  };

  // --------- Juego: efectos básicos y especiales ---------
  const applyEffect = (who, card) => {
    const mult = state.doubleNext[who] ? 2 : 1;
    const base = (card.value || 0) * mult;
    if (state.doubleNext[who]) state.doubleNext[who] = false; // se consume

    state[who].pollution = Math.max(0, state[who].pollution - base);
    updatePollutionUI(); pulse(who); showDamage(who, base);
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
        const before = state[opponent].pollution;
        state[opponent].pollution = clamp(before + restored, 0, START_POLLUTION);
        updatePollutionUI(); pulse(opponent);
        showDamage(opponent, -(state[opponent].pollution - before));
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

    // RECICLAJE => se transforma en otra carta (no Carta4) y aplica su efecto
    if (card.image === RECICLAJE_IMG) {
      const ownerSlots = state[whoPlayed].slots;
      const slotsEls = whoPlayed === 'player' ? playerSlots : enemySlots;
      const slotEl = slotsEls[slotIdx];
      markSlotMorph(slotEl);

      const newCard = randFromDeckExcept(RECICLAJE_IMG);
      ownerSlots[slotIdx] = newCard;
      renderSlots();
      createToast(`RECICLAJE → se transforma`);

      // Aplica la carta transformada (base + especiales)
      const mult = state.doubleNext[whoPlayed] ? 2 : 1;
      const base = (newCard.value || 0) * mult;
      if (base) showDamage(whoPlayed, base);
      applyEffect(whoPlayed, newCard);
      applySpecialEffects(whoPlayed, newCard, slotIdx);
      return; // ya aplicamos lo necesario
    }

    // PLANTAR => -2 por cada carta en tu propio tablero (incluida esta)
    if (card.image === PLANTAR_IMG) {
      const count = state[whoPlayed].slots.filter(Boolean).length;
      const extra = 2 * count;
      if (extra > 0) {
        state[whoPlayed].pollution = Math.max(0, state[whoPlayed].pollution - extra);
        updatePollutionUI(); pulse(whoPlayed); showDamage(whoPlayed, extra);
        createToast(`PLANTAR: -${extra} adicional (${count} cartas en mesa)`);
      }
    }

    // AGUA => duplica el efecto base de la PRÓXIMA carta del mismo bando
    if (card.image === AGUA_IMG) {
      state.doubleNext[whoPlayed] = true;
      createToast(`AGUA: tu próxima carta resta el doble`);
    }

    // CAMBIO => intercambia con la carta del rival enfrente (mismo índice)
    // y al finalizar, se resta el valor de la carta intercambiada a cada bando.
    if (card.image === CAMBIO_IMG) {
      const opponent = whoPlayed === 'player' ? 'enemy' : 'player';
      if (typeof slotIdx === 'number') {
        const mySlots = state[whoPlayed].slots;
        const oppSlots = state[opponent].slots;

        const beforeMine = mySlots[slotIdx];
        const beforeOpp  = oppSlots[slotIdx];

        mySlots[slotIdx]  = beforeOpp;
        oppSlots[slotIdx] = beforeMine;

        renderSlots();

        const mySlotEl  = (whoPlayed === 'player' ? playerSlots : enemySlots)[slotIdx];
        const oppSlotEl = (opponent    === 'enemy' ? enemySlots  : playerSlots)[slotIdx];
        markSwapSlots(mySlotEl, oppSlotEl);

        if (mySlots[slotIdx]) {
          const v = mySlots[slotIdx].value || 0;
          if (v) { state[whoPlayed].pollution = Math.max(0, state[whoPlayed].pollution - v); showDamage(whoPlayed, v); }
        }
        if (oppSlots[slotIdx]) {
          const v = oppSlots[slotIdx].value || 0;
          if (v) { state[opponent].pollution = Math.max(0, state[opponent].pollution - v); showDamage(opponent, v); }
        }

        updatePollutionUI();
        pulse(whoPlayed); pulse(opponent);
        createToast(`CAMBIO: intercambio en el hueco ${slotIdx+1} · aplicado el valor de las cartas recibidas`);
      }
    }
  };

  // --------- IA / Turnos con retraso de robo ---------
  const scheduleTurnDraw = (who) => {
    if (!state.firstTurnNoDrawDone) {
      state.firstTurnNoDrawDone = true; // primer turno no roba
      return;
    }
    setTimeout(() => {
      draw(who, TURN_DRAW, who==='player', {animate:true});
    }, DRAW_DELAY);
  };

  const nextTurn = () => {
    state.current = state.current==='player' ? 'enemy' : 'player';
    elTurnLabel.textContent = state.current==='player' ? 'Jugador' : 'Rival';
    banner(state.current==='player' ? 'Turno del Jugador' : 'Turno del Rival');

    scheduleTurnDraw(state.current);

    if (state.current==='enemy') {
      const totalDelay = (state.firstTurnNoDrawDone ? DRAW_DELAY : 0) + AFTER_DRAW_PAUSE;
      setTimeout(enemyPlays, totalDelay);
    }
  };

  const enemyPlays = () => {
    const h = state.enemy.hand; if (!h.length) return nextTurn();

    // IA sencilla: prioriza Paneles si hay Sol en mesa del jugador; si no, mayor valor
    const idxPaneles = h.findIndex(c => c.image === PANELES_IMG);
    const playerHasSolOnBoard = state.player.slots.some(c => c && c.image === SOL_IMG);

    let playIndex = 0;
    if (idxPaneles !== -1 && playerHasSolOnBoard) {
      playIndex = idxPaneles;
    } else {
      for (let i=1;i<h.length;i++) if (h[i].value>h[playIndex].value) playIndex=i;
    }

    const card = h.splice(playIndex,1)[0];
    // Hueco enemigo: libre o sustituye el de menor valor
    let idx = state.enemy.slots.findIndex(s=>!s);
    if (idx === -1){ let min=Infinity, at=0; state.enemy.slots.forEach((c,i)=>{if(c && c.value<min){min=c.value;at=i}}); idx=at; }

    state.enemy.slots[idx]=card; flashSlot(enemySlots[idx]); renderSlots();

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
    state.firstTurnNoDrawDone = false;
    clearInterval(state.intervalId); overlay.classList.add('hidden');

    updatePollutionUI(); renderSlots(); refreshHandUI();

    // Manos iniciales
    for (let i=0;i<START_HAND_SIZE;i++) state.player.hand.push(randFromDeck());
    for (let i=0;i<START_HAND_SIZE;i++) state.enemy.hand.push(randFromDeck());
    refreshHandUI();

    elTimer.textContent = timeFmt(state.timer);
    state.intervalId = setInterval(tick, 1000);
    banner('Turno del Jugador');
  };

  // === Portada ===
  if (playBtn && startScreen) {
    playBtn.addEventListener('click', () => {
      // Asegura que el modal no esté visible al empezar
      howModal?.classList.add('hidden');
      startScreen.classList.add('hidden');
      gameBg.classList.remove('hidden');  // Mostrar fondo al empezar
      start();
    });
  }

  // Reiniciar desde overlay → volver a portada (no autostart)
  restartBtn.addEventListener('click', () => {
    cardZoom.classList.add('hidden');
    overlay.classList.add('hidden');
    if (state.intervalId) { clearInterval(state.intervalId); state.intervalId = null; }
    gameBg.classList.add('hidden');
    startScreen.classList.remove('hidden');
  });

  // ======== BOTÓN "CÓMO JUGAR" (modal solo en portada) ========
  // Asegurar que el modal está oculto por defecto
  howModal?.classList.add('hidden');

  // Abrir el modal sobre la portada
  howBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    // Mostrar el modal y asegurarlo por encima de la portada
    howModal.classList.remove('hidden');
    howModal.style.zIndex = '100';
    startScreen.style.zIndex = '60';
  });

  // Cerrar el modal con botón “×” o “Entendido”
  [howClose, howOkBtn].forEach(btn => {
    if (btn) btn.addEventListener('click', () => {
      howModal.classList.add('hidden');
    });
  });

  // También cerrar al pulsar fuera de la tarjeta
  howModal?.addEventListener('click', (e) => {
    if (e.target === howModal) howModal.classList.add('hidden');
  });

  // Evitar que el modal aparezca por cualquier motivo al cargar
  window.addEventListener('load', () => {
    howModal?.classList.add('hidden');
  });
})();