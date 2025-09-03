/* Classic Chess — v30 (mobile right margin); functional board */
const FILES=['a','b','c','d','e','f','g','h'];
const START_FEN="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const isWhite=p=>p===p.toUpperCase();
const inBounds=(f,r)=>f>=0&&f<8&&r>=0&&r<8;
const cloneBoard=b=>b.map(r=>r.slice());
const toSq=(f,r)=>FILES[f]+(r+1);

const PIECE_UNICODE={
  'P':'♙','N':'♘','B':'♗','R':'♖','Q':'♔','K':'♕',
  'p':'♟','n':'♞','b':'♝','r':'♜','q':'♚','k':'♛'
};

/* ---------------- Engine ---------------- */
class ChessEngine{
  constructor(fen=START_FEN){ this.loadFEN(fen); this.history=[]; this.positionCounts=new Map(); this.recordPosition(); }
  reset(){ this.loadFEN(START_FEN); this.history=[]; this.positionCounts=new Map(); this.recordPosition(); }
  loadFEN(fen){
    const [pl,active,cast,ep,half,full]=fen.trim().split(/\s+/);
    const rows=pl.split('/');
    this.board=Array.from({length:8},()=>Array(8).fill(null));
    for(let fr=0;fr<8;fr++){
      let f=0;
      for(const ch of rows[fr]){
        if(/[1-8]/.test(ch)) f+=+ch;
        else this.board[7-fr][f++]=ch;
      }
    }
    this.turn=active==='w'?'w':'b';
    this.castling={K:false,Q:false,k:false,q:false};
    if(cast&&cast!=='-') for(const c of cast) if(this.castling.hasOwnProperty(c)) this.castling[c]=true;
    this.ep=ep&&ep!=='-'?ep:null;
    this.halfmove=half?+half:0;
    this.fullmove=full?+full:1;
  }
  toFEN(){
    let pl='';
    for(let r=7;r>=0;r--){
      let e=0;
      for(let f=0;f<8;f++){
        const p=this.board[r][f];
        if(!p) e++;
        else{ if(e){ pl+=e; e=0; } pl+=p; }
      }
      if(e) pl+=e;
      if(r>0) pl+='/';
    }
    let cast=''; if(this.castling.K)cast+='K'; if(this.castling.Q)cast+='Q'; if(this.castling.k)cast+='k'; if(this.castling.q)cast+='q'; if(!cast) cast='-';
    const ep=this.ep?this.ep:'-';
    return `${pl} ${this.turn} ${cast} ${ep} ${this.halfmove} ${this.fullmove}`;
  }
  coords(s){ return {file:FILES.indexOf(s[0]), rank:+s[1]-1}; }
  pieceAt(s){ const {file,rank}=this.coords(s); return this.board[rank][file]; }
  kingSquare(color){ const t=color==='w'?'K':'k'; for(let r=0;r<8;r++) for(let f=0;f<8;f++) if(this.board[r][f]===t) return toSq(f,r); return null; }
  push(ms,from,to,opts={}){ ms.push({from,to,...opts}); }

