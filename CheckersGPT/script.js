/* Classic Checkers — v1.5 */
const FILES=['a','b','c','d','e','f','g','h'];
const START_FEN=null; // unused in checkers

const isWhite=p=>p===p.toUpperCase();
const inBounds=(f,r)=>f>=0&&f<8&&r>=0&&r<8;
const cloneBoard=b=>b.map(r=>r.slice());
const toSq=(f,r)=>FILES[f]+(r+1);

const PIECE_UNICODE={
  'M':'⛀','K':'⛁', // white man, white king
  'm':'⛂','k':'⛃'  // black man, black king
};

/* ---------------- Engine ---------------- */
class CheckersEngine{
  constructor(){
    this.reset();
    this.history=[];
    this.mustContinueFrom=null; // square string when multi-jump is in progress
  }
  reset(){
    // 8x8 board; rank 0 at bottom (White side), rank 7 at top (Black)
    this.board=Array.from({length:8},()=>Array(8).fill(null));
    // Place white men (M) on ranks 0..2 on dark squares, black men (m) on ranks 5..7
    for(let r=0;r<3;r++){
      for(let f=0;f<8;f++){
        if(((f+r)%2)===0) this.board[r][f]='M';
      }
    }
    for(let r=5;r<8;r++){
      for(let f=0;f<8;f++){
        if(((f+r)%2)===0) this.board[r][f]='m';
      }
    }
    this.turn='w';
    this.history=[];
    this.mustContinueFrom=null;
  }
  cloneBoard(){ return this.board.map(row=>row.slice()); }
  coords(s){ return {file:FILES.indexOf(s[0]), rank:parseInt(s[1],10)-1}; }
  toSq(f,r){ return FILES[f]+(r+1); }
  inBounds(f,r){ return f>=0&&f<8&&r>=0&&r<8; }
  pieceAt(s){ const c=this.coords(s); return this.board[c.rank][c.file]; }
  setAt(s,p){ const c=this.coords(s); this.board[c.rank][c.file]=p; }
  isWhitePiece(p){ return p && p===p.toUpperCase(); }
  currentColor(){ return this.turn; }

  // Utility to collect moves
  push(ms,from,to,opts={}){ ms.push(Object.assign({from:from,to:to},opts)); }

  // Generate legal moves for current player, respecting forced capture and multi-jump continuation
  legalMoves(){
    if(this.mustContinueFrom){
      return this.legalMovesFromSquare(this.mustContinueFrom);
    }
    let captures=[], quiet=[];
    for(let r=0;r<8;r++){
      for(let f=0;f<8;f++){
        const p=this.board[r][f]; if(!p) continue;
        const color=this.isWhitePiece(p)?'w':'b';
        if(color!==this.turn) continue;
        const from=this.toSq(f,r);
        const {caps, quiets}=this.movesFor(from,p);
        for(const _m of caps) captures.push(_m);
        for(const _n of quiets) quiet.push(_n);
      }
    }
    return (captures.length>0)?captures:quiet;
  }

  legalMovesFromSquare(sq){
    const {file,rank}=this.coords(sq);
    const p=this.board[rank][file]; if(!p) return [];
    const color=this.isWhitePiece(p)?'w':'b'; if(color!==this.turn) return [];
    const {caps, quiets}=this.movesFor(sq,p);
    if(this.mustContinueFrom){
      // only captures allowed and only from that square
      return caps;
    }
    // If any capture exists anywhere on the board, non-captures are not allowed
    const anyCaps = this.anyCaptureExists();
    return anyCaps?caps:(caps.length>0?caps:quiets);
  }

  anyCaptureExists(){
    for(let r=0;r<8;r++){
      for(let f=0;f<8;f++){
        const p=this.board[r][f]; if(!p) continue;
        const color=this.isWhitePiece(p)?'w':'b';
        if(color!==this.turn) continue;
        const from=this.toSq(f,r);
        const {caps}=this.movesFor(from,p);
        if(caps.length>0) return true;
      }
    }
    return false;
  }

