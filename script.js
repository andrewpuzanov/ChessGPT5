
/* Classic Chess — v24j-patch4 (stable base + FEN copy + safe animation fallback) */
const FILES=['a','b','c','d','e','f','g','h'];
const FILE_IDX={a:0,b:1,c:2,d:3,e:4,f:5,g:6,h:7};
const START_FEN="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const isWhite=p=>p===p.toUpperCase();
const inBounds=(f,r)=>f>=0&&f<8&&r>=0&&r<8;
const cloneBoard=b=>b.map(r=>r.slice());
const toSq=(f,r)=>FILES[f]+(r+1);

/* Swapped glyphs per our earlier fix */
const PIECE_UNICODE={'P':'♙','N':'♘','B':'♗','R':'♖','Q':'♔','K':'♕','p':'♟','n':'♞','b':'♝','r':'♜','q':'♚','k':'♛'};

class ChessEngine{
  constructor(fen=START_FEN){ this.loadFEN(fen); this.history=[]; this.positionCounts=new Map(); this.recordPosition(); }
  reset(){ this.loadFEN(START_FEN); this.history=[]; this.positionCounts=new Map(); this.recordPosition(); }

  loadFEN(fen){
    const [placement,active,castling,ep,half,full]=fen.trim().split(/\s+/);
    const rows=placement.split('/');
    this.board=Array.from({length:8},()=>Array(8).fill(null));
    for(let fr=0; fr<8; fr++){
      let f=0;
      for(const ch of rows[fr]){
        if (/[1-8]/.test(ch)) f += parseInt(ch,10);
        else this.board[7-fr][f++] = ch;
      }
    }
    this.turn = active==='w'?'w':'b';
    this.castling={K:false,Q:false,k:false,q:false};
    if (castling && castling!=='-') for (const c of castling) if (this.castling.hasOwnProperty(c)) this.castling[c]=true;
    this.ep = ep !== '-' ? ep : null;
    this.halfmove = half?parseInt(half,10):0;
    this.fullmove = full?parseInt(full,10):1;
  }
  toFEN(){
    let placement='';
    for(let r=7;r>=0;r--){
      let empty=0;
      for(let f=0;f<8;f++){
        const p=this.board[r][f];
        if(!p) empty++; else { if(empty){ placement+=empty; empty=0; } placement+=p; }
      }
      if(empty) placement+=empty;
      if(r>0) placement+='/';
    }
    let cast=''; if(this.castling.K)cast+='K'; if(this.castling.Q)cast+='Q'; if(this.castling.k)cast+='k'; if(this.castling.q)cast+='q'; if(!cast) cast='-';
    const ep=this.ep?this.ep:'-';
    return `${placement} ${this.turn} ${cast} ${ep} ${this.halfmove} ${this.fullmove}`;
  }
  coords(sq){ return {file: FILE_IDX[sq[0]], rank: parseInt(sq[1],10)-1}; }
  pieceAt(sq){ const {file,rank}=this.coords(sq); return this.board[rank][file]; }
  kingSquare(color){ const t=color==='w'?'K':'k'; for(let r=0; r<8; r++) for(let f=0; f<8; f++) if(this.board[r][f]===t) return toSq(f,r); return null; }

  generateMoves(forColor=this.turn){
    const moves=[];
    for(let r=0;r<8;r++) for(let f=0;f<8;f++){
      const p=this.board[r][f]; if(!p) continue;
      const color=isWhite(p)?'w':'b'; if(color!==forColor) continue;
      const from=toSq(f,r);
      switch(p.toLowerCase()){
        case 'p': this.genPawn(from,p,moves); break;
        case 'n': this.genKnight(from,p,moves); break;
        case 'b': this.genSlide(from,p,moves,[[1,1],[1,-1],[-1,1],[-1,-1]]); break;
        case 'r': this.genSlide(from,p,moves,[[1,0],[-1,0],[0,1],[0,-1]]); break;
        case 'q': this.genSlide(from,p,moves,[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]); break;
        case 'k': this.genKing(from,p,moves); break;
      }
    }
    return moves;
  }
  push(moves,from,to,opts={}){ moves.push({from,to,...opts}); }