  genPawn(from,p,ms){
    const w=isWhite(p),dir=w?1:-1; const {file,rank}=this.coords(from);
    const start=w?1:6,last=w?7:0; const r1=rank+dir;
    if(inBounds(file,r1)&&!this.board[r1][file]){
      const to=toSq(file,r1);
      if(r1===last)['q','r','b','n'].forEach(pr=>this.push(ms,from,to,{promotion:pr}));
      else{
        this.push(ms,from,to);
        const r2=rank+2*dir;
        if(rank===start&&!this.board[r2][file]) this.push(ms,from,toSq(file,r2));
      }
    }
    for(const df of[-1,1]){
      const f2=file+df,r2=rank+dir; if(!inBounds(f2,r2)) continue;
      const tgt=this.board[r2][f2]; const to=toSq(f2,r2);
      if(tgt&&isWhite(tgt)!==w){
        if(r2===last)['q','r','b','n'].forEach(pr=>this.push(ms,from,to,{capture:tgt,promotion:pr}));
        else this.push(ms,from,to,{capture:tgt});
      }
    }
    if(this.ep){
      const {file:ef,rank:er}=this.coords(this.ep);
      if(er===rank+dir&&Math.abs(ef-file)===1) this.push(ms,from,toSq(ef,er),{enPassant:true,capture:w?'p':'P'});
    }
  }
  genKnight(from,p,ms){
    const {file,rank}=this.coords(from);
    const d=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
    for(const[df,dr]of d){
      const f2=file+df,r2=rank+dr; if(!inBounds(f2,r2)) continue;
      const tgt=this.board[r2][f2]; const to=toSq(f2,r2);
      if(!tgt) this.push(ms,from,to); else if(isWhite(tgt)!==isWhite(p)) this.push(ms,from,to,{capture:tgt});
    }
  }
  genSlide(from,p,ms,dirs){
    const {file,rank}=this.coords(from);
    for(const[df,dr]of dirs){
      let f=file+df,r=rank+dr;
      while(inBounds(f,r)){
        const tgt=this.board[r][f]; const to=toSq(f,r);
        if(!tgt) this.push(ms,from,to);
        else { if(isWhite(tgt)!==isWhite(p)) this.push(ms,from,to,{capture:tgt}); break; }
        f+=df; r+=dr;
      }
    }
  }
  genKing(from,p,ms){
    const {file,rank}=this.coords(from);
    for(let df=-1;df<=1;df++) for(let dr=-1;dr<=1;dr++){
      if(!df&&!dr) continue;
      const f2=file+df,r2=rank+dr; if(!inBounds(f2,r2)) continue;
      const tgt=this.board[r2][f2]; const to=toSq(f2,r2);
      if(!tgt) this.push(ms,from,to);
      else if(isWhite(tgt)!==isWhite(p)) this.push(ms,from,to,{capture:tgt});
    }
    const w=isWhite(p),home=w?0:7;
    if(file===4&&rank===home){
      if((w&&this.castling.K)||(!w&&this.castling.k)){
        if(!this.board[home][5]&&!this.board[home][6]) this.push(ms,from,toSq(6,home),{castle:w?'K':'k'});
      }
      if((w&&this.castling.Q)||(!w&&this.castling.q)){
        if(!this.board[home][1]&&!this.board[home][2]&&!this.board[home][3]) this.push(ms,from,toSq(2,home),{castle:w?'Q':'q'});
      }
    }
  }
  generateMoves(forColor=this.turn){
    const ms=[];
    for(let r=0;r<8;r++) for(let f=0;f<8;f++){
      const p=this.board[r][f]; if(!p) continue;
      const c=isWhite(p)?'w':'b'; if(c!==forColor) continue;
      const from=toSq(f,r);
      switch(p.toLowerCase()){
        case'p':this.genPawn(from,p,ms);break;
        case'n':this.genKnight(from,p,ms);break;
        case'b':this.genSlide(from,p,ms,[[1,1],[1,-1],[-1,1],[-1,-1]]);break;
        case'r':this.genSlide(from,p,ms,[[1,0],[-1,0],[0,1],[0,-1]]);break;
        case'q':this.genSlide(from,p,ms,[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]);break;
        case'k':this.genKing(from,p,ms);break;
      }
    }
    return ms;
  }
  isSquareAttacked(sq,by){
    const {file,rank}=this.coords(sq);
    const white=(by==='w');
    const pawnDir=white?1:-1;
    for(const df of[-1,1]){
      const f=file+df,r=rank-pawnDir;
      if(inBounds(f,r)){
        const p=this.board[r][f];
        if(p&&isWhite(p)===white&&p.toLowerCase()==='p') return true;
      }
    }
    const nd=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
    for(const[df,dr]of nd){
      const f=file+df,r=rank+dr; if(!inBounds(f,r)) continue;
      const p=this.board[r][f]; if(p&&isWhite(p)===white&&p.toLowerCase()==='n') return true;
    }
    const diag=[[1,1],[1,-1],[-1,1],[-1,-1]];
    for(const[df,dr]of diag){
      let f=file+df,r=rank+dr;
      while(inBounds(f,r)){
        const p=this.board[r][f];
        if(p){
          if(isWhite(p)===white){
            const t=p.toLowerCase();
            if(t==='b'||t==='q') return true;
          }
          break;
        }
        f+=df; r+=dr;
      }
    }
    const ortho=[[1,0],[-1,0],[0,1],[0,-1]];
    for(const[df,dr]of ortho){
      let f=file+df,r=rank+dr;
      while(inBounds(f,r)){
        const p=this.board[r][f];
        if(p){
          if(isWhite(p)===white){
            const t=p.toLowerCase();
            if(t==='r'||t==='q') return true;
          }
          break;
        }
        f+=df; r+=dr;
      }
    }
    for(let df=-1;df<=1;df++) for(let dr=-1;dr<=1;dr++){
      if(!df&&!dr) continue;
      const f=file+df,r=rank+dr; if(!inBounds(f,r)) continue;
      const p=this.board[r][f];
      if(p&&isWhite(p)===white&&p.toLowerCase()==='k') return true;
    }
    return false;
  }
  inCheck(color=this.turn){ const k=this.kingSquare(color); const opp=color==='w'?'b':'w'; return this.isSquareAttacked(k,opp); }
  attackersOf(color){
    const ksq=this.kingSquare(color); if(!ksq) return [];
    const opp=color==='w'?'b':'w';
    const res=[];
    for(let r=0;r<8;r++) for(let f=0;f<8;f++){
      const p=this.board[r][f]; if(!p) continue;
      if((isWhite(p)?'w':'b')!==opp) continue;
      const from=toSq(f,r);
      const pseudo=[];
      switch(p.toLowerCase()){
        case'p': this.genPawn(from,p,pseudo); break;
        case'n': this.genKnight(from,p,pseudo); break;
        case'b': this.genSlide(from,p,pseudo,[[1,1],[1,-1],[-1,1],[-1,-1]]); break;
        case'r': this.genSlide(from,p,pseudo,[[1,0],[-1,0],[0,1],[0,-1]]); break;
        case'q': this.genSlide(from,p,pseudo,[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]); break;
        case'k': this.genKing(from,p,pseudo); break;
      }
      if(pseudo.some(m=>m.to===ksq)) res.push(from);
    }
    return res;
  }
  makeMove(mv,trial=false){
    const {from,to,promotion,castle,enPassant}=mv;
    const a=this.coords(from), b=this.coords(to);
    const piece=this.board[a.rank][a.file];
    const captured=this.board[b.rank][b.file];
    const snap={ board: cloneBoard(this.board), turn:this.turn, castling:{...this.castling}, ep:this.ep, halfmove:this.halfmove, fullmove:this.fullmove };
    (this.history||(this.history=[])).push(snap);
    if(piece.toLowerCase()==='p'||captured||enPassant) this.halfmove=0; else this.halfmove++;
    this.board[b.rank][b.file]=piece; this.board[a.rank][a.file]=null;
    if(enPassant){
      const dir=(this.turn==='w')?1:-1; const capRank=b.rank-dir;
      this.board[capRank][b.file]=null;
    }
    this.ep=null;
    if(piece.toLowerCase()==='p'&&Math.abs(b.rank-a.rank)===2){
      const epRank=(a.rank+b.rank)/2; this.ep=toSq(a.file,epRank);
    }
    if(promotion&&piece.toLowerCase()==='p'){
      this.board[b.rank][b.file]=isWhite(piece)?promotion.toUpperCase():promotion.toLowerCase();
    }
    if(castle){
      const isW=(this.turn==='w'); const rr=isW?0:7;
      if(castle===(isW?'K':'k')){ this.board[rr][5]=this.board[rr][7]; this.board[rr][7]=null; }
      else { this.board[rr][3]=this.board[rr][0]; this.board[rr][0]=null; }
    }
    this.updateCastlingRights(from,to,piece,captured);
    if(this.turn==='b') this.fullmove++;
    this.turn=this.turn==='w'?'b':'w';
    if(!trial) this.recordPosition();
  }
  updateCastlingRights(from,to,piece,captured){
    const isW=isWhite(piece);
    if(piece.toLowerCase()==='k'){
      if(isW){ this.castling.K=false; this.castling.Q=false; }
      else { this.castling.k=false; this.castling.q=false; }
    }
    if(piece.toLowerCase()==='r'){
      if(from==='h1') this.castling.K=false;
      if(from==='a1') this.castling.Q=false;
      if(from==='h8') this.castling.k=false;
      if(from==='a8') this.castling.q=false;
    }
    if(to==='h1') this.castling.K=false;
    if(to==='a1') this.castling.Q=false;
    if(to==='h8') this.castling.k=false;
    if(to==='a8') this.castling.q=false;
  }
  undoMove(){
    const s=this.history.pop(); if(!s) return;
    this.board=cloneBoard(s.board); this.turn=s.turn; this.castling={...s.castling}; this.ep=s.ep; this.halfmove=s.halfmove; this.fullmove=s.fullmove;
  }
  recordPosition(){ const key=this.toFEN().split(' ').slice(0,4).join(' '); this.positionCounts.set(key,(this.positionCounts.get(key)||0)+1); }
  legalMoves(){
    const pseudo=this.generateMoves(this.turn);
    const me=this.turn,opp=me==='w'?'b':'w'; const legal=[]; const inC=this.inCheck(me);
    for(const mv of pseudo){
      if(mv.castle){
        if(inC) continue;
        const from=this.coords(mv.from); const midFile=(mv.to[0]==='g')?5:3; const mid=toSq(midFile,from.rank);
        if(this.isSquareAttacked(mid,opp)) continue;
      }
      this.makeMove(mv,true);
      const bad=this.inCheck(me);
      this.undoMove();
      if(!bad) legal.push(mv);
    }
    return legal;
  }
  legalMovesFromSquare(sq){
    const p=this.pieceAt(sq); if(!p) return [];
    const pseudo=[];
    switch(p.toLowerCase()){
      case'p':this.genPawn(sq,p,pseudo);break;
      case'n':this.genKnight(sq,p,pseudo);break;
      case'b':this.genSlide(sq,p,pseudo,[[1,1],[1,-1],[-1,1],[-1,-1]]);break;
      case'r':this.genSlide(sq,p,pseudo,[[1,0],[-1,0],[0,1],[0,-1]]);break;
      case'q':this.genSlide(sq,p,pseudo,[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]);break;
      case'k':this.genKing(sq,p,pseudo);break;
    }
    const me=this.turn,opp=me==='w'?'b':'w'; const inC=this.inCheck(me); const legal=[];
    for(const mv of pseudo){
      if(p.toLowerCase()==='k'&&mv.castle){
        if(inC) continue;
        const from=this.coords(mv.from); const midFile=(mv.to[0]==='g')?5:3; const mid=toSq(midFile,from.rank);
        if(this.isSquareAttacked(mid,opp)) continue;
      }
      this.makeMove(mv,true);
      const bad=this.inCheck(me);
      this.undoMove();
      if(!bad) legal.push(mv);
    }
    return legal;
  }
}