  movesFor(from,p){
    const {file,rank}=this.coords(from);
    const caps=[], quiets=[];
    const dirs = (p==='M')?[[1,1],[-1,1]] : (p==='m')?[[1,-1],[-1,-1]] : [[1,1],[-1,1],[1,-1],[-1,-1]];
    // Simple moves (non-captures)
    for(const [df,dr] of dirs){
      const f2=file+df, r2=rank+dr;
      if(!this.inBounds(f2,r2)) continue;
      if(this.board[r2][f2]===null){
        // Only allowed when no captures across the board
        quiets.push({from, to:this.toSq(f2,r2), capture:false});
      }
    }
    // Captures (single jump)
    for(const [df,dr] of dirs){
      const f1=file+df, r1=rank+dr;
      const f2=file+2*df, r2=rank+2*dr;
      if(!this.inBounds(f2,r2) || !this.inBounds(f1,r1)) continue;
      const over=this.board[r1][f1], dest=this.board[r2][f2];
      if(dest!==null) continue;
      if(over && (this.isWhitePiece(over)!==this.isWhitePiece(p))){
        const capturedSq=this.toSq(f1,r1);
        caps.push({from, to:this.toSq(f2,r2), capture:true, captured:capturedSq});
      }
    }
    return {caps, quiets};
  }

  makeMove(mv){
    // Save state for undo
    const snapshot={
      board:this.cloneBoard(),
      turn:this.turn,
      must:this.mustContinueFrom
    };
    this.history.push(snapshot);
    const p=this.pieceAt(mv.from);
    // Move piece
    this.setAt(mv.from, null);
    this.setAt(mv.to, p);
    // Handle capture
    if(mv.capture && mv.captured){
      this.setAt(mv.captured, null);
    }
    // Promotion (kinging)
    const {rank:toRank}=this.coords(mv.to);
    let becameKing=false;
    if(p==='M' && toRank===7){ this.setAt(mv.to,'K'); becameKing=true; }
    if(p==='m' && toRank===0){ this.setAt(mv.to,'k'); becameKing=true; }
    // Multi-jump continuation: only if a capture occurred, and piece did NOT just promote
    if(mv.capture && !becameKing){
      const contMoves=this.legalMovesFromSquare(mv.to).filter(m=>m.capture);
      if(contMoves.length>0){
        this.mustContinueFrom=mv.to;
        // Turn does not change
        return;
      }
    }
    // Otherwise turn passes
    this.mustContinueFrom=null;
    this.turn = (this.turn==='w')?'b':'w';
  }

  undoMove(){
    const prev=this.history.pop();
    if(!prev) return;
    this.board=prev.board;
    this.turn=prev.turn;
    this.mustContinueFrom=prev.must||null;
  }

  // Stubs to satisfy UI from chess version
  inCheck(){ return false; }
  attackersOf(){ return []; }
  kingSquare(){ return null; }

  // Simple "FEN-like" for checkers: rows 8->1, using . for empty, letters for pieces
  toFEN(){
    let rows=[];
    for(let r=7;r>=0;r--){
      let row="", empty=0;
      for(let f=0;f<8;f++){
        const p=this.board[r][f];
        if(p===null){ empty++; }
        else{
          if(empty>0){ row+=empty; empty=0; }
          row+=p;
        }
      }
      if(empty>0) row+=empty;
      rows.push(row.length>0?row:"8");
    }
    const act=this.turn;
    return rows.join('/')+" "+act;
  }
}


/* -------------- UI state & DOM references -------------- */
const state={
  engine:new CheckersEngine(),
  selected:null,
  legalForSelected:[],
  drag:{tracking:false,started:false,from:null,ghost:null,legal:[],startX:0,startY:0},
  aiTimer:null,
};