  genPawn(from,p,moves){
    const w=isWhite(p), dir=w?1:-1;
    const {file,rank}=this.coords(from);
    const start=w?1:6, last=w?7:0;
    const r1=rank+dir;
    if (inBounds(file,r1) && !this.board[r1][file]){
      const to=toSq(file,r1);
      if (r1===last) ['q','r','b','n'].forEach(pr=>this.push(moves,from,to,{promotion:pr}));
      else {
        this.push(moves,from,to);
        const r2=rank+2*dir;
        if (rank===start && !this.board[r2][file]) this.push(moves,from,toSq(file,r2));
      }
    }
    for (const df of [-1,1]){
      const f2=file+df, r2=rank+dir; if(!inBounds(f2,r2)) continue;
      const tgt=this.board[r2][f2]; const to=toSq(f2,r2);
      if (tgt && isWhite(tgt)!==w){
        if (r2===last) ['q','r','b','n'].forEach(pr=>this.push(moves,from,to,{capture:tgt,promotion:pr}));
        else this.push(moves,from,to,{capture:tgt});
      }
    }
    if (this.ep){
      const {file:ef,rank:er}=this.coords(this.ep);
      if (er===rank+dir && Math.abs(ef-file)===1) this.push(moves,from,toSq(ef,er),{enPassant:true,capture:w?'p':'P'});
    }
  }
  genKnight(from,p,moves){
    const {file,rank}=this.coords(from);
    const deltas=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
    for (const [df,dr] of deltas){
      const f2=file+df, r2=rank+dr; if(!inBounds(f2,r2)) continue;
      const tgt=this.board[r2][f2]; const to=toSq(f2,r2);
      if (!tgt) this.push(moves,from,to);
      else if (isWhite(tgt)!==isWhite(p)) this.push(moves,from,to,{capture:tgt});
    }
  }
  genSlide(from,p,moves,dirs){
    const {file,rank}=this.coords(from);
    for (const [df,dr] of dirs){
      let f=file+df, r=rank+dr;
      while (inBounds(f,r)){
        const tgt=this.board[r][f]; const to=toSq(f,r);
        if (!tgt) this.push(moves,from,to);
        else { if (isWhite(tgt)!==isWhite(p)) this.push(moves,from,to,{capture:tgt}); break; }
        f+=df; r+=dr;
      }
    }
  }
  genKing(from,p,moves){
    const {file,rank}=this.coords(from);
    for (let df=-1; df<=1; df++) for (let dr=-1; dr<=1; dr++){
      if (df===0 && dr===0) continue;
      const f2=file+df, r2=rank+dr; if(!inBounds(f2,r2)) continue;
      const tgt=this.board[r2][f2]; const to=toSq(f2,r2);
      if (!tgt) this.push(moves,from,to);
      else if (isWhite(tgt)!==isWhite(p)) this.push(moves,from,to,{capture:tgt});
    }
    const w=isWhite(p), home=w?0:7;
    if (file===4 && rank===home){
      if ((w&&this.castling.K)||(!w&&this.castling.k)){
        if (!this.board[home][5] && !this.board[home][6]) this.push(moves,from,toSq(6,home),{castle:w?'K':'k'});
      }
      if ((w&&this.castling.Q)||(!w&&this.castling.q)){
        if (!this.board[home][1] && !this.board[home][2] && !this.board[home][3]) this.push(moves,from,toSq(2,home),{castle:w?'Q':'q'});
      }
    }
  }

