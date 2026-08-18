const cube = document.getElementById('cube');
const ghostsContainer = document.getElementById('ghosts');

// imagen de cada cara (misma asignación que las caras reales del cubo)
const FACE_POSTERS = {
  front:  'videos/posters/poster-back.png',   // logo
  right:  'videos/posters/poster-right.jpg',
  back:   'videos/posters/poster-front.jpg',  // sitio-1
  left:   'videos/posters/poster-left.jpg',
  top:    'videos/posters/poster-top.jpg',
  bottom: 'videos/posters/poster-bottom.jpg'
};

const POOL_SIZE = 14;
const LIFE = 1000; // ms que dura cada fantasma desvaneciéndose

const pool = [];
for(let i = 0; i < POOL_SIZE; i++){
  const el = document.createElement('div');
  el.className = 'ghost-plane';
  ghostsContainer.appendChild(el);
  pool.push(el);
}

// determina qué cara del cubo está mirando a cámara para una rotación dada
function getFrontFace(rx, ry){
  const nx = ((rx % 360) + 360) % 360;
  const ny = ((ry % 360) + 360) % 360;
  const pitchUp = Math.min(Math.abs(nx - 90), Math.abs(nx - 450));
  const pitchDown = Math.min(Math.abs(nx - 270), Math.abs(nx + 90));
  if(pitchUp < 45) return 'bottom';
  if(pitchDown < 45) return 'top';
  const yawFaces = ['front', 'left', 'back', 'right'];
  const idx = Math.round(ny / 90) % 4;
  return yawFaces[idx];
}

const particles = []; // fantasmas activos: {el, x, y, vx, vy, born, maxOpacity, scaleFrom, scaleTo}
let lastSpawn = 0;
const SPAWN_INTERVAL = 55; // ms entre disparos mientras se arrastra rápido

function spawnGhost(now, speed, curRotX, curRotY){
  const dirX = velY === 0 ? 0 : Math.sign(velY);
  const dirY = velX === 0 ? 0 : -Math.sign(velX);
  if(dirX === 0 && dirY === 0) return;

  // reusar un elemento libre del pool, o el más viejo si no hay
  let el = pool.find(p => !particles.some(pt => pt.el === p));
  if(!el){
    const oldest = particles.shift();
    el = oldest.el;
  }

  const face = getFrontFace(curRotX, curRotY);
  el.style.backgroundImage = `url('${FACE_POSTERS[face]}')`;

  const speedFactor = Math.max(0, Math.min(1, speed / 10));
  particles.push({
    el,
    x: 0, y: 0,
    vx: dirX * (260 + speed * 16),
    vy: dirY * (170 + speed * 11),
    born: now,
    maxOpacity: 0.22 * speedFactor,
    scaleFrom: 0.92,
    scaleTo: 1.9
  });
}

function updateGhosts(now, dtSec, speed){
  if(dragging && speed > 1 && now - lastSpawn > SPAWN_INTERVAL){
    lastSpawn = now;
    spawnGhost(now, speed, rotX, rotY);
  }

  for(let i = particles.length - 1; i >= 0; i--){
    const p = particles[i];
    const age = now - p.born;
    if(age >= LIFE){
      p.el.style.opacity = 0;
      particles.splice(i, 1);
      continue;
    }
    const t = age / LIFE;
    const slowdown = Math.pow(0.6, t); // pierde impulso mas lento, asi llega mas lejos
    p.x += p.vx * dtSec * slowdown;
    p.y += p.vy * dtSec * slowdown;

    const scale = p.scaleFrom + (p.scaleTo - p.scaleFrom) * t;
    const opacity = p.maxOpacity * (1 - t);
    p.el.style.opacity = opacity;
    p.el.style.transform =
      `translateX(${p.x}px) translateY(${p.y}px) scale(${scale})`;
  }
}

let rotX = -18, rotY = -30;
let dragging = false;
let lastX = 0, lastY = 0;
let velY = 0, velX = 0;
const AUTOROTATE_SPEED = 0.06;
const FRICTION = 0.94;

function setTransform(){
  cube.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
}

let downX = 0, downY = 0;

function onPointerDown(e){
  dragging = true;
  cube.classList.add('dragging');
  cube.setPointerCapture(e.pointerId);
  lastX = e.clientX; lastY = e.clientY;
  downX = e.clientX; downY = e.clientY;
  velX = 0; velY = 0;
}

function onPointerMove(e){
  if(!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  velY = dx * 0.4;
  velX = -dy * 0.4;
  rotY += velY;
  rotX = rotX + velX;
  setTransform();
}

function onPointerUp(e){
  dragging = false;
  cube.classList.remove('dragging');
  cube.releasePointerCapture(e.pointerId);

  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  if(moved < 6){
    const face = e.target.closest('.face');
    const url = face && face.dataset.url;
    if(url) window.open(url, '_blank', 'noopener');
  }
}

cube.addEventListener('pointerdown', onPointerDown);
cube.addEventListener('pointermove', onPointerMove);
cube.addEventListener('pointerup', onPointerUp);
cube.addEventListener('pointercancel', onPointerUp);

// red de seguridad cross-browser: el -webkit-user-drag del CSS no
// funciona en todos los navegadores, así que cancelamos el drag nativo
// directamente acá para que nunca "se lleve" la imagen/video.
cube.addEventListener('dragstart', e => e.preventDefault());

let lastTick = 0;
function tick(now){
  if(!lastTick) lastTick = now;
  const dtSec = Math.min((now - lastTick) / 1000, 0.05);
  lastTick = now;

  if(!dragging){
    if(Math.abs(velX) > 0.01 || Math.abs(velY) > 0.01){
      velX *= FRICTION;
      velY *= FRICTION;
      rotY += velY;
      rotX = rotX + velX;
    } else {
      rotY += AUTOROTATE_SPEED;
    }
    setTransform();
  }
  const speed = Math.hypot(velX, velY);
  updateGhosts(now, dtSec, speed);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