const board=document.getElementById('board'),
      statusEl=document.getElementById('status'),
      modeSel=document.getElementById('modeSelect'),
      levelSel=document.getElementById('aiLevel'),
      levelWrap=document.getElementById('aiLevelWrap'),
      resetBtn=document.getElementById('resetBtn'),
      promoBackdrop=document.getElementById('promoBackdrop'),
      fenBtn=document.getElementById('fenBtn'),
      toast=document.getElementById('toast'),
      filesAxis=document.getElementById('filesAxis'),
      ranksAxis=document.getElementById('ranksAxis'),
      themeSelect=document.getElementById('themeSelect');

// Hide FEN on mobile
(function(){
  const isMobile=(window.matchMedia&&window.matchMedia('(pointer:coarse)').matches)||/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if(isMobile&&fenBtn) fenBtn.style.display='none';
})();

// THEME handling
(function initTheme(){
  const saved = localStorage.getItem('theme') || 'classic';
  if(themeSelect){ themeSelect.value = saved; }
  applyTheme(saved);
  if(themeSelect){
    themeSelect.addEventListener('change',()=>{
      const v=themeSelect.value; localStorage.setItem('theme',v); applyTheme(v);
    });
  }
})();

function applyTheme(name){
  document.documentElement.setAttribute('data-theme', name);
}

// Copy position (FEN-like)
if(fenBtn){
  fenBtn.addEventListener('click', async ()=>{
    const fen=state.engine.toFEN();
    try{ await navigator.clipboard.writeText(fen); showToast('FEN copied'); }
    catch(e){
      const t=document.createElement('textarea'); t.value=fen; document.body.appendChild(t); t.select();
      try{ document.execCommand('copy'); showToast('FEN copied'); }catch(_){}
      t.remove();
    }
  });
}

function showToast(msg){
  if(!toast) return;
  toast.textContent=msg; toast.classList.remove('hidden');
  setTimeout(()=>toast.classList.add('hidden'), 1400);
}
/* -------------- Board rendering and interaction -------------- */
function buildBoard(){
  board.innerHTML='';
  const ranks=[1,2,3,4,5,6,7,8], files=['a','b','c','d','e','f','g','h'];
  for(const r of ranks){
    for(const f of files){
      const sq=f+r; const df=document.createElement('div');
      const fIndex=FILES.indexOf(f), rIndex=+r-1;
      const dark=((fIndex+rIndex)%2)===0;
      df.className='square '+(dark?'dark':'light');
      df.dataset.square=sq;
      board.appendChild(df);
    }
  }
}
function squareEl(sq){ return board.querySelector('[data-square="'+sq+'"]'); }

function renderAxes(){
  filesAxis.innerHTML=['a','b','c','d','e','f','g','h'].map(x=>`<div>${x}</div>`).join('');
  ranksAxis.innerHTML=['1','2','3','4','5','6','7','8'].map(x=>`<div>${x}</div>`).join('');
}


function renderPieces(){
  for(const d of board.children) d.innerHTML='';
  for(let r=0;r<8;r++) for(let f=0;f<8;f++){
    const p=state.engine.board[r][f]; if(!p) continue;
    const sq=FILES[f]+(r+1); const d=squareEl(sq); if(!d) continue;
    const white=isWhite(p);
    const isKing=(p==='K'||p==='k');
    const wrap=document.createElement('div');
    wrap.className='piece checker '+(white?'white':'black')+(isKing?' king':'');
    const disk=document.createElement('div');
    disk.className='disk';
    wrap.appendChild(disk);
    if(isKing){
      const ring=document.createElement('div');
      ring.className='ring'; // small inner ring to signify king
      wrap.appendChild(ring);
    }
    d.appendChild(wrap);
  }
  highlightAttackers();
}

function clearHighlights(){
  for(const d of board.children) d.classList.remove('highlight-origin','highlight-move','highlight-capture','highlight-check','highlight-attacker');
}
function clearCheckOnly(){
  for(const d of board.children) d.classList.remove('highlight-check','highlight-attacker');
}
function highlightAttackers(){ /* not used in checkers */ }