  isSquareAttacked(sq, byColor){
    const {file,rank}=this.coords(sq);
    const white=(byColor==='w');
    const pawnDir=white?1:-1;
    for (const df of [-1,1]){
      const f=file+df, r=rank-pawnDir;
      if (inBounds(f,r)){ const p=this.board[r][f]; if (p && isWhite(p)===white && p.toLowerCase()==='p') return true; }
    }
    const nd=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
    for (const [df,dr] of nd){
      const f=file+df, r=rank+dr; if(!inBounds(f,r)) continue;
      const p=this.board[r][f]; if (p && isWhite(p)===white && p.toLowerCase()==='n') return true;
    }
    const diag=[[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [df,dr] of diag){
      let f=file+df, r=rank+dr;
      while (inBounds(f,r)){
        const p=this.board[r][f];
        if (p){ if (isWhite(p)===white){ const t=p.toLowerCase(); if (t==='b'||t==='q') return true; } break; }
        f+=df; r+=dr;
      }
    }
    const ortho=[[1,0],[-1,0],[0,1],[0,-1]];
    for (const [df,dr] of ortho){
      let f=file+df, r=rank+dr;
      while (inBounds(f,r)){
        const p=this.board[r][f];
        if (p){ if (isWhite(p)===white){ const t=p.toLowerCase(); if (t==='r'||t==='q') return true; } break; }
        f+=df; r+=dr;
      }
    }
    for (let df=-1; df<=1; df++) for (let dr=-1; dr<=1; dr++){
      if (df===0 && dr===0) continue;
      const f=file+df, r=rank+dr; if(!inBounds(f,r)) continue;
      const p=this.board[r][f]; if (p && isWhite(p)===white && p.toLowerCase()==='k') return true;
    }
    return false;
  }
  inCheck(color=this.turn){ const ksq=this.kingSquare(color); const opp=color==='w'?'b':'w'; return this.isSquareAttacked(ksq, opp); }

  legalMoves(){
    const pseudo=this.generateMoves(this.turn);
    const me=this.turn, opp=me==='w'?'b':'w';
    const legal=[]; const inCheckNow=this.inCheck(me);
    for (const mv of pseudo){
      if (mv.castle){
        if (inCheckNow) continue;
        const from=this.coords(mv.from);
        const midFile=(mv.to[0]==='g')?5:3;
        const midSq=toSq(midFile, from.rank);
        if (this.isSquareAttacked(midSq, opp)) continue;
      }
      this.makeMove(mv, true);
      const illegal=this.inCheck(me);
      this.undoMove();
      if (!illegal) legal.push(mv);
    }
    return legal;
  }
  legalMovesFromSquare(sq){
    const p=this.pieceAt(sq); if(!p) return [];
    const pseudo=[]; const lower=p.toLowerCase();
    switch(lower){
      case 'p': this.genPawn(sq,p,pseudo); break;
      case 'n': this.genKnight(sq,p,pseudo); break;
      case 'b': this.genSlide(sq,p,pseudo,[[1,1],[1,-1],[-1,1],[-1,-1]]); break;
      case 'r': this.genSlide(sq,p,pseudo,[[1,0],[-1,0],[0,1],[0,-1]]); break;
      case 'q': this.genSlide(sq,p,pseudo,[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]); break;
      case 'k': this.genKing(sq,p,pseudo); break;
    }
    const me=this.turn, opp=me==='w'?'b':'w'; const inCheckNow=this.inCheck(me);
    const legal=[];
    for (const mv of pseudo){
      if (lower==='k' && mv.castle){
        if (inCheckNow) continue;
        const from=this.coords(mv.from);
        const midFile=(mv.to[0]==='g')?5:3;
        const midSq=toSq(midFile, from.rank);
        if (this.isSquareAttacked(midSq, opp)) continue;
      }
      this.makeMove(mv, true);
      const illegal=this.inCheck(me);
      this.undoMove();
      if (!illegal) legal.push(mv);
    }
    return legal;
  }

  makeMove(mv, trial=false){
    const {from,to,promotion,castle,enPassant}=mv;
    const fromC=this.coords(from), toC=this.coords(to);
    const piece=this.board[fromC.rank][fromC.file];
    const captured=this.board[toC.rank][toC.file];

    const snap={ board: cloneBoard(this.board), turn:this.turn, castling:{...this.castling}, ep:this.ep, halfmove:this.halfmove, fullmove:this.fullmove };
    this.history.push(snap);

    if (piece.toLowerCase()==='p' || captured || enPassant) this.halfmove=0; else this.halfmove++;

    this.board[toC.rank][toC.file]=piece;
    this.board[fromC.rank][fromC.file]=null;

    if (enPassant){
      const dir=(this.turn==='w')?1:-1;
      const capRank=toC.rank - dir;
      this.board[capRank][toC.file]=null;
    }

    this.ep=null;
    if (piece.toLowerCase()==='p' && Math.abs(toC.rank-fromC.rank)===2){
      const epRank=(fromC.rank+toC.rank)/2;
      this.ep=toSq(fromC.file, epRank);
    }

    if (promotion && piece.toLowerCase()==='p'){
      this.board[toC.rank][toC.file] = isWhite(piece) ? promotion.toUpperCase() : promotion.toLowerCase();
    }

    if (castle){
      const isW=(this.turn==='w'); const rRank=isW?0:7;
      if (castle===(isW?'K':'k')){ this.board[rRank][5]=this.board[rRank][7]; this.board[rRank][7]=null; }
      else { this.board[rRank][3]=this.board[rRank][0]; this.board[rRank][0]=null; }
    }

    this.updateCastlingRights(from,to,piece,captured);

    if (this.turn==='b') this.fullmove++;
    this.turn = (this.turn==='w') ? 'b' : 'w';

    if (!trial) this.recordPosition();
  }
  updateCastlingRights(from,to,piece,captured){
    const isW=isWhite(piece);
    if (piece.toLowerCase()==='k'){ if (isW){ this.castling.K=false; this.castling.Q=false; } else { this.castling.k=false; this.castling.q=false; } }
    if (piece.toLowerCase()==='r'){
      if (from==='h1') this.castling.K=false;
      if (from==='a1') this.castling.Q=false;
      if (from==='h8') this.castling.k=false;
      if (from==='a8') this.castling.q=false;
    }
    if (to==='h1') this.castling.K=false;
    if (to==='a1') this.castling.Q=false;
    if (to==='h8') this.castling.k=false;
    if (to==='a8') this.castling.q=false;
  }
  undoMove(){
    const s=this.history.pop(); if(!s) return;
    this.board = cloneBoard(s.board);
    this.turn = s.turn;
    this.castling = {...s.castling};
    this.ep = s.ep;
    this.halfmove = s.halfmove;
    this.fullmove = s.fullmove;
  }
  recordPosition(){ const key=this.toFEN().split(' ').slice(0,4).join(' '); this.positionCounts.set(key,(this.positionCounts.get(key)||0)+1); }
  isThreefold(){ for (const c of this.positionCounts.values()) if (c>=3) return true; return false; }
  inCheckmate(){ return this.inCheck(this.turn) && this.legalMoves().length===0; }
  inStalemate(){ return !this.inCheck(this.turn) && this.legalMoves().length===0; }
  isDrawBy50Move(){ return this.halfmove>=100; }
  insufficientMaterial(){
    let pcs=[]; for(let r=0;r<8;r++) for(let f=0;f<8;f++){ const p=this.board[r][f]; if(p) pcs.push({p,r,f}); }
    const non=pcs.filter(x=>x.p.toLowerCase()!=='k'); if(non.length===0) return true;
    if(non.length===1){ const t=non[0].p.toLowerCase(); if(t==='b'||t==='n') return true; }
    if(non.length===2){ const t1=non[0].p.toLowerCase(),t2=non[1].p.toLowerCase(); if(t1==='b'&&t2==='b'){ const c1=(non[0].r+non[0].f)%2, c2=(non[1].r+non[1].f)%2; if(c1===c2) return true; } }
    return false;
  }
  attackersOf(color){
    const opp=color==='w'?'b':'w'; const ksq=this.kingSquare(color); if(!ksq) return [];
    const pse=this.generateMoves(opp); const froms=[]; for(const mv of pse) if(mv.to===ksq) froms.push(mv.from); return [...new Set(froms)];
  }
}

/* ===== UI ===== */
const state={ engine:new ChessEngine(START_FEN), selected:null, legalForSelected:[], drag:{tracking:false,started:false,from:null,ghost:null,legal:[],startX:0,startY:0} };

const board=document.getElementById('board'); const statusEl=document.getElementById('status');
const modeSel=document.getElementById('modeSelect'); const resetBtn=document.getElementById('resetBtn');
const promoBackdrop=document.getElementById('promoBackdrop'); const fenBtn=document.getElementById('fenBtn'); const toast=document.getElementById('toast');
const filesAxis=document.getElementById('filesAxis'); const ranksAxis=document.getElementById('ranksAxis');

(function hideFenOnMobile(){
  const isMobile = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile && fenBtn) fenBtn.style.display='none';
})();

