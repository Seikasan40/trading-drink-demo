// ================================================================
// TRADING DRINK — Serveur de demo multi-ecrans
// Express + Socket.io + Moteur de trading integre
// ================================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/',       (_, res) => res.sendFile(path.join(__dirname, 'public', 'mobile.html')));
app.get('/tv',     (_, res) => res.sendFile(path.join(__dirname, 'public', 'tv.html')));
app.get('/barman', (_, res) => res.sendFile(path.join(__dirname, 'public', 'barman.html')));
app.get('/health', (_, res) => res.json({ status: 'ok', tick: state.tick, uptime: process.uptime() }));

// ================================================================
// TRADING ENGINE
// ================================================================

const PRODUCTS = [
  { id:'1', name:'Pinte Blonde', emoji:'\u{1F37A}', cat:'Biere',      base:5.50, min:3.00, max:9.00,  vol:0.06 },
  { id:'2', name:'Mojito',       emoji:'\u{1F378}', cat:'Cocktail',   base:9.00, min:5.50, max:14.00, vol:0.08 },
  { id:'3', name:'Whisky',       emoji:'\u{1F943}', cat:'Spirit',     base:8.00, min:5.00, max:12.00, vol:0.07 },
  { id:'4', name:'Spritz',       emoji:'\u{1F379}', cat:'Cocktail',   base:7.50, min:4.50, max:11.00, vol:0.07 },
  { id:'5', name:'IPA',          emoji:'\u{1F37B}', cat:'Biere',      base:6.00, min:3.50, max:9.50,  vol:0.05 },
  { id:'6', name:'Margarita',    emoji:'\u{1F9C9}', cat:'Cocktail',   base:10.0, min:6.00, max:15.00, vol:0.09 },
  { id:'7', name:'Vodka Tonic',  emoji:'\u{1FAE7}', cat:'Long Drink', base:7.00, min:4.00, max:10.50, vol:0.06 },
  { id:'8', name:'Rhum Arrange', emoji:'\u{1F3DD}\u{FE0F}', cat:'Spirit', base:6.50, min:4.00, max:10.00, vol:0.08 },
];

const state = {
  products: PRODUCTS.map(p => ({
    ...p,
    cur: p.base,
    prev: p.base,
    chg: 0,
    trend: 'stable',
    spark: Array.from({ length: 20 }, () => p.base + (Math.random() - 0.5) * 0.3),
  })),
  lb: [
    { id:'1', label:'Table 1 \u2014 Les Loups',   pts:285, orders:14 },
    { id:'2', label:'Table 5 \u2014 La Meute',     pts:220, orders:11 },
    { id:'3', label:'Table 3 \u2014 Traders Fous',  pts:175, orders:9 },
    { id:'4', label:'Table 8 \u2014 YOLO Gang',     pts:140, orders:8 },
    { id:'5', label:'Table 2 \u2014 Les Baleines',  pts:110, orders:7 },
    { id:'6', label:'Table 12 \u2014 Crash Test',    pts:85, orders:5 },
    { id:'7', label:'Table 6 \u2014 Les Etoiles',    pts:60, orders:4 },
    { id:'8', label:'Table 9 \u2014 Apero Club',     pts:35, orders:3 },
  ],
  pendingOrders: [],
  event: null,
  eventEnd: 0,
  frozen: false,
  tick: 0,
  myPts: 285,
  totalOrders: 0,
};