/* ---------------- UI state & DOM ---------------- */
const state={
  engine:new ChessEngine(START_FEN),
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

(function(){
  const saved = localStorage.getItem('theme') || 'classic';
  document.documentElement.setAttribute('data-theme', saved);
  if (themeSelect) themeSelect.value = saved;
})();
if (themeSelect){
  themeSelect.addEventListener('change', () => {
    const v = themeSelect.value || 'classic';
    document.documentElement.setAttribute('data-theme', v);
    try { localStorage.setItem('theme', v); } catch {}
  });
}

function refreshLevelVisibility(){
  levelWrap.style.display = (modeSel.value==='ai') ? '' : 'none';
}
refreshLevelVisibility();
modeSel.addEventListener('change', ()=>{
  refreshLevelVisibility();
  updateStatus();
  if(modeSel.value==='ai') scheduleAI();
});

function showToast(msg){ toast.textContent=msg; toast.classList.remove('hidden'); setTimeout(()=>toast.classList.add('hidden'),2200); }
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
    const el=document.createElement('div');
    el.className='piece '+(isWhite(p)?'white':'black');
    el.textContent=PIECE_UNICODE[p];
    d.appendChild(el);
  }
  highlightAttackers();
}
function clearHighlights(){
  for(const d of board.children) d.classList.remove('highlight-origin','highlight-move','highlight-capture','highlight-check','highlight-attacker');
}
function clearCheckOnly(){
  for(const d of board.children) d.classList.remove('highlight-check','highlight-attacker');
}
function highlightAttackers(){
  clearCheckOnly();
  if(state.engine.inCheck()){
    const ksq=state.engine.kingSquare(state.engine.turn);
    const kd=squareEl(ksq); if(kd) kd.classList.add('highlight-check');
    for(const a of state.engine.attackersOf(state.engine.turn)){
      const ad=squareEl(a); if(ad) ad.classList.add('highlight-attacker');
    }
  }
}

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
  if(moves.length===0){
    if(e.inCheck()){
      const winner=e.turn==='w'?'Black':'White';
      statusEl.textContent=`Checkmate — ${winner} wins`;
    }else{
      statusEl.textContent='Stalemate — draw';
    }
    clearTimeout(state.aiTimer);
    return;
  }
  const ai=modeSel.value==='ai';
  let status=ai?(e.turn==='w'?'White (You)':'Black (AI)'):(e.turn==='w'?'White':'Black');
  status+=' to move';
  if(e.inCheck()) status+=' — '+(e.turn==='w'?'White':'Black')+' is in check';
  statusEl.textContent=status;
  if (modeSel.value==='ai' && e.turn==='b') scheduleAI();
}