function showToast(msg){ toast.textContent=msg; toast.classList.remove('hidden'); setTimeout(()=>toast.classList.add('hidden'), 2200); }

// Copy FEN
if (fenBtn){
  fenBtn.addEventListener('click', async ()=>{
    const fen = state.engine.toFEN();
    try{
      await navigator.clipboard.writeText(fen);
      showToast('FEN copied');
    }catch(e){
      const t=document.createElement('textarea'); t.value=fen; document.body.appendChild(t); t.select();
      try{ document.execCommand('copy'); showToast('FEN copied'); }catch(_){}
      t.remove();
    }
  });
}

function buildBoard(){
  board.innerHTML='';
  const ranks=[1,2,3,4,5,6,7,8];
  const files=['a','b','c','d','e','f','g','h'];
  for(const r of ranks){
    for(const f of files){
      const sq=f+r;
      const df=document.createElement('div');
      const fIndex = FILES.indexOf(f);
      const rIndex = parseInt(r,10)-1;
      const isDark = ((fIndex + rIndex) % 2) === 0;
      df.className='square '+(isDark?'dark':'light');
      df.dataset.square=sq;
      board.appendChild(df);
    }
  }
}
function renderAxes(){
  filesAxis.innerHTML = ['a','b','c','d','e','f','g','h'].map(x=>`<div>${x}</div>`).join('');
  ranksAxis.innerHTML = ['1','2','3','4','5','6','7','8'].map(x=>`<div>${x}</div>`).join('');
}
function squareEl(sq){ return board.querySelector('[data-square="'+sq+'"]'); }
function clearHighlights(){ for(const d of board.children) d.classList.remove('highlight-origin','highlight-move','highlight-capture','highlight-check','highlight-attacker'); }
function clearCheckOnly(){ for(const d of board.children) d.classList.remove('highlight-check','highlight-attacker'); }
function highlightAttackers(){ clearCheckOnly(); if(state.engine.inCheck()){ const ksq=state.engine.kingSquare(state.engine.turn); const kd=squareEl(ksq); if(kd) kd.classList.add('highlight-check'); for(const a of state.engine.attackersOf(state.engine.turn)){ const ad=squareEl(a); if(ad) ad.classList.add('highlight-attacker'); } } }