function engineTick() {
  if (state.frozen) { broadcast(); return; }
  state.tick++;
  const volMul = (state.event?.type === 'happy_trading') ? 3 : 1;

  for (const p of state.products) {
    p.prev = p.cur;
    const demand = (Math.random() - 0.42) * 2;
    const dF = Math.tanh(demand * 0.5) * p.vol * volMul;
    const rF = (Math.random() - 0.5) * p.vol * 0.4 * volMul;
    const bF = (p.base - p.cur) / p.base * 0.02;
    let eF = 0;
    if (state.event) {
      if (state.event.type === 'flash_sale' && state.event.pid === p.id) eF = -0.07;
      if (state.event.type === 'crash') eF = -0.12;
      if (state.event.type === 'pump' && state.event.pid === p.id) eF = 0.05;
    }
    let np = p.cur * (1 + dF + rF + bF + eF);
    np = Math.max(p.min, Math.min(p.max, np));
    p.cur = Math.round(np * 100) / 100;
    p.chg = ((p.cur - p.prev) / p.prev) * 100;
    p.trend = p.cur > p.prev ? 'up' : p.cur < p.prev ? 'down' : 'stable';
    p.spark.push(p.cur);
    if (p.spark.length > 30) p.spark.shift();
  }

  if (state.tick % 3 === 0) {
    const idx = Math.floor(Math.random() * state.lb.length);
    state.lb[idx].pts += Math.floor(Math.random() * 12) + 3;
    if (Math.random() > 0.6) state.lb[idx].orders++;
    state.lb.sort((a, b) => b.pts - a.pts);
  }

  if (state.event && Date.now() > state.eventEnd) {
    state.event = null;
  }

  broadcast();
}

function broadcast() {
  io.emit('state', state);
}

// ================================================================
// SOCKET.IO
// ================================================================

io.on('connection', (socket) => {
  console.log('[+] Client connecte: ' + socket.id);
  socket.emit('state', state);

  socket.on('event', (data) => {
    if (state.event) return;
    const p = state.products.find(x => x.id === data.pid);
    const dur = data.type === 'crash' ? 30 : data.type === 'happy_trading' ? 60 : 45;
    state.event = { type: data.type, pid: p?.id, name: p?.name, emoji: p?.emoji };
    state.eventEnd = Date.now() + dur * 1000;
    console.log('[EVENT] ' + data.type + (p ? ' sur ' + p.name : '') + ' (' + dur + 's)');
    setTimeout(() => { state.event = null; broadcast(); }, dur * 1000);
    broadcast();
  });

  socket.on('order', (data) => {
    const p = state.products.find(x => x.id === data.pid);
    if (!p) return;
    const order = {
      id: 'o' + Date.now() + Math.random().toString(36).slice(2, 6),
      pid: p.id, name: p.name, emoji: p.emoji,
      qty: Math.min(10, Math.max(1, data.qty || 1)),
      price: p.cur, total: p.cur * (data.qty || 1),
      table: 'Table 1', time: Date.now(),
    };
    state.pendingOrders.push(order);
    state.totalOrders++;
    console.log('[ORDER] ' + p.emoji + ' ' + p.name + ' x' + order.qty + ' — ' + order.total.toFixed(2) + 'EUR');
    broadcast();
  });

  socket.on('confirm', (data) => {
    const idx = state.pendingOrders.findIndex(o => o.id === data.oid);
    if (idx === -1) return;
    const o = state.pendingOrders.splice(idx, 1)[0];
    const bonus = state.event?.type === 'crash' ? 30 : state.event?.type === 'flash_sale' ? 20 : 0;
    const pts = 10 + bonus;
    state.myPts += pts;
    state.lb[0].pts = state.myPts;
    console.log('[CONFIRM] ' + o.emoji + ' ' + o.name + ' — +' + pts + ' pts');
    io.emit('points', { pts, name: o.name, emoji: o.emoji });
    broadcast();
  });

  socket.on('cancel', (data) => {
    state.pendingOrders = state.pendingOrders.filter(o => o.id !== data.oid);
    broadcast();
  });

  socket.on('kill', () => {
    state.frozen = !state.frozen;
    console.log('[KILL] Moteur ' + (state.frozen ? 'GELE' : 'RELANCE'));
    broadcast();
  });

  socket.on('disconnect', () => {
    console.log('[-] Client deconnecte: ' + socket.id);
  });
});

// ================================================================
// DEMARRAGE
// ================================================================

setInterval(engineTick, 3500);

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  TRADING DRINK — LIVE DEMO');
  console.log('  Mobile :  http://localhost:' + PORT + '/');
  console.log('  TV     :  http://localhost:' + PORT + '/tv');
  console.log('  Barman :  http://localhost:' + PORT + '/barman');
  console.log('  Moteur de trading : actif (3.5s/tick)');
  console.log('');
});
