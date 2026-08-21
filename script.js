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

let rotX = -18, rotY = -30, rotZ = 0;
let dragging = false;
let lastX = 0, lastY = 0;
let velY = 0, velX = 0, velZ = 0;
const AUTOROTATE_SPEED = 0.06;
const FRICTION = 0.94;

function setTransform(){
  cube.style.transform = `rotateZ(${rotZ}deg) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
}

let downX = 0, downY = 0;
let lastAngle = null; // ángulo entre los dos dedos, para el gesto de giro (torsión)
const activePointers = new Map(); // pointerId -> {x, y}, soporta 1 o más dedos

function getCentroid(){
  let sx = 0, sy = 0;
  activePointers.forEach(p => { sx += p.x; sy += p.y; });
  const n = activePointers.size || 1;
  return { x: sx / n, y: sy / n };
}

function getTwoFingerAngle(){
  const pts = [...activePointers.values()];
  if(pts.length < 2) return null;
  const [a, b] = pts;
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}

function onPointerDown(e){
  cube.setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if(activePointers.size === 1){
    downX = e.clientX; downY = e.clientY;
  }
  if(activePointers.size === 2){
    lastAngle = getTwoFingerAngle();
  }

  dragging = true;
  cube.classList.add('dragging');
  const c = getCentroid();
  lastX = c.x; lastY = c.y;
  velX = 0; velY = 0; velZ = 0;
  e.preventDefault();
}

function onPointerMove(e){
  if(!dragging || !activePointers.has(e.pointerId)) return;
  e.preventDefault();
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  const c = getCentroid();
  const dx = c.x - lastX;
  const dy = c.y - lastY;
  lastX = c.x; lastY = c.y;
  velY = dx * 0.4;
  velX = -dy * 0.4;
  rotY += velY;
  rotX = rotX + velX;

  if(activePointers.size >= 2){
    const angle = getTwoFingerAngle();
    if(lastAngle !== null){
      let delta = angle - lastAngle;
      if(delta > 180) delta -= 360;
      if(delta < -180) delta += 360;
      rotZ += delta;
      velZ = delta;
    }
    lastAngle = angle;
  }

  setTransform();
}

function onPointerUp(e){
  activePointers.delete(e.pointerId);
  cube.releasePointerCapture(e.pointerId);

  if(activePointers.size === 0){
    dragging = false;
    cube.classList.remove('dragging');

    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if(moved < 6){
      const face = e.target.closest('.face');
      const url = face && face.dataset.url;
      if(url) window.open(url, '_blank', 'noopener');
    }
  } else {
    // queda al menos un dedo apoyado: recalibramos el centro acá
    // mismo para que no salte de golpe al levantar uno de los dos
    const c = getCentroid();
    lastX = c.x; lastY = c.y;
    lastAngle = null; // ya no hay 2 dedos: reiniciar base del giro
  }
}

cube.addEventListener('pointerdown', onPointerDown, { passive: false });
cube.addEventListener('pointermove', onPointerMove, { passive: false });
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
    if(Math.abs(velZ) > 0.01){
      velZ *= FRICTION;
      rotZ += velZ;
    }
    setTransform();
  }
  const speed = Math.hypot(velX, velY);
  updateGhosts(now, dtSec, speed);

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// --- Badge 3D de WhatsApp, renderizado con Three.js (WebGL real, no CSS) ---
(function initWhatsappBadge(){
  const canvas = document.getElementById('wa-canvas');
  if(!canvas || typeof THREE === 'undefined') return;

  const SIZE = 74; // px de render (la sisa en pantalla la maneja el CSS)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(SIZE, SIZE, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);
  camera.lookAt(0, 0, 0);

  // ícono de WhatsApp dibujado sobre fondo verde, como textura
  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#34e07a"/>
          <stop offset="1" stop-color="#1fa855"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#g)"/>
      <g transform="translate(20,20) scale(2.4)">
        <path fill="#fff" d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35z"/>
        <path fill="#fff" d="M12 2C6.5 2 2 6.5 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.06-1.33A9.95 9.95 0 0 0 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.15c-1.67 0-3.22-.5-4.52-1.36l-.32-.2-3 .79.8-2.93-.21-.3A8.14 8.14 0 0 1 3.85 12c0-4.5 3.65-8.15 8.15-8.15S20.15 7.5 20.15 12 16.5 20.15 12 20.15z"/>
      </g>
    </svg>`;
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  // fondo verde sólido como material de arranque, mientras el ícono termina de cargar
  const faceMaterial = new THREE.MeshPhongMaterial({ color: 0x2fbf68, shininess: 40 });
  const sideMaterial = new THREE.MeshPhongMaterial({ color: 0x178a45, shininess: 25 });

  // dibujamos el SVG en un canvas 2D normal y de ahí sacamos la textura,
  // en vez de pasarle el SVG directo a WebGL (eso es lo que daba negro)
  const iconImg = new Image();
  iconImg.onload = function(){
    const iconCanvas = document.createElement('canvas');
    iconCanvas.width = 256;
    iconCanvas.height = 256;
    const ctx = iconCanvas.getContext('2d');
    ctx.drawImage(iconImg, 0, 0, 256, 256);

    const tex = new THREE.CanvasTexture(iconCanvas);
    tex.needsUpdate = true;
    faceMaterial.map = tex;
    faceMaterial.color.set(0xffffff);
    faceMaterial.needsUpdate = true;
    URL.revokeObjectURL(svgUrl);
  };
  iconImg.src = svgUrl;

  // orden de materiales del BoxGeometry: +x, -x, +y, -y, +z, -z
  const materials = [
    sideMaterial, sideMaterial, // derecha, izquierda (canto)
    sideMaterial, sideMaterial, // arriba, abajo (canto)
    faceMaterial, faceMaterial  // frente, atrás (ícono)
  ];

  const geometry = new THREE.BoxGeometry(1.9, 1.9, 0.65);
  const badge = new THREE.Mesh(geometry, materials);
  badge.rotation.x = -0.42; // inclinación fija, para que siempre se vea el canto de arriba
  scene.add(badge);

  scene.add(new THREE.AmbientLight(0x808080));
  const light = new THREE.PointLight(0xffffff, 1.1);
  light.position.set(3, 4, 5);
  scene.add(light);

  function animateBadge(){
    requestAnimationFrame(animateBadge);
    badge.rotation.y += 0.02; // giro continuo sobre sí mismo
    renderer.render(scene, camera);
  }
  animateBadge();
})();
