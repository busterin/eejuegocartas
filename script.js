(() => {
  const START_POLLUTION = 50;
  const TURN_DRAW = 1;
  const START_HAND_SIZE = 5;
  const MATCH_TIME = 5 * 60;
  const SLOTS = 5;

  const SOL_IMG       = "assets/Carta1.png";
  const PANELES_IMG   = "assets/Carta2.png";
  const LUCES_IMG     = "assets/Carta3.png";
  const RECICLAJE_IMG = "assets/Carta4.png";
  const PLANTAR_IMG   = "assets/Carta5.png";
  const AGUA_IMG      = "assets/Carta6.png";
  const CAMBIO_IMG    = "assets/Carta7.png";

  const baseDeck = [
    { label: "Sol",               value: 8, image: SOL_IMG },
    { label: "Paneles Solares",   value: 6, image: PANELES_IMG },
    { label: "Luces Apagadas",    value: 4, image: LUCES_IMG },
    { label: "Reciclaje",         value: 0, image: RECICLAJE_IMG },
    { label: "Plantar",           value: 0, image: PLANTAR_IMG },
    { label: "Agua",              value: 2, image: AGUA_IMG },
    { label: "Cambio",            value: 0, image: CAMBIO_IMG },
  ];

  const state = {
    player: { pollution: START_POLLUTION, hand: [], slots: Array(SLOTS).fill(null) },
    enemy:  { pollution: START_POLLUTION, hand: [], slots: Array(SLOTS).fill(null) },
    current: 'player',
    timer: MATCH_TIME,
    intervalId: null,
    nullifyNext: { player: false, enemy: false },
    doubleNext:  { player: false, enemy: false },
  };

  const $ = id => document.getElementById(id);
  const elPlayerPollution = $('playerPollution');
  const elEnemyPollution  = $('enemyPollution');
  const elPlayerBubble    = $('playerBubble');
  const elEnemyBubble     = $('enemyBubble');
  const elPlayerHand      = $('playerHand');
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

  const randInt = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const timeFmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const randFromDeck = () => {
    const proto = structuredClone(baseDeck[randInt(0, baseDeck.length-1)]);
    proto.id = `c-${Math.random().toString(36).slice(2,8)}`;
    return proto;
  };
  const randFromDeckExcept = (exclude) => {
    const pool = baseDeck.filter(c => c.image !== exclude);
    const proto = structuredClone(pool[randInt(0, pool.length-1)]);
    proto.id = `c-${Math.random().toString(36).slice(2,8)}`;
    return proto;
  };

  const boardThumb = (img) => img.replace('.png', 'tablero.png');

  const pulse = who => {
    const el = who==='player'?elPlayerBubble:elEnemyBubble;
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  };
  const updatePollutionUI = () => {
    elPlayerPollution.textContent = state.player.pollution;
    elEnemyPollution.textContent  = state.enemy.pollution;
  };

  const createToast = msg => {
    let box = document.querySelector('.toast-container');
    if(!box){
      box = document.createElement('div');
      box.className = 'toast-container';
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    box.appendChild(t);
    requestAnimationFrame(()=>t.classList.add('in'));
    setTimeout(()=>{t.classList.remove('in');t.classList.add('out');setTimeout(()=>t.remove(),300)},2200);
  };

  const flashSlot = slot => { slot.classList.remove('flash'); void slot.offsetWidth; slot.classList.add('flash'); };

  const showCardZoom = card => {
    zoomCard.innerHTML = `<img src="${card.image}" alt=""><div class="number">-${card.value}</div>`;
    cardZoom.classList.remove('hidden');
    cardZoom.onclick = e => { if(e.target===cardZoom) cardZoom.classList.add('hidden'); };
    document.addEventListener('keydown', e=>{if(e.key==='Escape') cardZoom.classList.add('hidden');},{once:true});
  };

  const draw = (owner,n=1) => {
    for(let i=0;i<n;i++) state[owner].hand.push(randFromDeck());
    if(owner==='player') refreshHandUI();
  };

  const cardHTML = (card,{inSlot=false}={})=>{
    const el=document.createElement('div');
    el.className='card has-image';
    const img=document.createElement('img');
    img.className='card-img';
    img.src=inSlot?boardThumb(card.image):card.image;
    const num=document.createElement('div');
    num.className='number';
    num.textContent=`-${card.value}`;
    el.append(img,num);
    return el;
  };

  const refreshHandUI=()=>{
    elPlayerHand.innerHTML='';
    state.player.hand.forEach(c=>{
      const view=cardHTML(c);
      view.addEventListener('pointerdown',()=>showCardZoom(c));
      view.addEventListener('click',()=>showCardZoom(c));
      view.addEventListener('dblclick',()=>showCardZoom(c));
      view.draggable=true;
      view.ondragstart=e=>{e.dataTransfer.setData('id',c.id);};
      elPlayerHand.append(view);
    });
  };

  const renderSlots=()=>{
    const renderLane=(owner,slotsEls)=>{
      slotsEls.forEach((slotEl,i)=>{
        slotEl.innerHTML='';
        const c=state[owner].slots[i];
        if(c){
          const view=cardHTML(c,{inSlot:true});
          view.addEventListener('click',()=>showCardZoom(c));
          slotEl.append(view);
        }
      });
    };
    renderLane('enemy',enemySlots);
    renderLane('player',playerSlots);
  };

  const applyEffect=(who,card)=>{
    const mult=state.doubleNext[who]?2:1;
    const base=(card.value||0)*mult;
    if(state.doubleNext[who]) state.doubleNext[who]=false;
    state[who].pollution=Math.max(0,state[who].pollution-base);
    updatePollutionUI(); pulse(who);
  };

  const applySpecialEffects=(whoPlayed,card,slotIdx)=>{
    if(card.image===PANELES_IMG){
      const opponent=whoPlayed==='player'?'enemy':'player';
      const slots=state[opponent].slots;
      const slotEls=opponent==='enemy'?enemySlots:playerSlots;
      let restored=0;
      slots.forEach((c,i)=>{
        if(c&&c.image===SOL_IMG){
          restored+=c.value; slots[i]=null;
          const el=slotEls[i];
          if(el){ el.classList.remove('sun-pop'); void el.offsetWidth; el.classList.add('sun-pop'); }
        }
      });
      state[opponent].pollution=Math.min(START_POLLUTION,state[opponent].pollution+restored);
      updatePollutionUI(); pulse(opponent); renderSlots();
      createToast(`Paneles Solares elimina cartas de Sol (+${restored})`);
    }
    if(card.image===LUCES_IMG){
      const opp=whoPlayed==='player'?'enemy':'player';
      state.nullifyNext[opp]=true;
      createToast(`LUCES APAGADAS: la siguiente carta del ${opp==='enemy'?'rival':'jugador'} no tendrá efecto`);
    }
    if(card.image===RECICLAJE_IMG){
      const ownerSlots=state[whoPlayed].slots;
      const newC=randFromDeckExcept(RECICLAJE_IMG);
      ownerSlots[slotIdx]=newC; renderSlots(); createToast("RECICLAJE → transformado");
    }
    if(card.image===PLANTAR_IMG){
      const count=state[whoPlayed].slots.filter(Boolean).length;
      const extra=2*count;
      state[whoPlayed].pollution=Math.max(0,state[whoPlayed].pollution-extra);
      updatePollutionUI(); pulse(whoPlayed);
      createToast(`PLANTAR: -${extra} adicional (${count} cartas en mesa)`);
    }
    if(card.image===AGUA_IMG){
      state.doubleNext[whoPlayed]=true;
      createToast(`AGUA: la próxima carta resta el doble`);
    }
    if(card.image===CAMBIO_IMG){
      const opp=whoPlayed==='player'?'enemy':'player';
      const tmp=state[whoPlayed].slots[slotIdx];
      state[whoPlayed].slots[slotIdx]=state[opp].slots[slotIdx];
      state[opp].slots[slotIdx]=tmp;
      renderSlots();
      createToast("CAMBIO: intercambio de cartas");
    }
  };

  const enemyPlays=()=>{
    const h=state.enemy.hand;if(!h.length)return nextTurn();
    const idx=randInt(0,h.length-1);
    const c=h.splice(idx,1)[0];
    let slot=state.enemy.slots.findIndex(s=>!s);
    if(slot===-1)slot=randInt(0,SLOTS-1);
    state.enemy.slots[slot]=c;
    renderSlots(); flashSlot(enemySlots[slot]);
    if(state.nullifyNext.enemy){
      state.nullifyNext.enemy=false;
      createToast("Carta del rival anulada");
    } else {
      applyEffect('enemy',c);
      applySpecialEffects('enemy',c,slot);
    }
    if(state.enemy.pollution===0)return endGame('lose','El rival llegó a 0.');
    nextTurn();
  };

  const nextTurn=()=>{
    state.current=state.current==='player'?'enemy':'player';
    if(state.current==='player'){draw('player',1); refreshHandUI();}
    if(state.current==='enemy')setTimeout(enemyPlays,700);
  };

  const endGame=(res,txt)=>{
    clearInterval(state.intervalId);
    overlay.classList.remove('hidden');
    overlayTitle.textContent=res==='win'?'¡Victoria!':res==='lose'?'Derrota':'Empate';
    overlaySubtitle.textContent=txt;
  };

  const tick=()=>{
    state.timer--;
    elTimer.textContent=timeFmt(state.timer);
    if(state.timer<=0){
      clearInterval(state.intervalId);
      const p=state.player.pollution,e=state.enemy.pollution;
      if(p<e)endGame('win','Ganaste por menor contaminación.');
      else if(e<p)endGame('lose','El rival tenía menos contaminación.');
      else endGame('draw','Empate.');
    }
  };

  const start=()=>{
    Object.assign(state.player,{pollution:START_POLLUTION,hand:[],slots:Array(SLOTS).fill(null)});
    Object.assign(state.enemy ,{pollution:START_POLLUTION,hand:[],slots:Array(SLOTS).fill(null)});
    state.nullifyNext={player:false,enemy:false};
    state.doubleNext={player:false,enemy:false};
    state.timer=MATCH_TIME; state.current='player';
    overlay.classList.add('hidden');
    updatePollutionUI(); renderSlots(); refreshHandUI();
    draw('player',START_HAND_SIZE); draw('enemy',START_HAND_SIZE);
    clearInterval(state.intervalId); state.intervalId=setInterval(tick,1000);
  };

  restartBtn.addEventListener('click',start);
  start();
})();