function renderPieces(){
  for(const d of board.children) d.innerHTML='';
  for(let r=0;r<8;r++) for(let f=0;f<8;f++){
    const p=state.engine.board[r][f]; if(!p) continue;
    const sq=FILES[f]+(r+1); const d=squareEl(sq); if(!d) continue;
    const el=document.createElement('div'); el.className='piece '+(isWhite(p)?'white':'black'); el.textContent=PIECE_UNICODE[p];
    d.appendChild(el);
  }
  highlightAttackers();
}
function highlightMoves(from,moves){
  clearHighlights(); const fromDiv=squareEl(from); if (fromDiv) fromDiv.classList.add('highlight-origin');
  for(const m of moves){ const d=squareEl(m.to); if(!d) continue; d.classList.add(m.capture||m.enPassant?'highlight-capture':'highlight-move'); }
}
function updateStatus(){
  const e=state.engine;
  const ai = modeSel.value==='ai';
  let status = ai ? (e.turn==='w'?'White (You)':'Black (AI)') : (e.turn==='w'?'White':'Black');
  status += ' to move';
  if (e.inCheck()) status += ' — ' + (e.turn==='w'?'White':'Black') + ' is in check';
  if (e.inCheckmate()) status='Checkmate! '+(e.turn==='w'?'Black':'White')+' wins.';
  else if (e.inStalemate()) status='Draw by stalemate.';
  else if (e.isThreefold()) status='Draw by repetition.';
  else if (e.insufficientMaterial()) status='Draw by insufficient material.';
  else if (e.isDrawBy50Move()) status='Draw by 50-move rule.';
  statusEl.textContent=status;
}

