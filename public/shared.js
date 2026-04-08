// TRADING DRINK — Client-side shared utilities

let S = { products:[], lb:[], pendingOrders:[], event:null, eventEnd:0, frozen:false, tick:0, myPts:0, totalOrders:0 };

const socket = io({ transports: ['websocket','polling'], reconnection:true, reconnectionDelay:2000, reconnectionDelayMax:10000 });

socket.on('connect', () => {
  console.log('[WS] Connecte');
  document.querySelectorAll('.conn-status').forEach(el => { el.style.background = 'var(--up)'; });
});
socket.on('disconnect', () => {
  console.log('[WS] Deconnecte');
  document.querySelectorAll('.conn-status').forEach(el => { el.style.background = 'var(--down)'; });
});
socket.on('state', (data) => {
  S = data;
  if (typeof onStateUpdate === 'function') onStateUpdate();
});
socket.on('points', (data) => {
  if (typeof onPoints === 'function') onPoints(data);
});

function svgPath(data, w, h) {
  if (!data || data.length < 2) return { path:'', area:'', last:null };
  const pad=4, mn=Math.min(...data), mx=Math.max(...data), rng=mx-mn||0.01;
  const pts=data.map((v,i)=>({x:pad+(i/(data.length-1))*(w-pad*2), y:pad+(1-(v-mn)/rng)*(h-pad*2)}));
  let d='M ' + pts[0].x + ' ' + pts[0].y;
  for(let i=1;i<pts.length;i++){const cp=(pts[i-1].x+pts[i].x)/2; d+=' C '+cp+' '+pts[i-1].y+', '+cp+' '+pts[i].y+', '+pts[i].x+' '+pts[i].y;}
  return { path:d, area:d+' L '+(w-pad)+' '+h+' L '+pad+' '+h+' Z', last:pts[pts.length-1] };
}

function col(p) { return p.trend==='up'?'#00d4a0':p.trend==='down'?'#ff4560':'#8a8aa3'; }

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