function highlightMoves(from,mvs){
  clearHighlights();
  const fd=squareEl(from); if(fd) fd.classList.add('highlight-origin');
  for(const m of mvs){
    const d=squareEl(m.to); if(!d) continue;
    d.classList.add(m.capture||m.enPassant?'highlight-capture':'highlight-move');
  }
}


function updateStatus(){
  const e=state.engine;
  const moves=e.legalMoves();
  // Count pieces
  let wPieces=0, bPieces=0;
  for(let r=0;r<8;r++) for(let f=0;f<8;f++){ const p=e.board[r][f]; if(!p) continue; if(p===p.toUpperCase()) wPieces++; else bPieces++; }
  if(wPieces===0){ statusEl.textContent='Black wins — White has no pieces'; return; }
  if(bPieces===0){ statusEl.textContent='White wins — Black has no pieces'; return; }
  if(moves.length===0){
    const winner=e.turn==='w'?'Black':'White';
    statusEl.textContent='No moves — '+winner+' wins';
    return;
  }
  let status=(modeSel && modeSel.value==='ai')?(e.turn==='w'?'White (You)':'Black (AI)'):(e.turn==='w'?'White':'Black');
  if(e.mustContinueFrom){
    status += ' to move (continue captures)';
  }else{
    status += ' to move';
  }
  statusEl.textContent=status;
  if (modeSel && modeSel.value==='ai' && e.turn==='b') scheduleAI();
}

function centerOfSquare(sq){
  const el=squareEl(sq); const r=el.getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2};
}

function animateMoveCentered(from,to,piece,done){
  const start=centerOfSquare(from), end=centerOfSquare(to);
  const ghost=document.createElement('div'); ghost.className='piece anim-ghost '+(isWhite(piece)?'white':'black');
  if(piece==='K'||piece==='k'){ ghost.classList.add('king'); }
ghost.textContent=PIECE_UNICODE[piece];
  ghost.style.left=start.x+'px'; ghost.style.top=start.y+'px';
  document.body.appendChild(ghost);
  const fromEl=squareEl(from), toEl=squareEl(to);
  const fromPieceEl=fromEl&&fromEl.firstChild; if(fromPieceEl) fromPieceEl.style.visibility='hidden';
  const toPieceEl=toEl&&toEl.firstChild; if(toPieceEl) toPieceEl.style.visibility='hidden';
  const dx=end.x-start.x, dy=end.y-start.y;
  void ghost.getBoundingClientRect();
  requestAnimationFrame(()=>{
    ghost.style.transform=`translate(-50%, -50%) translate3d(${dx}px, ${dy}px, 0)`;
    let finished=false;
    const finish=()=>{ if(finished) return; finished=true; ghost.remove(); if(fromPieceEl) fromPieceEl.style.visibility=''; if(toPieceEl) toPieceEl.style.visibility=''; done&&done(); };
    const safety=setTimeout(finish, 350);
    ghost.addEventListener('transitionend',()=>{ clearTimeout(safety); finish(); },{once:true});
  });
}

function onSquareClick(sq){
  const piece=state.engine.pieceAt(sq);
  if(state.selected&&Array.isArray(state.legalForSelected)){
    const mv=state.legalForSelected.find(m=>m.to===sq);
    if(mv){ tryMakeMove(mv); return; }
  }
  if(!piece) return;
  if(modeSel.value==='ai'&&state.engine.turn==='b') return;
  const color=isWhite(piece)?'w':'b'; if(state.engine.turn!==color) return;
  if(state.selected===sq){
    state.selected=null; state.legalForSelected=[]; clearHighlights(); highlightAttackers(); return;
  }
  state.selected=sq;
  const mvs=state.engine.legalMovesFromSquare(sq);
  state.legalForSelected=mvs; highlightMoves(sq,mvs);
}

board.addEventListener('click',(e)=>{ const cell=e.target.closest('.square'); if(!cell) return; onSquareClick(cell.dataset.square); });