function centerOfSquare(sq){
  const el=squareEl(sq); const r=el.getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2};
}

function animateMoveCentered(from,to,piece,done){
  const start=centerOfSquare(from), end=centerOfSquare(to);
  const ghost=document.createElement('div'); ghost.className='piece anim-ghost '+(isWhite(piece)?'white':'black');
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
  const toRank=parseInt(mv.to[1],10);
  const isHumanPromotion = fromP && fromP.toLowerCase()==='p' && (toRank===8 || toRank===1);
  const doAfter=()=>{
    state.selected=null; state.legalForSelected=[];
    clearHighlights(); renderPieces(); updateStatus();
    if(modeSel.value==='ai') scheduleAI();
  };
  if(isHumanPromotion){
    animateMoveCentered(mv.from,mv.to,fromP,()=>{
      openPromotion().then(code=>{
        e.makeMove({...mv, promotion: code || 'q'});
        doAfter();
      });
    });
  } else {
    animateMoveCentered(mv.from,mv.to,fromP,()=>{ e.makeMove(mv); doAfter(); });
  }
}

/* ---------------- AI ---------------- */
const AI_LEVELS={
  0:{depth:0, time:80, quies:false, tt:false, name:'Random'},
  1:{depth:1, time:120,quies:false, tt:false, name:'Fast'},
  2:{depth:2, time:220,quies:false, tt:false, name:'Stronger'},
  3:{depth:3, time:450,quies:true,  tt:false, name:'Tactics'},
  4:{depth:4, time:900,quies:true,  tt:true,  name:'Thinks more'}
};

