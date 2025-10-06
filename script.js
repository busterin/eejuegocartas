(() => {
  // ---- Config ----
  const START_POLLUTION = 50;
  const TURN_DRAW = 1;
  const START_HAND_SIZE = 5;
  const MATCH_TIME = 5 * 60;
  const CARD_MIN = 2, CARD_MAX = 9;
  const SLOTS = 5;

  // ---- Estado ----
  const state = {
    player: { pollution: START_POLLUTION, hand: [], slots: Array(SLOTS).fill(null) },
    enemy:  { pollution: START_POLLUTION, hand: [], slots: Array(SLOTS).fill(null) },
    current: 'player',
    timer: MATCH_TIME,
    intervalId: null
  };

  // ---- DOM ----
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

  // ---- Utils ----
  const randInt = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const timeFmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const makeCard = (owner, image=null) => ({
    id: `${owner}-${Math.random().toString(36).slice(2,8)}`,
    value: randInt(CARD_MIN, CARD_MAX),
    label: "Acción Verde",
    info: "Reduce tu contaminación",
    image
  });

  const draw = (owner, n=1, preview=false) => {
    for (let i=0;i<n;i++){
      const firstInitialCard = owner==='player' && state.player.hand.length===0 && state.player.slots.every(v=>v===null);
      const img = firstInitialCard ? 'assets/Carta1.png' : null;
      state[owner].hand.push(makeCard(owner, img));
    }
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

  // ---- Cartas (estructura con overlay de imagen) ----
  const cardHTML = (card, {inSlot=false}={}) => {
    const el = document.createElement('div');
    el.className = 'card' + (inSlot ? ' in-slot' : '') + (card.image ? ' has-image' : '');
    el.dataset.cardId = card.id;

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    if (card.image){
      const img = document.createElement('img');
      img.className = 'card-img';
      img.src = card.image;
      img.alt = card.label;
      inner.appendChild(img); // queda por debajo del contenido
    }

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = card.label;

    const num = document.createElement('div');
    num.className = 'number';
    num.textContent = `-${card.value}`;

    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.textContent = card.info;

    inner.append(title, num, tag);
    el.appendChild(inner);
    return el;
  };

  const asDraggable = el => {
    el.draggable = true;
    el.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('text/plain', el.dataset.cardId);
      e.dataTransfer.setDragImage(el, el.offsetWidth/2, el.offsetHeight/2);
      playerSlots.forEach(s=>s.classList.add('own-target'));
    });
    el.addEventListener('dragend', ()=>{
      playerSlots.forEach(s=>s.classList.remove('own-target'));
    });
  };

  const renderSlots = () => {
    const renderLane = (owner, slotsEls) => {
      slotsEls.forEach((slotEl,i)=>{
        slotEl.innerHTML = '';
        const c = state[owner].slots[i];
        if (c){
          const view = cardHTML(c, {inSlot:true});
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
      view.addEventListener('click', ()=>showCardZoom(c));
      asDraggable(view);
      elPlayerHand.appendChild(view);
    });
  };

  // ---- Zoom ----
  const showCardZoom = (card) => {
    zoomCard.innerHTML = `
      <div class="title" style="font-weight:800">${card.label}</div>
      ${card.image ? `<img src="${card.image}" alt="${card.label}" style="width:100%;height:55%;object-fit:cover;border-radius:12px;margin:10px 0">` : ''}
      <div class="number" style="font-size:4rem;text-align:center;font-weight:900;">-${card.value}</div>
      <div style="text-align:center;opacity:.95;margin-bottom:8px">${card.info}</div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="btn" id="zoomClose">Cerrar</button>
      </div>`;
    cardZoom.classList.remove('hidden');
    $('zoomClose').onclick = hideCardZoom;
    cardZoom.onclick = (e)=>{ if (e.target===cardZoom) hideCardZoom(); };
  };
  const hideCardZoom = ()=> cardZoom.classList.add('hidden');

  // ---- Efectos / juego ----
  const flashSlot = slot => { slot.classList.remove('flash'); void slot.offsetWidth; slot.classList.add('flash'); };
  const applyEffect = (who, card) => {
    state[who].pollution = Math.max(0, state[who].pollution - card.value);
    updatePollutionUI(); pulse(who);
  };

  const flyFromHandTo = (slotEl, cardId) => {
    const src = elPlayerHand.querySelector(`[data-card-id="${cardId}"]`);
    if (!src) return;
    const a = src.getBoundingClientRect(), b = slotEl.getBoundingClientRect();
    const ghost = src.cloneNode(true); ghost.classList.add('fly'); document.body.appendChild(ghost);
    Object.assign(ghost.style,{left:`${a.left}px`,top:`${a.top}px`,width:`${a.width}px`,height:`${a.height}px`,transform:`translate(0,0)`,opacity:'0.95'});
    requestAnimationFrame(()=>{
      const dx=b.left-a.left+(b.width-a.width)/2, dy=b.top-a.top+(b.height-a.height)/2;
      ghost.style.transform=`translate(${dx}px,${dy}px) scale(0.9)`; ghost.style.opacity='0.15';
      setTimeout(()=>ghost.remove(),230);
    });
  };

  const playIntoPlayerSlot = (slotEl, card) => {
    const idx = Number(slotEl.dataset.idx);
    flyFromHandTo(slotEl, card.id);
    state.player.slots[idx] = card; flashSlot(slotEl); renderSlots();
    applyEffect('player', card);
    if (state.player.pollution === 0) return endGame('win','¡Llegaste a 0 de contaminación!');
    refreshHandUI();
    nextTurn();
  };

  // ---- Turnos ----
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

  // ---- Fin / tiempo ----
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

  // ---- DnD ----
  const setupDnD = () => {
    playerSlots.forEach(slot=>{
      slot.addEventListener('dragover', e=>{ if(state.current==='player') e.preventDefault(); });
      slot.addEventListener('drop', e=>{
        if(state.current!=='player') return;
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        const i = state.player.hand.findIndex(c=>c.id===id);
        if (i===-1) return;
        const card = state.player.hand.splice(i,1)[0];
        playIntoPlayerSlot(slot, card);
      });
    });
  };

  // ---- Inicio ----
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
  setupDnD();
  start();
})();