board.addEventListener('pointerdown',(e)=>{
  const cell=e.target.closest('.square'); if(!cell) return;
  const sq=cell.dataset.square; const p=state.engine.pieceAt(sq); if(!p) return;
  if(modeSel.value==='ai'&&state.engine.turn==='b') return;
  if(e.pointerType==='mouse'&&e.button!==0) return;
  const color=isWhite(p)?'w':'b'; if(state.engine.turn!==color) return;
  state.drag.tracking=true; state.drag.started=false; state.drag.from=sq;
  state.drag.legal=state.engine.legalMovesFromSquare(sq);
  state.drag.startX=e.clientX; state.drag.startY=e.clientY;
});

board.addEventListener('pointermove',(e)=>{
  if(!state.drag.tracking) return;
  const dx=e.clientX-state.drag.startX,dy=e.clientY-state.drag.startY;
  if(!state.drag.started&&Math.hypot(dx,dy)<6) return;
  if(!state.drag.started){
    const p=state.engine.pieceAt(state.drag.from); if(!p){ state.drag.tracking=false; return; }
    const start=centerOfSquare(state.drag.from);
    const ghost=document.createElement('div'); ghost.className='piece drag-ghost '+(isWhite(p)?'white':'black');
    if(p==='K'||p==='k'){ ghost.classList.add('king'); }
ghost.textContent=PIECE_UNICODE[p]; ghost.style.left=start.x+'px'; ghost.style.top=start.y+'px';
    document.body.appendChild(ghost); state.drag.ghost=ghost; state.drag.started=true;
    clearHighlights(); highlightMoves(state.drag.from,state.drag.legal);
  }
  if(state.drag.ghost){ state.drag.ghost.style.left=e.clientX+'px'; state.drag.ghost.style.top=e.clientY+'px'; }
});

function endDragLike(x,y){
  if(!state.drag.tracking) return;
  const was=state.drag.started; const ghost=state.drag.ghost; if(ghost) ghost.remove(); state.drag.ghost=null;
  let targetSq=null; const el=document.elementFromPoint(x,y); const sqEl=el&&el.closest?el.closest('.square'):null;
  if(sqEl) targetSq=sqEl.dataset.square;
  const mv=targetSq?state.drag.legal.find(m=>m.to===targetSq):null;
  state.drag.tracking=false; state.drag.started=false;
  if(was){
    if(mv) tryMakeMove(mv);
    else { state.selected=null; state.legalForSelected=[]; clearHighlights(); highlightAttackers(); }
  }
}
board.addEventListener('pointerup',(e)=>endDragLike(e.clientX,e.clientY));
board.addEventListener('pointercancel',(e)=>endDragLike(e.clientX,e.clientY));


function tryMakeMove(mv){
  const e=state.engine;
  const fromP=e.pieceAt(mv.from);
  const doAfter=()=>{
    // If continuation is required, keep selection on the landing square and show only capture moves
    if(e.mustContinueFrom){
      state.selected = e.mustContinueFrom;
      state.legalForSelected = e.legalMovesFromSquare(state.selected);
      clearHighlights(); highlightMoves(state.selected, state.legalForSelected);
      renderPieces(); updateStatus();
      return;
    }
    state.selected=null; state.legalForSelected=[]; clearHighlights();
    renderPieces(); updateStatus();
    if(modeSel && modeSel.value==='ai') scheduleAI();
  };
  animateMoveCentered(mv.from, mv.to, fromP, ()=>{ e.makeMove(mv); doAfter(); });
}