function centerOfSquare(sq){ const el=squareEl(sq); const r=el.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; }
function animateMoveCentered(from, to, piece, done){
  const start=centerOfSquare(from), end=centerOfSquare(to);
  const ghost=document.createElement('div');
  ghost.className='piece anim-ghost ' + (isWhite(piece)?'white':'black');
  ghost.textContent=PIECE_UNICODE[piece];
  ghost.style.left=start.x+'px'; ghost.style.top=start.y+'px';
  document.body.appendChild(ghost);

  const fromEl=squareEl(from); const toEl=squareEl(to);
  const fromPieceEl=fromEl&&fromEl.firstChild; if(fromPieceEl) fromPieceEl.style.visibility='hidden';
  const toPieceEl=toEl&&toEl.firstChild; if(toPieceEl) toPieceEl.style.visibility='hidden';

  const dx=end.x-start.x, dy=end.y-start.y;
  // Force reflow to ensure transition starts (Safari/iOS)
  void ghost.getBoundingClientRect();
  requestAnimationFrame(()=>{
    ghost.style.transform=`translate(-50%, -50%) translate3d(${dx}px, ${dy}px, 0)`;
    let finished=false;
    const finish=()=>{
      if (finished) return;
      finished=true;
      ghost.remove();
      if(fromPieceEl) fromPieceEl.style.visibility='';
      if(toPieceEl) toPieceEl.style.visibility='';
      done&&done();
    };
    const safety = setTimeout(finish, 300); // fallback in case 'transitionend' is missed
    ghost.addEventListener('transitionend', ()=>{ clearTimeout(safety); finish(); }, {once:true});
  });
}

function onSquareClick(sq){
  const piece = state.engine.pieceAt(sq);
  if (state.selected && Array.isArray(state.legalForSelected)){
    const mv=state.legalForSelected.find(m=>m.to===sq);
    if (mv){ tryMakeMove(mv); return; }
  }
  if (!piece){ return; }
  if (modeSel.value==='ai' && state.engine.turn==='b') return;
  const color = isWhite(piece)?'w':'b'; if (state.engine.turn!==color) return;
  if (state.selected===sq){ state.selected=null; state.legalForSelected=[]; clearHighlights(); highlightAttackers(); return; }
  state.selected=sq; const moves=state.engine.legalMovesFromSquare(sq); state.legalForSelected=moves; highlightMoves(sq,moves);
}
board.addEventListener('click', (e)=>{ const cell=e.target.closest('.square'); if(!cell) return; onSquareClick(cell.dataset.square); });