function aiChooseMove(engine){
  const level=AI_LEVELS[+levelSel.value]||AI_LEVELS[1];
  if(level.depth===0){
    const list=engine.legalMoves();
    return list[Math.floor(Math.random()*list.length)]||null;
  }
  function evalBoard(){
    let score=0;
    for(let r=0;r<8;r++){
      for(let f=0;f<8;f++){
        const p=engine.board[r][f];
        if(!p) continue;
        const t=p.toLowerCase();
        const base={p:100,n:320,b:330,r:500,q:900,k:0}[t];
        score += isWhite(p)?base:-base;
      }
    }
    return score*(engine.turn==='w'?1:-1);
  }
  function orderMoves(moves){
    return moves.map(m=>({m, s:(m.capture?100:0)+(m.castle?5:0)})).sort((a,b)=>b.s-a.s).map(x=>x.m);
  }
  function negamax(depth,alpha,beta){
    if(depth===0) return evalBoard();
    const moves=orderMoves(engine.legalMoves());
    if(moves.length===0){
      if(engine.inCheck()) return -99999;
      return 0;
    }
    let best=-1e9;
    for(const mv of moves){
      engine.makeMove(mv,true);
      const val=-negamax(depth-1,-beta,-alpha);
      engine.undoMove();
      if(val>best) best=val;
      if(val>alpha) alpha=val;
      if(alpha>=beta) break;
    }
    return best;
  }
  const root=orderMoves(engine.legalMoves());
  let bestMove=null, bestVal=-1e9;
  for(const mv of root){
    engine.makeMove(mv,true);
    const val=-negamax(level.depth-1,-1e9,1e9);
    engine.undoMove();
    if(val>bestVal){ bestVal=val; bestMove=mv; }
  }
  return bestMove||root[0]||null;
}

function aiMove(){
  if (modeSel.value!=='ai' || state.engine.turn!=='b') return;
  const mv=aiChooseMove(state.engine);
  if(!mv){ renderPieces(); updateStatus(); return; }
  const fromP=state.engine.pieceAt(mv.from);
  animateMoveCentered(mv.from,mv.to,fromP,()=>{ state.engine.makeMove(mv); renderPieces(); updateStatus(); });
}
function scheduleAI(){
  if (modeSel.value!=='ai' || state.engine.turn!=='b') return;
  setTimeout(aiMove, 250);
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