/* -------------- Checkers AI -------------- */
function aiChooseMove(engine){
  // Levels: 0=random, 1=greedy 1-ply, 2=minimax (depth 4 plies)
  const levels=[{depth:0},{depth:1},{depth:4}];
  const idx = levelSel ? +levelSel.value : 1;
  const level = levels[idx] || levels[1];

  function evalBoard(e){
    let score=0;
    for(let r=0;r<8;r++) for(let f=0;f<8;f++){
      const p=e.board[r][f]; if(!p) continue;
      const val = (p==='M'||p==='m')?100:180;
      score += (p===p.toUpperCase()?1:-1)*val;
    }
    return score; // + favors White, - favors Black
  }

  if(level.depth===0){
    const list=engine.legalMoves();
    const caps=list.filter(m=>m.capture);
    const pool = caps.length?caps:list;
    return pool[Math.floor(Math.random()*pool.length)]||null;
  }

  function search(depth, maximizing){
    const list=engine.legalMoves();
    if(depth===0 || list.length===0){ return {score: evalBoard(engine)}; }
    let bestMv=null;
    if(maximizing){ // White
      let best=-1e9;
      for(const mv of list){
        engine.makeMove(mv);
        const res=search(depth-1, engine.turn==='w');
        engine.undoMove();
        if(res.score>best){ best=res.score; bestMv=mv; }
      }
      return {score:best, move:bestMv};
    }else{ // Black
      let best=1e9;
      for(const mv of list){
        engine.makeMove(mv);
        const res=search(depth-1, engine.turn!=='w');
        engine.undoMove();
        if(res.score<best){ best=res.score; bestMv=mv; }
      }
      return {score:best, move:bestMv};
    }
  }

  if(level.depth===1){
    let best=null, bestScore=1e9;
    const list=engine.legalMoves();
    for(const mv of list){
      engine.makeMove(mv);
      const s=evalBoard(engine);
      engine.undoMove();
      if(s<bestScore){ bestScore=s; best=mv; }
    }
    return best || list[0] || null;
  }else{
    const res=search(level.depth, false);
    return res.move || null;
  }
}

function aiMove(){
  if (!modeSel || modeSel.value!=='ai' || state.engine.turn!=='b') return;
  const mv=aiChooseMove(state.engine);
  if(!mv){ renderPieces(); updateStatus(); return; }
  const fromP=state.engine.pieceAt(mv.from);
  animateMoveCentered(mv.from,mv.to,fromP,()=>{ 
    state.engine.makeMove(mv); 
    renderPieces(); 
    updateStatus();
    if(state.engine.turn==='b' && state.engine.mustContinueFrom){
      scheduleAI();
    }
  });
}
function scheduleAI(){
  if (modeSel.value!=='ai' || state.engine.turn!=='b') return;
  clearTimeout(state.aiTimer);
  state.aiTimer = setTimeout(aiMove, 250);
}

/* -------------- Promotion dialog -------------- */
function openPromotion(){
  const backdrop=document.getElementById('promoBackdrop');
  const whiteTurn = state.engine.turn === 'w';
  const icons = whiteTurn
    ? { q: PIECE_UNICODE['Q'], r: PIECE_UNICODE['R'], b: PIECE_UNICODE['B'], n: PIECE_UNICODE['N'] }
    : { q: PIECE_UNICODE['q'], r: PIECE_UNICODE['r'], b: PIECE_UNICODE['b'], n: PIECE_UNICODE['n'] };
  backdrop.querySelectorAll('.promo-choices button').forEach(btn=>{
    const code=btn.getAttribute('data-piece');
    const span=btn.querySelector('.promo-icon');
    if(span && icons[code]) span.textContent = icons[code];
  });
  backdrop.classList.remove('hidden');
  return new Promise(resolve=>{
    const handler=(ev)=>{
      const btn=ev.target.closest('button[data-piece]');
      if(!btn) return;
      const code=btn.dataset.piece; cleanup(); resolve(code);
    };
    const cleanup=()=>{ backdrop.classList.add('hidden'); backdrop.removeEventListener('click', handler); };
    backdrop.addEventListener('click', handler);
  });
}

function renderAxesAndBoard(){ buildBoard(); renderPieces(); renderAxes(); }
function resetGame(){
  state.engine.reset();
  state.selected=null; state.legalForSelected=[]; clearHighlights();
  renderAxesAndBoard(); updateStatus(); if(modeSel.value==='ai') scheduleAI();
}

document.getElementById('resetBtn').addEventListener('click', resetGame);

(function init(){
  renderAxesAndBoard(); updateStatus();
  if(modeSel.value==='ai') scheduleAI();
})();