board.addEventListener('pointerdown', (e)=>{
  const cell=e.target.closest('.square'); if(!cell) return;
  const sq=cell.dataset.square; const p=state.engine.pieceAt(sq); if(!p) return;
  if (modeSel.value==='ai' && state.engine.turn==='b') return;
  if (e.pointerType==='mouse' && e.button!==0) return;
  const color=isWhite(p)?'w':'b'; if (state.engine.turn!==color) return;
  state.drag.tracking=true; state.drag.started=false; state.drag.from=sq; state.drag.legal=state.engine.legalMovesFromSquare(sq);
  state.drag.startX=e.clientX; state.drag.startY=e.clientY;
});
board.addEventListener('pointermove', (e)=>{
  if(!state.drag.tracking) return;
  const dx=e.clientX-state.drag.startX, dy=e.clientY-state.drag.startY;
  if (!state.drag.started && Math.hypot(dx,dy)<6) return;
  if (!state.drag.started){
    const p=state.engine.pieceAt(state.drag.from); if(!p){ state.drag.tracking=false; return; }
    const start=centerOfSquare(state.drag.from);
    const ghost=document.createElement('div');
    ghost.className='piece drag-ghost ' + (isWhite(p)?'white':'black');
    ghost.textContent=PIECE_UNICODE[p];
    ghost.style.left=start.x+'px'; ghost.style.top=start.y+'px';
    document.body.appendChild(ghost);
    state.drag.ghost=ghost;
    clearHighlights(); highlightMoves(state.drag.from, state.drag.legal);
    state.drag.started=true;
  }
  if(state.drag.ghost){ state.drag.ghost.style.left=e.clientX+'px'; state.drag.ghost.style.top=e.clientY+'px'; }
});
function endDragLike(clientX, clientY){
  if(!state.drag.tracking) return;
  const wasDragging=state.drag.started;
  const ghost=state.drag.ghost; if(ghost) ghost.remove();
  state.drag.ghost=null;
  let targetSq=null; const el=document.elementFromPoint(clientX,clientY); const sqEl=el && el.closest? el.closest('.square'):null;
  if (sqEl) targetSq=sqEl.dataset.square;
  const mv=targetSq ? state.drag.legal.find(m=>m.to===targetSq) : null;
  state.drag.tracking=false; state.drag.started=false;
  if (wasDragging){
    if (mv) tryMakeMove(mv); else { state.selected=null; state.legalForSelected=[]; clearHighlights(); highlightAttackers(); }
  }
}
board.addEventListener('pointerup', (e)=> endDragLike(e.clientX,e.clientY));
board.addEventListener('pointercancel', (e)=> endDragLike(e.clientX,e.clientY));

function tryMakeMove(mv){
  const e=state.engine; const fromP=e.pieceAt(mv.from); const toRank=parseInt(mv.to[1],10);
  const needsPromo = fromP && fromP.toLowerCase()==='p' && (toRank===8||toRank===1) && !mv.promotion;
  const doAfter=()=>{ state.selected=null; state.legalForSelected=[]; clearHighlights(); renderPieces(); updateStatus(); if (modeSel.value==='ai') scheduleAI(); };
  if (needsPromo){
    animateMoveCentered(mv.from, mv.to, fromP, ()=>{ openPromotion().then(code=>{ e.makeMove({...mv,promotion:code||'q'}); doAfter(); }); });
  } else {
    animateMoveCentered(mv.from, mv.to, fromP, ()=>{ e.makeMove(mv); doAfter(); });
  }
}
function aiMove(){
  const e=state.engine; const moves=e.legalMoves(); if(!moves.length) return;
  const mv=moves[Math.floor(Math.random()*moves.length)]; const fromP=e.pieceAt(mv.from);
  animateMoveCentered(mv.from, mv.to, fromP, ()=>{ e.makeMove(mv); renderPieces(); updateStatus(); });
}
function scheduleAI(){ if (modeSel.value!=='ai') return; if (state.engine.turn!=='b') return;
  setTimeout(aiMove, 250); }

function openPromotion(){
  const backdrop=document.getElementById('promoBackdrop'); backdrop.classList.remove('hidden');
  return new Promise(resolve=>{
    const handler=(ev)=>{ const btn=ev.target.closest('button[data-piece]'); if(!btn) return; const code=btn.dataset.piece; cleanup(); resolve(code); };
    const cleanup=()=>{ backdrop.classList.add('hidden'); backdrop.removeEventListener('click', handler); };
    backdrop.addEventListener('click', handler);
  });
}

function renderAxesAndBoard(){ buildBoard(); renderPieces(); renderAxes(); }
function resetGame(){ state.engine.reset(); state.selected=null; state.legalForSelected=[]; clearHighlights(); renderAxesAndBoard(); updateStatus(); if (modeSel.value==='ai') scheduleAI(); }
resetBtn.addEventListener('click', resetGame);

(function init(){ renderAxesAndBoard(); updateStatus(); if (modeSel.value==='ai') scheduleAI(); })();
