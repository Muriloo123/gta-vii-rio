import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

const scene = new THREE.Scene();
let gameStarted = false;
let gamePaused = false;
let hasRunGameThisPage = false;
let lastAutosaveAt = 0;
const GAME_SAVE_KEY = 'gta-vii-rio-vice-save-v1';
const START_NEW_GAME_KEY = 'gta-vii-rio-vice-start-new';
const daySkyColor = new THREE.Color(0x65aef0);
const nightSkyColor = new THREE.Color(0x030817);
scene.background = daySkyColor.clone();
scene.fog = new THREE.Fog(daySkyColor.clone(), 240, 760);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 1400);
camera.position.set(10, 8, 13);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
setInterval(() => {
  console.log("Desempenho do GTA:", {
    chamadasDeDesenho: renderer.info.render.calls,
    triangulos: renderer.info.render.triangles,
    geometrias: renderer.info.memory.geometries,
    texturas: renderer.info.memory.texture
  });
}, 2000);
window.__scene = scene;
window.__camera = camera;
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.querySelector('#game').appendChild(renderer.domElement);
const orbitCamera = {
  mode: 'follow',
  yaw: 0,
  pitch: 0.24,
  distance: 12,
  dragging: false
};

const palette = {
  asphalt: 0x202a2b, sidewalk: 0x85887d, sand: 0xc29a69, ocean: 0x164d5a,
  mountain: 0x173e39, mountainFar: 0x23534a, building: 0xc76749, cream: 0xe8d5a7,
  acid: 0xd2f06d, coral: 0xf07e4f, black: 0x111b1c, car: 0xd64f3e
};
const mat = (color, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });
const box = (w, h, d, material, x, y, z) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh; };

const skyLight = new THREE.HemisphereLight(0xb9dcff, 0x263127, 1.8);
scene.add(skyLight);
const moon = new THREE.DirectionalLight(0xffd7a3, 2.8);
moon.position.set(-35, 55, 25); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.camera.left = -80; moon.shadow.camera.right = 80; moon.shadow.camera.top = 80; moon.shadow.camera.bottom = -80; scene.add(moon);

const WORLD_BOUNDS = Object.freeze({ minX: -480, maxX: 480, minZ: -500, maxZ: 1220 });
const AMMU_RIO_LOCATION = Object.freeze({ x: -121.5, z: 79.2 });
const AMMU_RIO_ENTRANCE_OFFSET_Z = 10.2;
const WORLD_WIDTH = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
const WORLD_DEPTH = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
const WORLD_CENTER_X = (WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2;
const WORLD_CENTER_Z = (WORLD_BOUNDS.minZ + WORLD_BOUNDS.maxZ) / 2;
const GUANABARA_BAY = Object.freeze({ minX: WORLD_BOUNDS.minX, maxX: WORLD_BOUNDS.maxX, minZ: 525, maxZ: 920 });
const NITEROI_BRIDGE = Object.freeze({
  x: -43,
  startZ: 480,
  deckStartZ: 525,
  highStartZ: 620,
  highEndZ: 825,
  deckEndZ: 920,
  endZ: 940,
  approachY: 5,
  deckY: 24,
  width: 14
});
const TIJUCA_MOUNTAIN = Object.freeze({ x: -38, z: -155, radius: 68, height: 38, summitRadius: 9 });
const TIJUCA_BEACH = Object.freeze({ minX: 270, maxX: 480, minZ: -348, maxZ: -255 });
const LOCAL_STREET_LAYOUTS = Object.freeze([
  { type: 'roundabout', x: -370, z: -330, radius: 12 },
  { type: 'roundabout', x: 290, z: 330, radius: 12 },
  { type: 'culdesac', x: 50, z: 210, radius: 7.5 },
  { type: 'culdesac', x: -130, z: 390, radius: 7.5 }
]);
const missionGoal = new THREE.Vector3(WORLD_BOUNDS.maxX - 45, 0, WORLD_BOUNDS.minZ + 50);
const missionStartDistance = Math.hypot(missionGoal.x, missionGoal.z);
const buildingWindowMaterial = new THREE.MeshStandardMaterial({
  color: 0x405351,
  roughness: 0.38,
  emissive: 0xffbd68,
  emissiveIntensity: 0
});

function distanceFromTijucaMountain(x, z) {
  return Math.hypot(x - TIJUCA_MOUNTAIN.x, z - TIJUCA_MOUNTAIN.z);
}

function isOnTijucaMountain(x, z, margin = 0) {
  return distanceFromTijucaMountain(x, z) <= TIJUCA_MOUNTAIN.radius + margin;
}

function getTijucaMountainHeight(x, z) {
  const distance = distanceFromTijucaMountain(x, z);
  const mountain = TIJUCA_MOUNTAIN;
  if (distance > mountain.radius) return null;
  if (distance <= mountain.summitRadius) return mountain.height;
  const progress = (distance - mountain.summitRadius) / (mountain.radius - mountain.summitRadius);
  return mountain.height * Math.pow(1 - progress, 1.25);
}

const structureColliders = [];

function registerStructureCollider(x, z, width, depth, minY, maxY) {
  structureColliders.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    minY,
    maxY
  });
}

function canOccupyWorldPosition(x, z, radius, feetY, actorHeight) {
  const insideBay = x > GUANABARA_BAY.minX && x < GUANABARA_BAY.maxX
    && z > GUANABARA_BAY.minZ && z < GUANABARA_BAY.maxZ;
  const onBridge = Math.abs(x - NITEROI_BRIDGE.x) <= NITEROI_BRIDGE.width / 2 + 1
    && z >= NITEROI_BRIDGE.startZ && z <= NITEROI_BRIDGE.endZ;
  if (insideBay && !onBridge) return false;

  for (const collider of structureColliders) {
    if (feetY >= collider.maxY || feetY + actorHeight <= collider.minY) continue;
    const nearestX = THREE.MathUtils.clamp(x, collider.minX, collider.maxX);
    const nearestZ = THREE.MathUtils.clamp(z, collider.minZ, collider.maxZ);
    const distanceX = x - nearestX;
    const distanceZ = z - nearestZ;
    if (distanceX * distanceX + distanceZ * distanceZ < radius * radius) return false;
  }
  return true;
}

function resolveWorldMovement(startX, startZ, nextX, nextZ, radius, feetY, actorHeight) {
  if (canOccupyWorldPosition(nextX, nextZ, radius, feetY, actorHeight)) {
    return { x: nextX, z: nextZ };
  }

  let x = startX;
  let z = startZ;
  if (canOccupyWorldPosition(nextX, z, radius, feetY, actorHeight)) x = nextX;
  if (canOccupyWorldPosition(x, nextZ, radius, feetY, actorHeight)) z = nextZ;
  return { x, z };
}

const skyAnchor = new THREE.Group();
scene.add(skyAnchor);
const starPositions = [];
for (let index = 0; index < 900; index++) {
  const height = 90 + Math.random() * 610;
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(760 * 760 - height * height);
  starPositions.push(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({ color: 0xf2f5ff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.92 })
);
skyAnchor.add(stars);

const cloudLayer = new THREE.Group();
const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xf3f8ff, transparent: true, opacity: 0.88, fog: false });
const cloudGeometry = new THREE.SphereGeometry(1, 12, 8);
for (let index = 0; index < 24; index++) {
  const cloud = new THREE.Group();
  const x = (Math.random() - 0.5) * 1100;
  const z = (Math.random() - 0.5) * 1100;
  const y = 105 + Math.random() * 65;
  const puffCount = 3 + Math.floor(Math.random() * 4);
  for (let puffIndex = 0; puffIndex < puffCount; puffIndex++) {
    const puff = new THREE.Mesh(cloudGeometry, cloudMaterial);
    const size = 5 + Math.random() * 8;
    puff.scale.set(size * 1.8, size * 0.62, size);
    puff.position.set((puffIndex - (puffCount - 1) / 2) * size * 0.75, Math.random() * size * 0.22, 0);
    cloud.add(puff);
  }
  cloud.position.set(x, y, z);
  cloudLayer.add(cloud);
}
skyAnchor.add(cloudLayer);

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(9, 20, 16),
  new THREE.MeshBasicMaterial({ color: 0xffe59a, fog: false })
);
sun.position.set(-260, 280, 390);
skyAnchor.add(sun);
const nightMoon = new THREE.Mesh(
  new THREE.SphereGeometry(6, 18, 14),
  new THREE.MeshBasicMaterial({ color: 0xdce8ff, fog: false })
);
nightMoon.position.set(300, 250, -420);
skyAnchor.add(nightMoon);

function updateSky(minutesOfDay) {
  const isNight = minutesOfDay >= 18 * 60 || minutesOfDay < 6 * 60;
  scene.background.copy(isNight ? nightSkyColor : daySkyColor);
 // Cor da neblina conforme o horário do jogo
const fogColor = new THREE.Color();

if (minutesOfDay >= 16 * 60 && minutesOfDay < 18 * 60) {
  // Fim da tarde: vermelho-alaranjado
  fogColor.set(0xc96b62);
} else if (isNight) {
  // Noite: azul-acinzentado
  fogColor.set(0x53627c);
} else {
  // Dia: cinza levemente azulado
  fogColor.set(0xb8c0c7);
}

scene.fog.color.copy(fogColor);
  skyLight.intensity = isNight ? 0.48 : 1.8;
  skyLight.color.set(isNight ? 0x60749e : 0xb9dcff);
  skyLight.groundColor.set(isNight ? 0x101625 : 0x263127);
  moon.intensity = isNight ? 0.28 : 2.8;
  moon.color.set(isNight ? 0x8b9bc4 : 0xffd7a3);
  stars.visible = isNight;
  cloudLayer.visible = !isNight;
  sun.visible = !isNight;
  nightMoon.visible = isNight;
  buildingWindowMaterial.emissiveIntensity = isNight ? 2.2 : 0;
  buildingWindowMaterial.color.set(isNight ? 0xffe0a0 : 0x405351);
}

const ground = box(WORLD_WIDTH + 30, 0.25, WORLD_DEPTH + 30, mat(0x263635), WORLD_CENTER_X, -0.14, WORLD_CENTER_Z);
const ocean = box(110, 0.3, 70, mat(palette.ocean, 0.35), 0, -0.02, -55);
box(
  GUANABARA_BAY.maxX - GUANABARA_BAY.minX,
  0.08,
  GUANABARA_BAY.maxZ - GUANABARA_BAY.minZ,
  mat(palette.ocean, 0.35),
  (GUANABARA_BAY.minX + GUANABARA_BAY.maxX) / 2,
  -0.005,
  (GUANABARA_BAY.minZ + GUANABARA_BAY.maxZ) / 2
);
const sand = box(110, 0.2, 8, mat(palette.sand), 0, 0.05, -18);
const road = box(WORLD_WIDTH, 0.18, 16, mat(palette.asphalt), WORLD_CENTER_X, 0.07, -6);
const sideWalk = mat(palette.sidewalk);
box(WORLD_WIDTH, 0.28, 2.5, sideWalk, WORLD_CENTER_X, .18, -15);
box(WORLD_WIDTH, 0.28, 2.5, sideWalk, WORLD_CENTER_X, .18, 3);
const roadMarkingMaterial = mat(0xd4c979);
for (let x = WORLD_BOUNDS.minX + 4; x < WORLD_BOUNDS.maxX; x += 16) {
  box(4.6, .03, .12, roadMarkingMaterial, x, .18, -6);
}

function getSurfaceHeight(x, z) {
  if (x >= TIJUCA_BEACH.minX && x <= TIJUCA_BEACH.maxX && z >= -290 && z <= -268) return 0.13;
  const mountainHeight = getTijucaMountainHeight(x, z);
  if (mountainHeight !== null) return mountainHeight;

  const bridge = NITEROI_BRIDGE;
  if (Math.abs(x - bridge.x) <= bridge.width / 2 + 1) {
    if (z >= bridge.startZ && z < bridge.deckStartZ) {
      return bridge.approachY * (z - bridge.startZ) / (bridge.deckStartZ - bridge.startZ);
    }
    if (z >= bridge.deckStartZ && z < bridge.highStartZ) {
      return bridge.approachY
        + (bridge.deckY - bridge.approachY) * (z - bridge.deckStartZ) / (bridge.highStartZ - bridge.deckStartZ);
    }
    if (z >= bridge.highStartZ && z <= bridge.highEndZ) return bridge.deckY;
    if (z > bridge.highEndZ && z <= bridge.deckEndZ) {
      return bridge.deckY
        - (bridge.deckY - bridge.approachY) * (z - bridge.highEndZ) / (bridge.deckEndZ - bridge.highEndZ);
    }
    if (z > bridge.deckEndZ && z <= bridge.endZ) {
      return bridge.approachY * (bridge.endZ - z) / (bridge.endZ - bridge.deckEndZ);
    }
  }

  if (z >= -14 && z <= 2) return 0.16;
  if ((z >= -16.25 && z < -14) || (z > 2 && z <= 4.25)) return 0.32;
  if (z >= -22 && z < -16.25) return 0.15;
  return 0;
}

function mountain(x, z, scale, color) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(16 * scale, 32 * scale, 7), mat(color));
  m.position.set(x, 14 * scale - .2, z); m.rotation.y = .25; m.castShadow = true; scene.add(m);
}
mountain(-51, -44, 1.6, palette.mountainFar); mountain(-22, -48, 1.25, palette.mountain); mountain(19, -49, 1.7, palette.mountainFar); mountain(53, -46, 1.1, palette.mountain);

const buildingTrimMaterial = mat(0xd6c197);
const buildingBalconyMaterial = mat(0x77766b);
const buildingRoofMaterial = mat(0x494b46);

function building(x, z, w, h, d, color, floors = 4, style = 0) {
  const variant = style % 4;
  const lowerHeight = variant === 1 ? h * 0.72 : h;
  const b = box(w, lowerHeight, d, mat(color), x, lowerHeight / 2, z);
  registerStructureCollider(x, z, w, d, 0, h);

  if (variant === 1) {
    const upperHeight = h - lowerHeight;
    box(w * 0.72, upperHeight, d * 0.76, mat(color), x, lowerHeight + upperHeight / 2, z);
    box(w * 0.78, 0.3, d * 0.82, buildingRoofMaterial, x, lowerHeight, z);
  } else if (variant === 2) {
    const floorHeight = h / floors;
    for (let floor = 1; floor < floors; floor += 2) {
      const balconyY = floor * floorHeight;
      const balconyZ = z - d / 2 + 0.35;
      box(w * 0.42, 0.12, 0.55, buildingBalconyMaterial, x, balconyY, balconyZ);
      box(w * 0.42, 0.12, 0.08, buildingTrimMaterial, x, balconyY + 0.48, balconyZ - 0.22);
    }
  } else if (variant === 3) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 1.3, 8), buildingRoofMaterial);
    tank.position.set(x + w * 0.22, h + 0.65, z + d * 0.18);
    tank.castShadow = true;
    scene.add(tank);
    box(w * 0.86, 0.24, d * 0.86, buildingTrimMaterial, x, h - 0.12, z);
  } else {
    box(w * 0.92, 0.2, d * 0.92, buildingRoofMaterial, x, h + 0.1, z);
  }

  const floorHeight = h / floors;
  for (let floor = 0; floor < floors; floor++) {
    const windowWidth = variant === 1 && (floor + 0.5) * floorHeight > lowerHeight ? w * 0.72 : w;
    const columns = variant === 3 ? [-0.32, 0, 0.32] : [-0.25, 0.25];
    for (const column of columns) {
      const window = box(
        variant === 2 ? 0.38 : 0.48,
        Math.min(0.58, floorHeight * 0.42),
        0.025,
        buildingWindowMaterial,
        x + column * windowWidth,
        (floor + 0.5) * floorHeight,
        z - d / 2 - 0.02
      );
      window.castShadow = false;
    }
  }

  if (variant === 0) {
    for (const side of [-1, 1]) {
      const pilaster = box(0.14, h, 0.16, buildingTrimMaterial, x + side * w * 0.44, h / 2, z - d / 2 + 0.08);
      pilaster.castShadow = false;
    }
  }
  return b;
}
for (let i = 0; i < 12; i++) {
  const x = -50 + i * 9.2;
  if (isOnTijucaMountain(x, 10 + (i % 2) * 4, 5)) continue;
  building(x, 10 + (i % 2) * 4, 6.2, 9 + (i % 4) * 2.4, 5, i % 3 === 0 ? palette.cream : i % 3 === 1 ? palette.building : 0x58766c, 4, i % 4);
}

function palm(x, z, size = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.22 * size, .34 * size, 4.5 * size, 7), mat(0x72543a));
  trunk.position.set(x, 2.25 * size, z); trunk.rotation.z = -.08; trunk.castShadow = true; scene.add(trunk);
  const crown = new THREE.Group(); crown.position.set(x, 4.6 * size, z); scene.add(crown);
  for (let i = 0; i < 7; i++) { const leaf = new THREE.Mesh(new THREE.BoxGeometry(.17 * size, .08 * size, 3.2 * size), mat(0x5e844e)); leaf.rotation.y = i * Math.PI / 3.5; leaf.rotation.x = -.24; leaf.position.z = -1.3 * size; leaf.castShadow = true; crown.add(leaf); }
}
[-42, -28, -8, 14, 37, 49].forEach((x, i) => palm(x, -13 + (i % 2) * 1.2, .9 + (i % 3) * .13));

function beachUmbrella(x, z, scale = 1) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.1 * scale, 2.2 * scale, 8), mat(0xe5d4a9));
  pole.position.y = 1.1 * scale;
  group.add(pole);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.9 * scale, 1.1 * scale, 12), mat(0xefd576));
  canopy.position.y = 2.05 * scale;
  canopy.rotation.x = Math.PI;
  group.add(canopy);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38 * scale, 0.48 * scale, 0.2 * scale, 12), mat(0x7b5f43));
  base.position.y = 0.1 * scale;
  group.add(base);
  group.position.set(x, 0.18, z);
  scene.add(group);
  return group;
}

function streetLamp(x, z, height = 3.6) {
  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, height, 8), mat(0x2a2a2a));
  pole.position.y = height / 2;
  lamp.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.08, 0.08), mat(0x3c3c3c));
  arm.position.set(0.38, height - 0.36, 0);
  lamp.add(arm);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), new THREE.MeshStandardMaterial({ color: 0xf4d89d, emissive: 0xf4d89d, emissiveIntensity: 0.45 }));
  light.position.set(0.8, height - 0.34, 0);
  lamp.add(light);
  lamp.position.set(x, 0.18, z);
  scene.add(lamp);
  return lamp;
}

function bench(x, z, rotation = 0) {
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.42), mat(0x7a4a2d));
  seat.position.y = 0.45;
  bench.add(seat);
  for (const sx of [-0.42, 0.42]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), mat(0x4a3020));
    leg.position.set(sx, 0.2, 0.12);
    bench.add(leg);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 0.12), mat(0x6b3e2b));
    back.position.set(0, 0.76, -0.12);
    bench.add(back);
  }
  bench.position.set(x, 0.18, z);
  bench.rotation.y = rotation;
  scene.add(bench);
  return bench;
}

function planter(x, z, scale = 1) {
  const group = new THREE.Group();
  const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 0.6 * scale, 0.9 * scale), mat(0x6f5a4a));
  boxMesh.position.y = 0.3 * scale;
  group.add(boxMesh);
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.5 * scale, 10, 10), mat(0x3c7d43));
  bush.position.y = 0.8 * scale;
  group.add(bush);
  group.position.set(x, 0.18, z);
  scene.add(group);
  return group;
}

function beachDetail() {
  const sandStrip = box(110, 0.18, 18, mat(palette.sand), 0, 0.04, -25);
  sandStrip.receiveShadow = true;
  for (let i = -45; i <= 45; i += 10) {
    beachUmbrella(i, -27 + (i % 20 === 0 ? 1.2 : 0), 1.1);
  }
  for (let i = -45; i <= 45; i += 12) {
    bench(i + 2, -20 + ((i / 12) % 2) * 2, (i % 24 === 0 ? 0.6 : -0.6));
  }
  for (let x = -48; x <= 48; x += 12) {
    const planterInstance = planter(x, -13.8, 1.1);
    planterInstance.rotation.y = x % 24 === 0 ? 0.5 : -0.3;
  }
  for (let x = -48; x <= 48; x += 12) {
    streetLamp(x, -8.8, 3.8);
    streetLamp(x, 4.5, 3.8);
  }

  for (let i = -46; i <= 46; i += 10) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.12), mat(0xf4d780));
    sign.position.set(i, 1.6, -18.0);
    scene.add(sign);
  }

  const lowWall = new THREE.Mesh(new THREE.BoxGeometry(110, 0.35, 0.35), mat(0x9c825d));
  lowWall.position.set(0, 0.25, -15.5);
  lowWall.receiveShadow = true;
  scene.add(lowWall);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(110, 0.9, 0.08), mat(0xc9d2d7));
  rail.position.set(0, 1.0, -16.2);
  rail.castShadow = true;
  scene.add(rail);

  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(110, 0.12, 2.7), mat(0xd7c39c));
  boardwalk.position.set(0, 0.18, -18.7);
  boardwalk.receiveShadow = true;
  scene.add(boardwalk);
}
beachDetail();

for (let x = -50; x <= 50; x += 7) {
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.5 + (Math.abs(x) % 9) * 0.04, 12, 12), mat(0x3d7448));
  bush.position.set(x, 0.8, 9.5 + (Math.abs(x) % 3));
  bush.castShadow = true;
  scene.add(bush);
}

for (let x = -48; x <= 48; x += 10) {
  const smallTree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.5, 8), mat(0x684f2d));
  trunk.position.y = 0.75;
  smallTree.add(trunk);
  const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 10), mat(0x498b52));
  foliage.position.y = 1.8;
  smallTree.add(foliage);
  smallTree.position.set(x, 0.15, 11.9 + (Math.abs(x) % 5) * 0.3);
  smallTree.rotation.y = x * 0.2;
  scene.add(smallTree);
}

function createExtendedDistricts() {
  const asphaltMaterial = mat(palette.asphalt);
  const sidewalkMaterial = mat(palette.sidewalk);
  const localRoadMaterial = mat(0x303b3b);
  const islandMaterial = mat(0x386848);
  const districtColors = [palette.cream, palette.building, 0x58766c, 0x9b795f, 0x74806d];
  const horizontalRoads = [];
  const addHorizontalRoad = (minX, maxX, z) => {
    if (maxX <= minX) return;
    const addRoadSegment = (segmentStartX, segmentEndX) => {
      if (segmentEndX <= segmentStartX) return;
      const width = segmentEndX - segmentStartX;
      const centerX = (segmentStartX + segmentEndX) / 2;
      box(width, 0.18, 10, asphaltMaterial, centerX, 0.07, z);
      box(width, 0.24, 1.1, sidewalkMaterial, centerX, 0.14, z - 5.8);
      box(width, 0.24, 1.1, sidewalkMaterial, centerX, 0.14, z + 5.8);
    };

    const distanceZ = z - TIJUCA_MOUNTAIN.z;
    if (Math.abs(distanceZ) >= TIJUCA_MOUNTAIN.radius + 5) {
      addRoadSegment(minX, maxX);
      return;
    }
    const halfCutout = Math.sqrt(Math.max(0, TIJUCA_MOUNTAIN.radius ** 2 - distanceZ ** 2)) + 5;
    addRoadSegment(minX, Math.min(maxX, TIJUCA_MOUNTAIN.x - halfCutout));
    addRoadSegment(Math.max(minX, TIJUCA_MOUNTAIN.x + halfCutout), maxX);
  };

  for (let z = WORLD_BOUNDS.minZ + 20; z < WORLD_BOUNDS.maxZ; z += 60) {
    if (Math.abs(z + 6) < 28) continue;
    horizontalRoads.push(z);
    if (z >= TIJUCA_BEACH.minZ && z <= TIJUCA_BEACH.maxZ) {
      addHorizontalRoad(WORLD_BOUNDS.minX, TIJUCA_BEACH.minX, z);
      addHorizontalRoad(TIJUCA_BEACH.maxX, WORLD_BOUNDS.maxX, z);
    } else if (z >= GUANABARA_BAY.minZ && z <= GUANABARA_BAY.maxZ) {
      addHorizontalRoad(WORLD_BOUNDS.minX, GUANABARA_BAY.minX, z);
      addHorizontalRoad(GUANABARA_BAY.maxX, WORLD_BOUNDS.maxX, z);
    } else {
      addHorizontalRoad(WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX, z);
    }
  }

  const verticalRoads = [];
  for (let x = WORLD_BOUNDS.minX + 20; x < WORLD_BOUNDS.maxX; x += 60) {
    verticalRoads.push(x);
    const addVerticalRoad = (minZ, maxZ) => {
      if (maxZ <= minZ) return;
      if (x >= TIJUCA_BEACH.minX && x <= TIJUCA_BEACH.maxX
        && minZ < TIJUCA_BEACH.maxZ && maxZ > TIJUCA_BEACH.minZ) {
        addVerticalRoad(minZ, TIJUCA_BEACH.minZ);
        addVerticalRoad(TIJUCA_BEACH.maxZ, maxZ);
        return;
      }
      const addRoadSegment = (segmentStartZ, segmentEndZ) => {
        if (segmentEndZ <= segmentStartZ) return;
        const depth = segmentEndZ - segmentStartZ;
        const centerZ = (segmentStartZ + segmentEndZ) / 2;
        box(10, 0.18, depth, asphaltMaterial, x, 0.07, centerZ);
        box(1.1, 0.24, depth, sidewalkMaterial, x - 5.8, 0.14, centerZ);
        box(1.1, 0.24, depth, sidewalkMaterial, x + 5.8, 0.14, centerZ);
      };
      const distanceX = x - TIJUCA_MOUNTAIN.x;
      if (Math.abs(distanceX) >= TIJUCA_MOUNTAIN.radius + 6) {
        addRoadSegment(minZ, maxZ);
        return;
      }
      const halfCutout = Math.sqrt(Math.max(0, TIJUCA_MOUNTAIN.radius ** 2 - distanceX ** 2)) + 6;
      addRoadSegment(minZ, Math.min(maxZ, TIJUCA_MOUNTAIN.z - halfCutout));
      addRoadSegment(Math.max(minZ, TIJUCA_MOUNTAIN.z + halfCutout), maxZ);
    };

    addVerticalRoad(WORLD_BOUNDS.minZ, GUANABARA_BAY.minZ);
    addVerticalRoad(GUANABARA_BAY.maxZ, WORLD_BOUNDS.maxZ);
  }

  const addLocalRoadSegment = (startX, startZ, endX, endZ, width = 8) => {
    const deltaX = endX - startX;
    const deltaZ = endZ - startZ;
    const segment = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.19, Math.hypot(deltaX, deltaZ)),
      localRoadMaterial
    );
    segment.position.set((startX + endX) / 2, 0.075, (startZ + endZ) / 2);
    segment.rotation.y = Math.atan2(deltaX, deltaZ);
    segment.receiveShadow = true;
    scene.add(segment);
  };

  for (const layout of LOCAL_STREET_LAYOUTS) {
    if (layout.type === 'roundabout') {
      const ringRoad = new THREE.Mesh(
        new THREE.RingGeometry(layout.radius - 3.5, layout.radius + 3.5, 48),
        localRoadMaterial
      );
      ringRoad.rotation.x = -Math.PI / 2;
      ringRoad.position.set(layout.x, 0.16, layout.z);
      ringRoad.receiveShadow = true;
      scene.add(ringRoad);

      const island = new THREE.Mesh(new THREE.CircleGeometry(layout.radius - 3.6, 32), islandMaterial);
      island.rotation.x = -Math.PI / 2;
      island.position.set(layout.x, 0.12, layout.z);
      island.receiveShadow = true;
      scene.add(island);
      addLocalRoadSegment(layout.x, layout.z - 30, layout.x, layout.z - layout.radius);
    } else {
      const bulbZ = layout.z + 14;
      addLocalRoadSegment(layout.x, layout.z - 30, layout.x, bulbZ, 8);
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(layout.radius, 32), localRoadMaterial);
      bulb.rotation.x = -Math.PI / 2;
      bulb.position.set(layout.x, 0.16, bulbZ);
      bulb.receiveShadow = true;
      scene.add(bulb);

      const centerIsland = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), islandMaterial);
      centerIsland.rotation.x = -Math.PI / 2;
      centerIsland.position.set(layout.x, 0.18, bulbZ);
      scene.add(centerIsland);
    }
  }

  let randomSeed = 48151623;
  const random = () => {
    randomSeed = (randomSeed * 16807) % 2147483647;
    return (randomSeed - 1) / 2147483646;
  };

  for (let xIndex = 0; xIndex < verticalRoads.length - 1; xIndex++) {
    const districtX = (verticalRoads[xIndex] + verticalRoads[xIndex + 1]) / 2;
    for (let zIndex = 0; zIndex < horizontalRoads.length - 1; zIndex++) {
      const districtZ = (horizontalRoads[zIndex] + horizontalRoads[zIndex + 1]) / 2;
      if (Math.abs(districtX) < 80 && districtZ > -65 && districtZ < 40) continue;
      const localStreetBlock = LOCAL_STREET_LAYOUTS.some((layout) =>
        Math.abs(districtX - layout.x) < 35 && Math.abs(districtZ - layout.z) < 35
      );
      const bridgeApproachBlocked = Math.abs(districtX - NITEROI_BRIDGE.x) < 72
        && districtZ >= NITEROI_BRIDGE.startZ - 70
        && districtZ <= NITEROI_BRIDGE.startZ + 85;
      if (
        (districtX > GUANABARA_BAY.minX && districtX < GUANABARA_BAY.maxX
          && districtZ > GUANABARA_BAY.minZ && districtZ < GUANABARA_BAY.maxZ)
        || localStreetBlock
        || (Math.abs(districtX - AMMU_RIO_LOCATION.x) < 30
          && Math.abs(districtZ - (AMMU_RIO_LOCATION.z - AMMU_RIO_ENTRANCE_OFFSET_Z)) < 30)
        || isOnTijucaMountain(districtX, districtZ, 30)
        || (districtX > 250 && districtZ < -235)
        || (Math.abs(districtX - 85) < 45 && Math.abs(districtZ + 80) < 45)
        || (districtX > -230 && districtX < 220 && districtZ > 900 && districtZ < 1190)
        || bridgeApproachBlocked
      ) continue;

      if (random() < 0.16) {
        box(34, 0.12, 34, mat(0x386848), districtX, 0.02, districtZ);
        for (let tree = 0; tree < 5; tree++) {
          const x = districtX - 13 + random() * 26;
          const z = districtZ - 13 + random() * 26;
          const height = 3 + random() * 2.5;
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, height, 6), mat(0x684f2d));
          trunk.position.set(x, height / 2 + 0.1, z);
          trunk.castShadow = true;
          scene.add(trunk);
          const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.8 + random() * 0.5, 7, 6), mat(0x3d7448));
          foliage.position.set(x, height + 0.3, z);
          foliage.castShadow = true;
          scene.add(foliage);
        }
        continue;
      }

      const buildingCount = 2 + Math.floor(random() * 2);
      for (let index = 0; index < buildingCount; index++) {
        const x = districtX + (index - (buildingCount - 1) / 2) * 16;
        if (isOnTijucaMountain(x, districtZ, 10)) continue;
        const width = 10 + random() * 4;
        const depth = 12 + random() * 4;
        const height = 7 + random() * 18;
        const floors = Math.max(2, Math.floor(height / 3.5));
        building(
          x,
          districtZ + (random() - 0.5) * 8,
          width,
          height,
          depth,
          districtColors[Math.floor(random() * districtColors.length)],
          floors,
          Math.floor(random() * 4)
        );
      }
    }
  }
}
createExtendedDistricts();

function createAmmuRio() {
  const store = new THREE.Group();
  store.name = 'Ammu-Rio';
  store.position.set(AMMU_RIO_LOCATION.x, 0, AMMU_RIO_LOCATION.z - AMMU_RIO_ENTRANCE_OFFSET_Z);
  store.userData.location = AMMU_RIO_LOCATION;
  const addBox = (width, height, depth, material, x, y, z, collidable = false) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    store.add(mesh);
    if (collidable) {
      registerStructureCollider(
        store.position.x + x,
        store.position.z + z,
        width,
        depth,
        y - height / 2,
        y + height / 2
      );
    }
    return mesh;
  };

  addBox(32, 0.38, 17, mat(0x8d8c7c), 0, 0.02, 0);
  addBox(30, 7.8, 0.6, mat(0x918d7d), 0, 4, -7.8, true);
  addBox(0.7, 7.8, 15.2, mat(0x8c897b), -14.65, 4, -0.1, true);
  addBox(0.7, 7.8, 15.2, mat(0x8c897b), 14.65, 4, -0.1, true);
  addBox(30, 0.5, 15.2, mat(0x5c5c53), 0, 7.9, -0.1);

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x243537,
    emissive: 0x102222,
    emissiveIntensity: 0.35,
    metalness: 0.25,
    roughness: 0.22,
    transparent: true,
    opacity: 0.76
  });
  for (const x of [-10.1, -4.8, 4.8, 10.1]) {
    addBox(4.6, 3.9, 0.16, windowMaterial, x, 2.65, 7.58, true);
  }
  addBox(2.7, 4.3, 0.22, mat(0x26302d), 0, 2.45, 7.62, true);
  for (const x of [-14, -7.3, 7.3, 14]) {
    addBox(0.48, 5.1, 0.48, mat(0xddd0b0), x, 2.8, 7.3, true);
  }
  addBox(30, 2.25, 0.8, mat(0xf0c900), 0, 6.3, 7.3);
  addBox(30, 0.22, 0.9, mat(0x192c30), 0, 5.14, 7.3);

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1200;
  signCanvas.height = 180;
  const signContext = signCanvas.getContext('2d');
  if (!signContext) throw new Error('Não foi possível criar a placa da Ammu-Rio.');
  signContext.fillStyle = '#f0c900';
  signContext.fillRect(0, 0, signCanvas.width, signCanvas.height);
  signContext.fillStyle = '#14272b';
  signContext.font = '900 104px Arial, sans-serif';
  signContext.textAlign = 'center';
  signContext.textBaseline = 'middle';
  signContext.fillText('AMMU-RIO', 600, 75);
  signContext.font = '700 27px Arial, sans-serif';
  signContext.fillText('ARMAS  •  MUNIÇÕES  •  EQUIPAMENTOS', 600, 145);
  signContext.strokeStyle = '#14272b';
  signContext.lineWidth = 8;
  signContext.beginPath();
  signContext.arc(1040, 75, 35, 0, Math.PI * 2);
  signContext.moveTo(1040, 25);
  signContext.lineTo(1040, 125);
  signContext.moveTo(990, 75);
  signContext.lineTo(1090, 75);
  signContext.stroke();
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 3.9),
    new THREE.MeshBasicMaterial({ map: signTexture, toneMapped: false })
  );
  sign.position.set(0, 6.4, 7.78);
  store.add(sign);

  const interiorRackMaterial = mat(0x59462e);
  for (const x of [-8.5, 8.5]) {
    addBox(4, 1.8, 0.5, interiorRackMaterial, x, 1.2, 4.4);
    for (let shelf = 0; shelf < 3; shelf++) {
      addBox(3.6, 0.08, 0.55, mat(0xc6a657), x, 0.65 + shelf * 0.55, 4.05);
    }
  }

  const signPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 1.05),
    new THREE.MeshBasicMaterial({ color: 0x174365, toneMapped: false })
  );
  signPanel.position.set(0, 4.15, 7.78);
  store.add(signPanel);
  const sideLabelCanvas = document.createElement('canvas');
  sideLabelCanvas.width = 512;
  sideLabelCanvas.height = 128;
  const sideLabelContext = sideLabelCanvas.getContext('2d');
  if (!sideLabelContext) throw new Error('Não foi possível criar a identificação da loja.');
  sideLabelContext.fillStyle = '#174365';
  sideLabelContext.fillRect(0, 0, 512, 128);
  sideLabelContext.fillStyle = '#f0c900';
  sideLabelContext.font = '900 68px Arial, sans-serif';
  sideLabelContext.textAlign = 'center';
  sideLabelContext.textBaseline = 'middle';
  sideLabelContext.fillText('AMMU-RIO', 256, 64);
  const sideTexture = new THREE.CanvasTexture(sideLabelCanvas);
  sideTexture.colorSpace = THREE.SRGBColorSpace;
  signPanel.material.map = sideTexture;
  signPanel.material.color.set(0xffffff);
  signPanel.material.needsUpdate = true;

  const marker = new THREE.Group();
  marker.name = 'Ammu-Rio entrance marker';
  marker.position.set(0, 0.14, AMMU_RIO_ENTRANCE_OFFSET_Z);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd21c, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
  );
  glow.rotation.x = -Math.PI / 2;
  marker.add(glow);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.9, 2.22, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd21c, transparent: true, opacity: 0.96, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  marker.add(ring);
  store.add(marker);
  store.userData.marker = marker;
  scene.add(store);
  window.__ammuRio = store;
  return store;
}

const ammuRio = createAmmuRio();

function createNiteroiDistrict() {
  const minX = -225;
  const maxX = 210;
  const minZ = 920;
  const maxZ = 1180;
  const streetMaterial = mat(palette.asphalt);
  const sidewalkMaterial = mat(palette.sidewalk);

  for (const z of [940, 1000, 1060, 1120, 1160]) {
    box(maxX - minX, 0.18, 10, streetMaterial, (minX + maxX) / 2, 0.07, z);
    box(maxX - minX, 0.24, 1.1, sidewalkMaterial, (minX + maxX) / 2, 0.14, z - 5.8);
    box(maxX - minX, 0.24, 1.1, sidewalkMaterial, (minX + maxX) / 2, 0.14, z + 5.8);
  }

  for (const x of [-180, -120, -60, 0, 60, 120, 180]) {
    box(10, 0.18, maxZ - minZ, streetMaterial, x, 0.07, (minZ + maxZ) / 2);
    box(1.1, 0.24, maxZ - minZ, sidewalkMaterial, x - 5.8, 0.14, (minZ + maxZ) / 2);
    box(1.1, 0.24, maxZ - minZ, sidewalkMaterial, x + 5.8, 0.14, (minZ + maxZ) / 2);
  }

  const colors = [palette.cream, palette.building, 0x58766c, 0x9b795f, 0x74806d];
  let buildingIndex = 0;
  for (let z = minZ + 24; z <= maxZ - 16; z += 42) {
    for (let x = minX + 24; x <= maxX - 20; x += 54) {
      const width = 13 + ((buildingIndex * 7) % 8);
      const depth = 15 + ((buildingIndex * 5) % 9);
      const height = 14 + ((buildingIndex * 11) % 34);
      building(
        x,
        z,
        width,
        height,
        depth,
        colors[buildingIndex % colors.length],
        Math.max(3, Math.floor(height / 3.5)),
        buildingIndex % 4
      );
      buildingIndex += 1;
    }
  }

  for (const x of [-200, -150, -90, -30, 30, 90, 150, 200]) {
    streetLamp(x, 930, 4.2);
    streetLamp(x, 1170, 4.2);
  }
}

createNiteroiDistrict();

function beamBetween(start, end, radius, material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 8), material);
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  beam.castShadow = true;
  scene.add(beam);
  return beam;
}

function createNiteroiBridge() {
  const bridge = NITEROI_BRIDGE;
  const deckMaterial = mat(0x4b5858);
  const railMaterial = mat(0xc1c6bd);
  const laneMarkingMaterial = mat(0xe4d37f);
  const edgeMarkingMaterial = mat(0xc4cec3);
  const segments = [
    { startZ: bridge.startZ, endZ: bridge.deckStartZ, startY: 0, endY: bridge.approachY },
    { startZ: bridge.deckStartZ, endZ: bridge.highStartZ, startY: bridge.approachY, endY: bridge.deckY },
    { startZ: bridge.highStartZ, endZ: bridge.highEndZ, startY: bridge.deckY, endY: bridge.deckY },
    { startZ: bridge.highEndZ, endZ: bridge.deckEndZ, startY: bridge.deckY, endY: bridge.approachY },
    { startZ: bridge.deckEndZ, endZ: bridge.endZ, startY: bridge.approachY, endY: 0 }
  ];
  const addBridgePart = (width, height, material, offsetX, verticalOffset, segment) => {
    const length = segment.endZ - segment.startZ;
    const middleZ = (segment.startZ + segment.endZ) / 2;
    const middleY = (segment.startY + segment.endY) / 2 + verticalOffset;
    const part = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
    part.position.set(bridge.x + offsetX, middleY, middleZ);
    part.rotation.x = -Math.atan2(segment.endY - segment.startY, length);
    part.receiveShadow = true;
    scene.add(part);
    if (material === railMaterial) {
      registerStructureCollider(
        bridge.x + offsetX,
        middleZ,
        width,
        length,
        Math.min(segment.startY, segment.endY),
        Math.max(segment.startY, segment.endY) + height
      );
    }
  };

  for (const segment of segments) {
    addBridgePart(bridge.width, 0.35, deckMaterial, 0, -0.175, segment);
    addBridgePart(0.16, 0.04, edgeMarkingMaterial, -bridge.width / 2 + 0.45, 0.03, segment);
    addBridgePart(0.16, 0.04, edgeMarkingMaterial, bridge.width / 2 - 0.45, 0.03, segment);

    for (const side of [-1, 1]) {
      addBridgePart(0.22, 0.8, railMaterial, side * (bridge.width / 2 - 0.25), 0.4, segment);
    }
  }

  for (let z = bridge.startZ + 12; z < bridge.endZ; z += 22) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 9), laneMarkingMaterial);
    dash.position.set(bridge.x, getSurfaceHeight(bridge.x, z) + 0.03, z);
    scene.add(dash);
  }

  const supportMaterial = mat(0x687675);
  const footingMaterial = mat(0x536261);
  const seabedY = -3;
  for (let z = bridge.deckStartZ + 42; z < bridge.deckEndZ - 24; z += 68) {
    const deckHeight = getSurfaceHeight(bridge.x, z);
    const pierTop = deckHeight - 0.35;
    const pierHeight = pierTop - seabedY;
    const crossbeam = new THREE.Mesh(
      new THREE.BoxGeometry(bridge.width + 1.2, 1.1, 2.4),
      supportMaterial
    );
    crossbeam.position.set(bridge.x, pierTop - 0.55, z);
    crossbeam.castShadow = true;
    crossbeam.receiveShadow = true;
    scene.add(crossbeam);

    for (const side of [-1, 1]) {
      const pierX = bridge.x + side * 4.7;
      const footing = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 4.2), footingMaterial);
      footing.position.set(pierX, seabedY - 0.35, z);
      footing.castShadow = true;
      footing.receiveShadow = true;
      scene.add(footing);

      const pier = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 1.35, pierHeight, 10),
        supportMaterial
      );
      pier.position.set(pierX, (pierTop + seabedY) / 2, z);
      pier.castShadow = true;
      pier.receiveShadow = true;
      scene.add(pier);
      registerStructureCollider(pierX, z, 2.7, 2.7, seabedY, pierTop);
    }
  }
}

function createTijucaMountain() {
  const mountain = TIJUCA_MOUNTAIN;
  const segments = 64;
  const rings = 24;
  const vertices = [];
  const indices = [];
  for (let ring = 0; ring <= rings; ring++) {
    const progress = ring / rings;
    const radius = mountain.radius * progress;
    for (let segment = 0; segment <= segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const baseHeight = getTijucaMountainHeight(mountain.x + x, mountain.z + z) || 0;
      const rockyVariation = Math.sin(angle * 5 + 0.8) * 1.1 * progress * (1 - progress);
      vertices.push(x, baseHeight + rockyVariation, z);
      if (ring < rings && segment < segments) {
        const current = ring * (segments + 1) + segment;
        const next = current + segments + 1;
        indices.push(current, current + 1, next, current + 1, next + 1, next);
      }
    }
  }

  const terrainGeometry = new THREE.BufferGeometry();
  terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  terrainGeometry.setIndex(indices);
  terrainGeometry.computeVertexNormals();
  const terrain = new THREE.Mesh(
    terrainGeometry,
    new THREE.MeshStandardMaterial({ color: 0x344c3c, roughness: 1, flatShading: true })
  );
  terrain.position.set(mountain.x, 0, mountain.z);
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  scene.add(terrain);
  window.__tijucaMountain = terrain;

  const summit = new THREE.Mesh(new THREE.CylinderGeometry(mountain.summitRadius, mountain.summitRadius + 1, 0.8, 16), mat(0x94886d));
  summit.position.set(mountain.x, mountain.height - 0.4, mountain.z);
  summit.receiveShadow = true;
  scene.add(summit);

  const christ = new THREE.Group();
  christ.position.set(mountain.x, mountain.height, mountain.z);
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.5, 7.5, 8), mat(0xe5dfcf));
  robe.position.y = 4.15;
  christ.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), mat(0xe5dfcf));
  head.position.y = 8.55;
  christ.add(head);
  const arms = new THREE.Mesh(new THREE.BoxGeometry(13, 0.72, 0.95), mat(0xe5dfcf));
  arms.position.y = 6.65;
  christ.add(arms);
  christ.traverse((part) => {
    if (part.isMesh) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });
  scene.add(christ);
  window.__cristoRedentor = christ;
}

function createSugarloafIsland() {
  const islandX = 85;
  const islandZ = -80;
  const shore = new THREE.Mesh(
    new THREE.CylinderGeometry(22, 28, 4, 12),
    mat(0xc2a878)
  );
  shore.position.set(islandX, 1.9, islandZ);
  shore.receiveShadow = true;
  scene.add(shore);

  const peak = new THREE.Mesh(new THREE.ConeGeometry(22, 48, 8), mat(0x77796f));
  peak.position.set(islandX, 27.5, islandZ);
  peak.rotation.z = -0.08;
  peak.castShadow = true;
  peak.receiveShadow = true;
  scene.add(peak);

  const cableMaterial = mat(0x383f3d);
  beamBetween(new THREE.Vector3(48, 20, islandZ), new THREE.Vector3(islandX, 44, islandZ), 0.12, cableMaterial);
  for (const progress of [0.35, 0.7]) {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2, 2.4), mat(progress < 0.5 ? 0xe8d5a7 : 0xd64f3e));
    cabin.position.set(48 + (islandX - 48) * progress, 20 + 24 * progress - 1, islandZ);
    cabin.castShadow = true;
    scene.add(cabin);
  }
}

function createTijucaBeach() {
  const beachX = 375;
  const beachLength = 190;
  const water = box(
    TIJUCA_BEACH.maxX - TIJUCA_BEACH.minX,
    0.08,
    TIJUCA_BEACH.maxZ - TIJUCA_BEACH.minZ,
    mat(palette.ocean, 0.35),
    (TIJUCA_BEACH.minX + TIJUCA_BEACH.maxX) / 2,
    -0.005,
    (TIJUCA_BEACH.minZ + TIJUCA_BEACH.maxZ) / 2
  );
  water.receiveShadow = true;
  const sandStrip = box(beachLength, 0.18, 22, mat(palette.sand), beachX, 0.04, -279);
  sandStrip.receiveShadow = true;
  box(beachLength, 0.12, 4, mat(0xd7c39c), beachX, 0.16, -264);

  for (let x = beachX - 80; x <= beachX + 80; x += 20) {
    beachUmbrella(x, -278 + (x % 40 === 0 ? 1 : 0), 0.9);
    palm(x + 8, -260, 0.8);
  }
}

createNiteroiBridge();
createTijucaMountain();
createSugarloafIsland();
createTijucaBeach();

const promenade = new THREE.Mesh(new THREE.BoxGeometry(110, 0.14, 5.4), mat(0xd9c39b));
promenade.position.set(0, 0.21, -11.6);
promenade.receiveShadow = true;
scene.add(promenade);

const carStopStripe = new THREE.Mesh(new THREE.BoxGeometry(100, 0.02, 0.22), mat(0xf5efdc));
carStopStripe.position.set(0, 0.24, -8.2);
scene.add(carStopStripe);

function makeCar(color = palette.car, scale = 1) {
  const car = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1 * scale, .65 * scale, 4.1 * scale), mat(color)); body.position.y = .7 * scale; body.castShadow = true; car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55 * scale, .65 * scale, 1.95 * scale), mat(0x263d3d, .25)); cabin.position.set(0, 1.18 * scale, -.2 * scale); cabin.castShadow = true; car.add(cabin);
  const wheelMat = mat(0x151b1c); for (const x of [-1, 1]) for (const z of [-1.35, 1.35]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.4 * scale, .4 * scale, .25 * scale, 12), wheelMat); wheel.rotation.z = Math.PI / 2; wheel.position.set(x * 1.02 * scale, .43 * scale, z * scale); car.add(wheel); }
  return car;
}
const player = new THREE.Group(); player.position.set(NITEROI_BRIDGE.x, 0, NITEROI_BRIDGE.startZ - 8); scene.add(player);
window.__player = player;

const playerState = {
  crouching: false,
  jumping: false,
  inCar: false,
  inHelicopter: false,
  enteringCar: false,
  vehicleType: null,
  hasPistol: false,
  hasSniper: false,
  hasShotgun: false,
  equippedWeapon: 'fists',
  stopForwardAnimationPending: false,
  jumpVelocity: 0,
  jumpHeight: 0,
  grounded: true,
  punching: false,
  punchQueued: false,
  currentPunchAction: null,
  carTarget: null,
  enterProgress: 0,
  cameraZoom: 58
};

function createFallbackPlayer() {
  const fallback = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.1, 8, 12), mat(0xd2f06d));
  body.position.y = 1.1;
  body.castShadow = true;
  fallback.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 18), mat(0xe3ad7c));
  head.position.y = 2.15;
  head.castShadow = true;
  fallback.add(head);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.28), mat(0xf07e4f));
  torso.position.set(0, 1.2, 0.28);
  torso.castShadow = true;
  fallback.add(torso);
  return fallback;
}

let playerModel = null;
let walkAnimationMixer = null;
let walkAnimationAction = null;
let rightStrafeAnimationAction = null;
let leftStrafeAnimationAction = null;
let backwardWalkAnimationAction = null;
let jumpAnimationAction = null;
let runAnimationAction = null;
let stopWalkingAnimationAction = null;
let punchAnimationAction = null;
let punchComboAnimationAction = null;
let enterCarAnimationAction = null;
let walkAnimationReady = false;
let activeLocomotionAction = null;
let pendingPunchTimer = null;
let queuedPunchType = null;
const punchComboClickWindow = 300;
const fadingLocomotionActions = new Map();
let playerRig = null;
const loader = new GLTFLoader();
const pistolPickupLocation = new THREE.Vector3(-21.07729756539182, 0, 115.64982090017871);
const shotgunPickupLocation = new THREE.Vector3(169.41620354459977, 0, 90.20525881272454);
let pistolPickup = null;
let pistolPickupElapsed = 0;
let pistolModel = null;
let pistolHand = null;
let shotgunPickup = null;
let shotgunPickupElapsed = 0;
let shotgunModel = null;
let shotgunHand = null;
let sniperHand = null;
const sniperModel = new THREE.Group();
sniperModel.name = 'Sniper rifle';
sniperModel.visible = false;
const sniperMetal = mat(0x26302f, 0.48);
const sniperGrip = mat(0x473b30, 0.78);
const sniperScopeMaterial = mat(0x111817, 0.3);
const sniperReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.42), sniperMetal);
sniperReceiver.position.z = 0.05;
sniperReceiver.castShadow = true;
sniperModel.add(sniperReceiver);
const sniperBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 1.1, 8), sniperMetal);
sniperBarrel.rotation.x = Math.PI / 2;
sniperBarrel.position.set(0, 0.015, 0.78);
sniperBarrel.castShadow = true;
sniperModel.add(sniperBarrel);
const sniperStock = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.48), sniperGrip);
sniperStock.position.set(0, -0.015, -0.37);
sniperStock.castShadow = true;
sniperModel.add(sniperStock);
const sniperScope = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 10), sniperScopeMaterial);
sniperScope.rotation.x = Math.PI / 2;
sniperScope.position.set(0, 0.13, 0.05);
sniperScope.castShadow = true;
sniperModel.add(sniperScope);
const sniperMount = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.1, 0.18), sniperMetal);
sniperMount.position.set(0, 0.07, 0.05);
sniperModel.add(sniperMount);
player.add(sniperModel);
const heldPistolPosition = new THREE.Vector3();
const heldShotgunPosition = new THREE.Vector3();
const heldPistolOffset = new THREE.Vector3(0, 0, 0.08);
const heldPistolOffsetWorld = new THREE.Vector3();
const heldShotgunOffset = new THREE.Vector3(0, 0, 0.08);
const heldShotgunOffsetWorld = new THREE.Vector3();
const heldPistolWorldQuaternion = new THREE.Quaternion();
const heldShotgunWorldQuaternion = new THREE.Quaternion();
const heldSniperPosition = new THREE.Vector3();
const heldSniperOffset = new THREE.Vector3(0, 0, 0.08);
const heldSniperOffsetWorld = new THREE.Vector3();
const heldSniperWorldQuaternion = new THREE.Quaternion();
const playerWorldQuaternion = new THREE.Quaternion();
const inversePlayerWorldQuaternion = new THREE.Quaternion();
const heldPistolGripRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2));
const heldShotgunGripRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2));
const heldSniperGripRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2));
const pistolPickupRadius = 0.9;
const shotgunPickupRadius = 1.2;
const weaponIcon = document.getElementById('weapon-icon');
const weaponName = document.getElementById('weapon-name');

loader.load(
  '/assets/weapons/9mm_pistol.glb',
  (gltf) => {
    const pickup = new THREE.Group();
    const model = gltf.scene;
    model.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    const largestDimension = Math.max(size.x, size.y, size.z);
    if (largestDimension <= 0) {
      console.error('O modelo da pistola 9mm não possui dimensões válidas.');
      return;
    }

    const modelScale = 1.1 / largestDimension;
    model.scale.setScalar(modelScale);
    model.position.set(-center.x * modelScale, -center.y * modelScale, -center.z * modelScale);
    model.userData.pickupScale = modelScale;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    pickup.add(model);

    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.58, 32),
      new THREE.MeshBasicMaterial({ color: palette.acid, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = -1.08;
    pickup.add(marker);

    pickup.position.set(
      pistolPickupLocation.x,
      getSurfaceHeight(pistolPickupLocation.x, pistolPickupLocation.z) + 1.25,
      pistolPickupLocation.z
    );
    pickup.userData.baseY = pickup.position.y;
    scene.add(pickup);
    pistolPickup = pickup;
    pistolModel = model;
  },
  undefined,
  (error) => console.error('Erro ao carregar a pistola 9mm:', error)
);

function attachWeaponToPlayer(model, pickup, weaponScale, weaponName) {
  if (!model || !playerModel) return false;
  const hand = playerModel.getObjectByName('mixamorigRightHand_035')
    || playerModel.getObjectByName('mixamorigRightHand')
    || null;
  if (!hand) {
    console.error(`Não foi possível encontrar a mão direita do personagem para equipar ${weaponName}.`);
    return false;
  }

  if (pickup) {
    pickup.remove(model);
    pickup.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    });
    scene.remove(pickup);
  }
  model.position.set(0, 0, 0);
  model.scale.setScalar(model.userData.pickupScale * weaponScale);
  player.add(model);
  return true;
}

function collectPistol() {
  if (!pistolPickup || !pistolModel || playerState.hasPistol) return;
  if (!attachWeaponToPlayer(pistolModel, pistolPickup, 0.4, 'a pistola 9mm')) return;
  pistolHand = playerModel.getObjectByName('mixamorigRightHand_035')
    || playerModel.getObjectByName('mixamorigRightHand');
  pistolPickup = null;
  playerState.hasPistol = true;
  setEquippedWeapon('pistol');
}

loader.load(
  '/assets/weapons/shotgun/scene.gltf',
  (gltf) => {
    const pickup = new THREE.Group();
    const model = gltf.scene;
    model.name = 'shotgun';
    model.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    const largestDimension = Math.max(size.x, size.y, size.z);
    if (largestDimension <= 0) {
      console.error('O modelo da escopeta não possui dimensões válidas.');
      return;
    }

    const modelScale = 1.35 / largestDimension;
    model.scale.setScalar(modelScale);
    model.position.set(-center.x * modelScale, -center.y * modelScale, -center.z * modelScale);
    model.userData.pickupScale = modelScale;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    pickup.add(model);

    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.76, 40),
      new THREE.MeshBasicMaterial({ color: palette.acid, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = -0.82;
    pickup.add(marker);

    pickup.position.set(
      shotgunPickupLocation.x,
      getSurfaceHeight(shotgunPickupLocation.x, shotgunPickupLocation.z) + 1,
      shotgunPickupLocation.z
    );
    pickup.userData.baseY = pickup.position.y;
    scene.add(pickup);
    shotgunPickup = pickup;
    shotgunModel = model;
  },
  undefined,
  (error) => console.error('Erro ao carregar a escopeta:', error)
);

function collectShotgun() {
  if (!shotgunPickup || !shotgunModel || playerState.hasShotgun) return;
  if (!attachWeaponToPlayer(shotgunModel, shotgunPickup, 0.58, 'a escopeta')) return;
  shotgunHand = playerModel.getObjectByName('mixamorigRightHand_035')
    || playerModel.getObjectByName('mixamorigRightHand')
    || null;
  shotgunPickup = null;
  playerState.hasShotgun = true;
  setEquippedWeapon('shotgun');
}

function setEquippedWeapon(weapon) {
  if (weapon === 'pistol' && !playerState.hasPistol) return;
  if (weapon === 'sniper' && !playerState.hasSniper) return;
  if (weapon === 'shotgun' && !playerState.hasShotgun) return;
  playerState.equippedWeapon = weapon;
  const hasPistolEquipped = weapon === 'pistol';
  const hasSniperEquipped = weapon === 'sniper';
  const hasShotgunEquipped = weapon === 'shotgun';
  if (pistolModel) pistolModel.visible = hasPistolEquipped;
  sniperModel.visible = hasSniperEquipped;
  if (shotgunModel) shotgunModel.visible = hasShotgunEquipped;
  weaponIcon.src = hasPistolEquipped
    ? '/assets/pistol-icon.png'
    : hasSniperEquipped ? '/assets/sniper-icon.svg'
      : hasShotgunEquipped ? '/assets/shotgun-icon.png' : '/assets/fist-icon.png';
  weaponIcon.alt = hasPistolEquipped ? 'Pistola 9mm'
    : hasSniperEquipped ? 'Sniper'
      : hasShotgunEquipped ? 'Escopeta' : 'Punhos';
  weaponName.textContent = weaponIcon.alt;
}

function cycleEquippedWeapon(direction) {
  const availableWeapons = ['fists'];
  if (playerState.hasPistol) availableWeapons.push('pistol');
  if (playerState.hasSniper) availableWeapons.push('sniper');
  if (playerState.hasShotgun) availableWeapons.push('shotgun');
  const currentIndex = availableWeapons.indexOf(playerState.equippedWeapon);
  const nextIndex = (currentIndex + direction + availableWeapons.length) % availableWeapons.length;
  setEquippedWeapon(availableWeapons[nextIndex]);
}

function updateHeldPistolTransform() {
  if (!pistolModel || !pistolHand || !playerState.hasPistol) return;

  player.updateWorldMatrix(true, false);
  pistolHand.updateWorldMatrix(true, false);
  pistolHand.getWorldPosition(heldPistolPosition);
  pistolHand.getWorldQuaternion(heldPistolWorldQuaternion);
  heldPistolOffsetWorld.copy(heldPistolOffset).applyQuaternion(heldPistolWorldQuaternion);
  heldPistolPosition.add(heldPistolOffsetWorld);
  player.worldToLocal(heldPistolPosition);
  player.getWorldQuaternion(playerWorldQuaternion);
  inversePlayerWorldQuaternion.copy(playerWorldQuaternion).invert();
  pistolModel.position.copy(heldPistolPosition);
  pistolModel.quaternion.copy(inversePlayerWorldQuaternion.multiply(heldPistolWorldQuaternion).multiply(heldPistolGripRotation));
}

function updateHeldShotgunTransform() {
  if (!shotgunModel || !shotgunHand || !playerState.hasShotgun) return;

  player.updateWorldMatrix(true, false);
  shotgunHand.updateWorldMatrix(true, false);
  shotgunHand.getWorldPosition(heldShotgunPosition);
  shotgunHand.getWorldQuaternion(heldShotgunWorldQuaternion);
  heldShotgunOffsetWorld.copy(heldShotgunOffset).applyQuaternion(heldShotgunWorldQuaternion);
  heldShotgunPosition.add(heldShotgunOffsetWorld);
  player.worldToLocal(heldShotgunPosition);
  player.getWorldQuaternion(playerWorldQuaternion);
  inversePlayerWorldQuaternion.copy(playerWorldQuaternion).invert();
  shotgunModel.position.copy(heldShotgunPosition);
  shotgunModel.quaternion.copy(inversePlayerWorldQuaternion.multiply(heldShotgunWorldQuaternion).multiply(heldShotgunGripRotation));
}

function updateHeldSniperTransform() {
  if (!sniperHand || !playerState.hasSniper) return;

  player.updateWorldMatrix(true, false);
  sniperHand.updateWorldMatrix(true, false);
  sniperHand.getWorldPosition(heldSniperPosition);
  sniperHand.getWorldQuaternion(heldSniperWorldQuaternion);
  heldSniperOffsetWorld.copy(heldSniperOffset).applyQuaternion(heldSniperWorldQuaternion);
  heldSniperPosition.add(heldSniperOffsetWorld);
  player.worldToLocal(heldSniperPosition);
  player.getWorldQuaternion(playerWorldQuaternion);
  inversePlayerWorldQuaternion.copy(playerWorldQuaternion).invert();
  sniperModel.position.copy(heldSniperPosition);
  sniperModel.quaternion.copy(inversePlayerWorldQuaternion.multiply(heldSniperWorldQuaternion).multiply(heldSniperGripRotation));
}

function loadLocomotionAnimation(model, assetUrl, animationName, onLoaded, loop = THREE.LoopRepeat) {
  const animationLoader = new FBXLoader();
  animationLoader.load(
    assetUrl,
    (fbx) => {
      const sourceClip = fbx.animations.find((clip) => clip.tracks.length > 0);
      if (!sourceClip) {
        console.error(`O arquivo ${animationName} não contém canais de animação.`);
        return;
      }

      const bonesBySourceName = new Map();
      model.traverse((child) => {
        if (child.isBone) {
          const sourceName = child.name.replace(/_\d+$/, '').replace(/^mixamorig:/, 'mixamorig');
          if (!bonesBySourceName.has(sourceName)) bonesBySourceName.set(sourceName, child);
        }
      });

      const walkClip = sourceClip.clone();
      walkClip.tracks = walkClip.tracks.filter((track) => {
        const [, sourceName, property] = track.name.match(/^([^.]+)(\..+)$/) || [];
        if (!sourceName || (sourceName === 'mixamorigHips' && property === '.position')) return false;

        const bone = bonesBySourceName.get(sourceName);
        if (!bone) return false;
        track.name = `${bone.name}${property}`;
        return true;
      });

      if (walkClip.tracks.length === 0) {
        console.error(`Nenhum canal de ${animationName} corresponde ao esqueleto do personagem.`);
        return;
      }

      walkClip.name = animationName;
      walkAnimationMixer ??= new THREE.AnimationMixer(model);
      const action = walkAnimationMixer.clipAction(walkClip);
      action.loop = loop;
      action.clampWhenFinished = loop === THREE.LoopOnce;
      onLoaded(action);
      console.info(`Animação ${animationName} carregada (${walkClip.tracks.length} canais).`);
    },
    undefined,
    (error) => console.error(`Erro ao carregar ${animationName}:`, error)
  );
}

loader.load(
  new URL('./3d/kaaris_low_poly_riged.glb', import.meta.url).href,
  (gltf) => {
    const model = gltf.scene;
    let meshCount = 0;
    model.traverse((child) => {
      if (child.isBone) console.log('bone:', child.name || '(sem nome)');
      if (child.isMesh) {
        meshCount += 1;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    console.log('GLB carregado:', { animations: gltf.animations.length, meshCount, clipNames: gltf.animations.map((clip) => clip.name) });

    if (meshCount === 0) {
      const fallback = createFallbackPlayer();
      player.add(fallback);
      playerModel = fallback;
      window.__playerModel = fallback;
      return;
    }

    const box3 = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box3.getSize(size);
    const center = new THREE.Vector3();
    box3.getCenter(center);

    model.position.x -= center.x;
    model.position.z -= center.z;
    model.rotation.y = Math.PI;
    model.scale.setScalar(0.9 / Math.max(size.length() / 2.2, 0.75));
    model.position.y = 0.08;
    model.updateMatrixWorld(true);
    const groundedBounds = new THREE.Box3().setFromObject(model);
    model.position.y += 0.08 - groundedBounds.min.y;
    player.add(model);
    playerModel = model;
    window.__playerModel = model;

    playerRig = {
      hips: model.getObjectByName('mixamorigHips_01') || model.getObjectByName('Hips') || model,
      spine: model.getObjectByName('mixamorigSpine_02') || model.getObjectByName('Spine'),
      leftShoulder: model.getObjectByName('mixamorigLeftShoulder_08'),
      rightShoulder: model.getObjectByName('mixamorigRightShoulder_032'),
      leftArm: model.getObjectByName('mixamorigLeftArm_09') || model.getObjectByName('LeftArm'),
      rightArm: model.getObjectByName('mixamorigRightArm_033') || model.getObjectByName('RightArm'),
      leftForeArm: model.getObjectByName('mixamorigLeftForeArm_010'),
      rightForeArm: model.getObjectByName('mixamorigRightForeArm_034'),
      leftLeg: model.getObjectByName('mixamorigLeftLeg_00') || model.getObjectByName('LeftLeg'),
      rightLeg: model.getObjectByName('mixamorigRightLeg_061') || model.getObjectByName('RightLeg'),
      leftShoulderRest: model.getObjectByName('mixamorigLeftShoulder_08')?.rotation.clone(),
      rightShoulderRest: model.getObjectByName('mixamorigRightShoulder_032')?.rotation.clone(),
      leftArmRestZ: (model.getObjectByName('mixamorigLeftArm_09') || model.getObjectByName('LeftArm'))?.rotation.z ?? 0,
      rightArmRestZ: (model.getObjectByName('mixamorigRightArm_033') || model.getObjectByName('RightArm'))?.rotation.z ?? 0
    };

    loadLocomotionAnimation(model, new URL('./3d/Walking (2).fbx', import.meta.url).href, 'Walking (2)', (action) => {
      walkAnimationAction = action;
      walkAnimationReady = true;
    });
    loadLocomotionAnimation(model, new URL('./3d/Right Strafe Walking.fbx', import.meta.url).href, 'Right Strafe Walking', (action) => {
      rightStrafeAnimationAction = action;
      walkAnimationReady = true;
    });
    loadLocomotionAnimation(model, new URL('./3d/Left Strafe Walk.fbx', import.meta.url).href, 'Left Strafe Walk', (action) => {
      leftStrafeAnimationAction = action;
      walkAnimationReady = true;
    });
    loadLocomotionAnimation(model, new URL('./3d/Walking Backwards.fbx', import.meta.url).href, 'Walking Backwards', (action) => {
      backwardWalkAnimationAction = action;
      walkAnimationReady = true;
    });
    loadLocomotionAnimation(model, new URL('./3d/Running Jump.fbx', import.meta.url).href, 'Running Jump', (action) => {
      jumpAnimationAction = action;
      walkAnimationReady = true;
    }, THREE.LoopOnce);
    loadLocomotionAnimation(model, new URL('./3d/Running (1).fbx', import.meta.url).href, 'Running (1)', (action) => {
      runAnimationAction = action;
      walkAnimationReady = true;
    });
    loadLocomotionAnimation(model, new URL('./3d/Stop Walking.fbx', import.meta.url).href, 'Stop Walking', (action) => {
      stopWalkingAnimationAction = action;
      walkAnimationReady = true;
      walkAnimationMixer.addEventListener('finished', (event) => {
        if (event.action !== stopWalkingAnimationAction) return;
        if (activeLocomotionAction === stopWalkingAnimationAction) activeLocomotionAction = null;
        event.action.stop();
      });
    }, THREE.LoopOnce);
    loadLocomotionAnimation(model, new URL('./3d/Cross Punch.fbx', import.meta.url).href, 'Cross Punch', (action) => {
      punchAnimationAction = action;
      walkAnimationMixer.addEventListener('finished', (event) => {
        if (event.action === punchAnimationAction) playerState.punching = false;
      });
    }, THREE.LoopOnce);
    loadLocomotionAnimation(model, new URL('./3d/Punch Combo.fbx', import.meta.url).href, 'Punch Combo', (action) => {
      punchComboAnimationAction = action;
      walkAnimationMixer.addEventListener('finished', (event) => {
        if (event.action === punchComboAnimationAction) playerState.punching = false;
      });
    }, THREE.LoopOnce);
    loadLocomotionAnimation(model, new URL('./3d/Entering Car.fbx', import.meta.url).href, 'Entering Car', (action) => {
      enterCarAnimationAction = action;
      walkAnimationMixer.addEventListener('finished', (event) => {
        if (event.action === enterCarAnimationAction && playerState.enteringCar && playerState.carTarget) {
          playerState.enteringCar = false;
          playerState.inCar = playerState.vehicleType === 'car';
          playerState.inHelicopter = playerState.vehicleType === 'helicopter';
        }
      });
    }, THREE.LoopOnce);
  },
  undefined,
  (error) => {
    console.error('Erro ao carregar o personagem principal:', error);
    const fallback = createFallbackPlayer();
    player.add(fallback);
    playerModel = fallback;
    window.__playerModel = fallback;
  }
);

const traffic = [];
window.__traffic = traffic;
const trafficVehicleDefinitions = [
  { name: 'Renault Clio V6', url: '/assets/cars/renault-clio/scene.gltf' },
  { name: 'Chevrolet Camaro SS 2009', url: '/assets/cars/chevrolet-camaro/scene.gltf' },
  { name: 'McLaren 765LT', url: '/assets/cars/mclaren-765lt/scene.gltf' },
  { name: 'Ferrari 288 GTO', url: '/assets/cars/ferrari-288-gto/scene.gltf' },
  { name: 'Tesla Roadster 2020', url: '/assets/cars/tesla-roadster-2020/scene.gltf' },
  { name: 'Mercedes-Benz 300 SL Gullwing', url: '/assets/cars/mercedes-300-sl/scene.gltf' },
  { name: 'Fiat Uno Turbo I.E Mk2', url: '/assets/cars/fiat-uno-turbo/scene.gltf' }
];
const trafficVehicleLoader = new GLTFLoader();
const trafficVehicleModelLoads = new Map();

function loadTrafficVehicleModel(vehicleIndex) {
  if (!trafficVehicleModelLoads.has(vehicleIndex)) {
    const { url } = trafficVehicleDefinitions[vehicleIndex];
    const modelPromise = new Promise((resolve, reject) => {
      trafficVehicleLoader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
    trafficVehicleModelLoads.set(vehicleIndex, modelPromise);
    modelPromise.catch(() => {
      if (trafficVehicleModelLoads.get(vehicleIndex) === modelPromise) {
        trafficVehicleModelLoads.delete(vehicleIndex);
      }
    });
  }
  return trafficVehicleModelLoads.get(vehicleIndex);
}

function placeTrafficVehicleModel(car, sourceModel) {
  const model = sourceModel.clone(true);
  const originalBounds = new THREE.Box3().setFromObject(model);
  const originalSize = new THREE.Vector3();
  originalBounds.getSize(originalSize);
  model.rotation.y = originalSize.x > originalSize.z ? 0 : Math.PI / 2;
  model.updateMatrixWorld(true);

  const rotatedBounds = new THREE.Box3().setFromObject(model);
  const rotatedSize = new THREE.Vector3();
  rotatedBounds.getSize(rotatedSize);
  const horizontalLength = Math.max(rotatedSize.x, rotatedSize.z);
  if (horizontalLength <= 0) {
    console.error('O modelo de veículo não possui dimensões válidas.');
    return;
  }

  model.scale.setScalar(4.4 / horizontalLength);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  bounds.getCenter(center);
  model.position.x -= center.x;
  model.position.y += 0.16 - bounds.min.y;
  model.position.z -= center.z;
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  if (car.userData.vehicleVisual) {
    car.remove(car.userData.vehicleVisual);
  } else {
    for (const child of [...car.children]) {
      car.remove(child);
      child.traverse((node) => {
        if (!node.isMesh) return;
        node.geometry.dispose();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => material.dispose());
      });
    }
  }
  car.add(model);
  car.userData.vehicleVisual = model;
}

function assignRandomTrafficVehicle(car, vehicleIndex = Math.floor(Math.random() * trafficVehicleDefinitions.length)) {
  const requestId = (car.userData.vehicleRequestId || 0) + 1;
  car.userData.vehicleRequestId = requestId;
  car.userData.vehicleIndex = vehicleIndex;
  const definition = trafficVehicleDefinitions[vehicleIndex];
  loadTrafficVehicleModel(vehicleIndex).then((model) => {
    if (car.userData.vehicleRequestId === requestId) placeTrafficVehicleModel(car, model);
  }).catch((error) => {
    if (car.userData.vehicleRequestId === requestId) {
      console.error(`Erro ao carregar o veículo ${definition.name}:`, error);
    }
  });
}

const initialVehicleOrder = trafficVehicleDefinitions.map((_, index) => index);
for (let index = initialVehicleOrder.length - 1; index > 0; index--) {
  const randomIndex = Math.floor(Math.random() * (index + 1));
  [initialVehicleOrder[index], initialVehicleOrder[randomIndex]] = [initialVehicleOrder[randomIndex], initialVehicleOrder[index]];
}
[
  { x: -250, z: -150, color: palette.cream, speed: 12 },
  { x: 25, z: 30, color: 0x3f7f71, speed: -18 },
  { x: 250, z: 210, color: 0xd3a64e, speed: 24 },
  { x: 25, z: -210, color: 0xd64f3e, speed: -15 },
  { x: 230, z: -90, color: 0x3f7f71, speed: 20 },
  { x: -80, z: -30, color: 0xd3a64e, speed: -12 },
  { x: 250, z: 190, color: palette.cream, speed: 22 },
  { x: -240, z: 150, color: 0xd64f3e, speed: -16 },
  { x: -80, z: 90, color: 0x3f7f71, speed: -21 },
  { x: 150, z: -210, color: 0xd3a64e, speed: 14 }
].forEach(({ x, z, color, speed }, index) => {
  if (isOnTijucaMountain(x, z, 4)) return;
  const car = makeCar(color, .85);
  car.position.set(x, 0, z);
  car.userData.speed = speed;
  car.userData.city = z >= GUANABARA_BAY.maxZ ? 'Netróit' : 'Rio Vice';
  car.userData.roadZ = z;
  car.userData.useImportedVehicle = true;
  car.rotation.y = speed < 0 ? Math.PI : 0;
  traffic.push(car);
  scene.add(car);
  assignRandomTrafficVehicle(car, initialVehicleOrder[index % initialVehicleOrder.length]);
});

const cityTrafficLanes = [
  { city: 'Rio Vice', roads: [-420, -300, -180, -60, 60, 180, 300, 420], carsPerRoad: 8 },
  { city: 'Netróit', roads: [960, 1020, 1080, 1140], carsPerRoad: 8 }
];
let generatedTrafficIndex = 0;
for (const { city, roads, carsPerRoad } of cityTrafficLanes) {
  for (const z of roads) {
    for (let laneIndex = 0; laneIndex < carsPerRoad; laneIndex++) {
      const direction = (laneIndex + Math.floor((z - WORLD_BOUNDS.minZ) / 60)) % 2 === 0 ? 1 : -1;
      const spacing = WORLD_WIDTH / carsPerRoad;
      const x = WORLD_BOUNDS.minX + spacing * (laneIndex + 0.5);
      if (isOnTijucaMountain(x, z, 4)) {
        generatedTrafficIndex += 1;
        continue;
      }
      const speed = direction * (12 + (generatedTrafficIndex * 7 % 13));
      const car = makeCar(palette.cream, 0.85);
      car.position.set(x, getSurfaceHeight(x, z), z);
      car.userData.speed = speed;
      car.userData.city = city;
      car.userData.roadZ = z;
      car.userData.useImportedVehicle = true;
      car.rotation.y = speed < 0 ? Math.PI : 0;
      traffic.push(car);
      scene.add(car);
      assignRandomTrafficVehicle(car, generatedTrafficIndex % trafficVehicleDefinitions.length);
      generatedTrafficIndex += 1;
    }
  }
}

const helicopter = new THREE.Group();
helicopter.name = 'SA342M Gazelle';
const helicopterSpawn = Object.freeze({ x: NITEROI_BRIDGE.x - 7.5, z: NITEROI_BRIDGE.startZ - 8 });
helicopter.position.set(helicopterSpawn.x, getSurfaceHeight(helicopterSpawn.x, helicopterSpawn.z), helicopterSpawn.z);
helicopter.userData.flightHeight = 0;
helicopter.userData.speed = 0;
scene.add(helicopter);
window.__helicopter = helicopter;
const helicopterLoader = new GLTFLoader();
helicopterLoader.load(
  '/assets/helicopters/sa342m-gazelle/scene.gltf',
  (gltf) => {
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    const largestDimension = Math.max(size.x, size.y, size.z);
    if (largestDimension <= 0) {
      console.error('O modelo do helicóptero não possui dimensões válidas.');
      return;
    }

    const modelScale = 10 / largestDimension;
    model.scale.setScalar(modelScale);
    model.position.set(-center.x * modelScale, -bounds.min.y * modelScale, -center.z * modelScale);
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    helicopter.add(model);
    helicopter.userData.modelReady = true;
    helicopter.userData.model = model;
    helicopter.userData.mainRotor = model.getObjectByName('Object_78');
  },
  undefined,
  (error) => console.error('Erro ao carregar o helicóptero SA342M Gazelle:', error)
);

const keys = {};
const ammuRioPanel = document.getElementById('ammu-rio-panel');
const ammuRioExitButton = document.getElementById('ammu-rio-exit');
const ammuRioStatus = document.getElementById('ammu-rio-status');
const ammuRioWeaponButtons = [...document.querySelectorAll('.ammu-rio-weapon')];
const interactionPrompt = document.getElementById('interaction-prompt');
let inAmmuRio = false;
const keyName = (event) => event.key.toLowerCase();

function updateAmmuRioWeaponButtons() {
  for (const button of ammuRioWeaponButtons) {
    const weapon = button.dataset.weapon;
    const equipped = playerState.equippedWeapon === weapon;
    button.classList.toggle('equipped', equipped);
    button.querySelector('strong').textContent = equipped ? 'Equipado' : 'Equipar';
  }
}

function equipWeaponFromShop(weapon) {
  if (weapon === 'pistol' && !playerState.hasPistol) {
    if (!pistolModel || !pistolPickup) {
      ammuRioStatus.textContent = 'A pistola ainda está carregando. Tente novamente em instantes.';
      return;
    }
    if (!attachWeaponToPlayer(pistolModel, pistolPickup, 0.4, 'a pistola 9mm')) return;
    pistolHand = playerModel.getObjectByName('mixamorigRightHand_035')
      || playerModel.getObjectByName('mixamorigRightHand');
    pistolPickup = null;
    playerState.hasPistol = true;
  } else if (weapon === 'sniper' && !playerState.hasSniper) {
    if (!playerModel) {
      ammuRioStatus.textContent = 'O personagem ainda está carregando. Tente novamente em instantes.';
      return;
    }
    sniperHand = playerModel.getObjectByName('mixamorigRightHand_035')
      || playerModel.getObjectByName('mixamorigRightHand')
      || null;
    if (!sniperHand) {
      console.error('Não foi possível encontrar a mão direita do personagem para equipar a sniper.');
      ammuRioStatus.textContent = 'Não foi possível equipar a sniper.';
      return;
    }
    playerState.hasSniper = true;
  } else if (weapon === 'shotgun' && !playerState.hasShotgun) {
    if (!shotgunModel || !shotgunPickup) {
      ammuRioStatus.textContent = 'A escopeta ainda está carregando. Tente novamente em instantes.';
      return;
    }
    if (!attachWeaponToPlayer(shotgunModel, shotgunPickup, 0.58, 'a escopeta')) return;
    shotgunHand = playerModel.getObjectByName('mixamorigRightHand_035')
      || playerModel.getObjectByName('mixamorigRightHand')
      || null;
    shotgunPickup = null;
    playerState.hasShotgun = true;
  }

  setEquippedWeapon(weapon);
  ammuRioStatus.textContent = `${weaponName.textContent} adicionada ao inventário e equipada.`;
  updateAmmuRioWeaponButtons();
}

for (const button of ammuRioWeaponButtons) {
  button.addEventListener('click', () => equipWeaponFromShop(button.dataset.weapon));
}

function leaveAmmuRio() {
  inAmmuRio = false;
  ammuRioPanel.hidden = true;
  keys.e = false;
  updateSky(displayedGameMinute >= 0 ? displayedGameMinute : 17 * 60);
}

function enterAmmuRio() {
  inAmmuRio = true;
  for (const key of Object.keys(keys)) keys[key] = false;
  ammuRioStatus.textContent = '';
  updateAmmuRioWeaponButtons();
  ammuRioPanel.hidden = false;
  document.querySelector('#district').textContent = 'Ammu-Rio';
}

ammuRioExitButton.addEventListener('click', leaveAmmuRio);

addEventListener('keydown', (event) => {
  if (!gameStarted) return;
  const name = keyName(event);
  if (gamePaused) {
    if (name === 'escape') resumeGame();
    return;
  }
  if (name === 'escape') {
    openGameMenu();
    return;
  }
  if (inAmmuRio) {
    if (name === 'e' || name === 'escape') {
      event.preventDefault();
      leaveAmmuRio();
    }
    return;
  }
  if (name === 'e' && !event.repeat && !playerState.inCar && !playerState.inHelicopter
    && !playerState.enteringCar
    && Math.hypot(player.position.x - AMMU_RIO_LOCATION.x, player.position.z - AMMU_RIO_LOCATION.z) < 5) {
    event.preventDefault();
    enterAmmuRio();
    return;
  }
  if (event.code === 'Enter' && !event.repeat && (playerState.inCar || playerState.inHelicopter)) {
    if (playerState.inCar) {
      playerState.inCar = false;
      if (playerState.carTarget) {
        const car = playerState.carTarget;
        car.userData.speed = 0;
        car.userData.driveSpeed = 0;
        car.userData.parked = true;
      }
    } else {
      const aircraft = playerState.carTarget;
      playerState.inHelicopter = false;
      if (aircraft) {
        player.position.set(aircraft.position.x - 4, getSurfaceHeight(aircraft.position.x - 4, aircraft.position.z), aircraft.position.z);
      }
    }
    playerState.enteringCar = false;
    playerState.carTarget = null;
    playerState.vehicleType = null;
    playerState.enterProgress = 0;
    event.preventDefault();
    return;
  }
  keys[name] = true;
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(name)) {
    playerState.stopForwardAnimationPending = false;
  }
  if (event.code === 'Space' && !event.repeat && !playerState.inCar && !playerState.inHelicopter && !playerState.jumping && playerState.grounded) {
    playerState.jumping = true;
    playerState.grounded = false;
    playerState.jumpVelocity = 7.2;
  }
  if (event.code === 'Enter' && !event.repeat && !playerState.inCar && !playerState.inHelicopter && !playerState.enteringCar && !mapVisible) {
    const helicopterDistance = Math.hypot(
      player.position.x - helicopter.position.x,
      player.position.z - helicopter.position.z
    );
    if (helicopter.userData.modelReady && helicopterDistance < 9
      && Math.abs(player.position.y - helicopter.position.y) < 3.5) {
      if (!enterCarAnimationAction) {
        console.warn('A animação de entrada no veículo ainda não está pronta.');
        return;
      }
      playerState.enteringCar = true;
      playerState.vehicleType = 'helicopter';
      playerState.carTarget = helicopter;
      playerState.enterProgress = 0;
      return;
    }
    const nearestCar = traffic.find((car) => car.position.distanceTo(player.position) < 3.5);
    if (nearestCar) {
      if (!enterCarAnimationAction) {
        console.warn('A animação de entrada no carro ainda não está pronta.');
        return;
      }
      nearestCar.userData.trafficSpeedBeforeDriving = nearestCar.userData.speed;
      nearestCar.userData.driveSpeed = 0;
      nearestCar.rotation.y = nearestCar.userData.speed >= 0 ? Math.PI / 2 : -Math.PI / 2;
      orbitCamera.yaw = nearestCar.rotation.y;
      playerState.enteringCar = true;
      playerState.vehicleType = 'car';
      playerState.carTarget = nearestCar;
      playerState.enterProgress = 0;
    }
  }
  if (name === 'f' && !event.repeat) {
    if (!playerState.inCar && !playerState.inHelicopter && !playerState.enteringCar) {
      cycleEquippedWeapon(-1);
    }
  }
  if (name === 'g' && !event.repeat && !playerState.inCar && !playerState.inHelicopter && !playerState.enteringCar) {
    cycleEquippedWeapon(1);
  }
  if (event.key.toLowerCase() === 'r') resetPlayer();
});
addEventListener('keyup', (event) => {
  const name = keyName(event);
  const wasMovingForward = name === 'w' && keys.w && !playerState.inCar && !playerState.inHelicopter && !playerState.enteringCar
    && !playerState.jumping && playerState.grounded;
  keys[name] = false;
  const anotherDirectionHeld = keys.a || keys.s || keys.d || keys.arrowup || keys.arrowdown || keys.arrowleft || keys.arrowright;
  if (wasMovingForward && !anotherDirectionHeld) playerState.stopForwardAnimationPending = true;
});
const start = player.position.clone();
function resetPlayer() {
  player.position.copy(start);
  player.position.y = getSurfaceHeight(player.position.x, player.position.z);
  playerState.inCar = false;
  playerState.inHelicopter = false;
  playerState.enteringCar = false;
  playerState.carTarget = null;
  playerState.vehicleType = null;
  playerState.jumping = false;
  playerState.grounded = true;
  playerState.jumpHeight = 0;
  playerState.jumpVelocity = 0;
  document.querySelector('#toast').classList.remove('visible');
}

const miniMap = document.getElementById('mini-map');
const miniPlayer = document.getElementById('mini-player');
const miniMapRoads = document.getElementById('mini-map-roads');

function drawMiniMapRoads() {
  if (!miniMapRoads) return;
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const toMapPoint = (x, z) => ({ x, y: z });
  const addRoad = (x1, z1, x2, z2, className) => {
    const addSegment = (startX, startZ, endX, endZ) => {
      if (Math.hypot(endX - startX, endZ - startZ) < 0.1) return;
      const start = toMapPoint(startX, startZ);
      const end = toMapPoint(endX, endZ);
      const road = document.createElementNS(svgNamespace, 'line');
      road.setAttribute('x1', start.x.toFixed(2));
      road.setAttribute('y1', start.y.toFixed(2));
      road.setAttribute('x2', end.x.toFixed(2));
      road.setAttribute('y2', end.y.toFixed(2));
      road.setAttribute('class', `mini-map-road ${className}`);
      miniMapRoads.appendChild(road);
    };
    const mountain = TIJUCA_MOUNTAIN;
    if (Math.abs(z2 - z1) < 0.001 && Math.abs(z1 - mountain.z) < mountain.radius
      && Math.abs(x2 - x1) > 0.001) {
      const cut = Math.sqrt(mountain.radius ** 2 - (z1 - mountain.z) ** 2) + 4;
      const left = mountain.x - cut;
      const right = mountain.x + cut;
      if (x1 <= x2) {
        addSegment(x1, z1, Math.min(x2, left), z1);
        addSegment(Math.max(x1, right), z1, x2, z1);
      } else {
        addSegment(x1, z1, Math.max(x2, right), z1);
        addSegment(Math.min(x1, left), z1, x2, z1);
      }
      return;
    }
    if (Math.abs(x2 - x1) < 0.001 && Math.abs(x1 - mountain.x) < mountain.radius
      && Math.abs(z2 - z1) > 0.001) {
      const cut = Math.sqrt(mountain.radius ** 2 - (x1 - mountain.x) ** 2) + 5;
      const top = mountain.z - cut;
      const bottom = mountain.z + cut;
      if (z1 <= z2) {
        addSegment(x1, z1, x1, Math.min(z2, top));
        addSegment(x1, Math.max(z1, bottom), x1, z2);
      } else {
        addSegment(x1, z1, x1, Math.max(z2, bottom));
        addSegment(x1, Math.min(z1, top), x1, z2);
      }
      return;
    }
    addSegment(x1, z1, x2, z2);
  };
  const addWater = (minX, minZ, maxX, maxZ) => {
    const topLeft = toMapPoint(minX, minZ);
    const bottomRight = toMapPoint(maxX, maxZ);
    const water = document.createElementNS(svgNamespace, 'rect');
    water.setAttribute('x', topLeft.x.toFixed(2));
    water.setAttribute('y', topLeft.y.toFixed(2));
    water.setAttribute('width', (bottomRight.x - topLeft.x).toFixed(2));
    water.setAttribute('height', (bottomRight.y - topLeft.y).toFixed(2));
    water.setAttribute('class', 'mini-map-water');
    miniMapRoads.appendChild(water);
  };
  const addFeatureCircle = (x, z, radius, className) => {
    const center = toMapPoint(x, z);
    const circle = document.createElementNS(svgNamespace, 'ellipse');
    circle.setAttribute('cx', center.x.toFixed(2));
    circle.setAttribute('cy', center.y.toFixed(2));
    circle.setAttribute('rx', radius.toFixed(2));
    circle.setAttribute('ry', radius.toFixed(2));
    circle.setAttribute('class', className);
    miniMapRoads.appendChild(circle);
  };

  addWater(GUANABARA_BAY.minX, GUANABARA_BAY.minZ, GUANABARA_BAY.maxX, GUANABARA_BAY.maxZ);
  addWater(TIJUCA_BEACH.minX, TIJUCA_BEACH.minZ, TIJUCA_BEACH.maxX, TIJUCA_BEACH.maxZ);
  addFeatureCircle(TIJUCA_MOUNTAIN.x, TIJUCA_MOUNTAIN.z, TIJUCA_MOUNTAIN.radius, 'mini-map-tijuca-mountain');

  for (let z = WORLD_BOUNDS.minZ + 20; z < WORLD_BOUNDS.maxZ; z += 60) {
    if (Math.abs(z + 6) < 28 || (z >= GUANABARA_BAY.minZ && z <= GUANABARA_BAY.maxZ)) continue;
    if (z >= TIJUCA_BEACH.minZ && z <= TIJUCA_BEACH.maxZ) {
      addRoad(WORLD_BOUNDS.minX, z, TIJUCA_BEACH.minX, z, 'mini-map-road-minor');
      addRoad(TIJUCA_BEACH.maxX, z, WORLD_BOUNDS.maxX, z, 'mini-map-road-minor');
    } else {
      addRoad(WORLD_BOUNDS.minX, z, WORLD_BOUNDS.maxX, z, 'mini-map-road-minor');
    }
  }

  for (let x = WORLD_BOUNDS.minX + 20; x < WORLD_BOUNDS.maxX; x += 60) {
    const addVerticalRoad = (minZ, maxZ) => {
      if (maxZ <= minZ) return;
      if (x >= TIJUCA_BEACH.minX && x <= TIJUCA_BEACH.maxX
        && minZ < TIJUCA_BEACH.maxZ && maxZ > TIJUCA_BEACH.minZ) {
        addVerticalRoad(minZ, TIJUCA_BEACH.minZ);
        addVerticalRoad(TIJUCA_BEACH.maxZ, maxZ);
        return;
      }
      addRoad(x, minZ, x, maxZ, 'mini-map-road-minor');
    };
    addVerticalRoad(WORLD_BOUNDS.minZ, GUANABARA_BAY.minZ);
    addVerticalRoad(GUANABARA_BAY.maxZ, WORLD_BOUNDS.maxZ);
  }

  addRoad(WORLD_BOUNDS.minX, -6, WORLD_BOUNDS.maxX, -6, 'mini-map-road-main');
  addRoad(-43, NITEROI_BRIDGE.startZ, -43, NITEROI_BRIDGE.endZ, 'mini-map-road-bridge');
  for (let z = NITEROI_BRIDGE.startZ + 12; z < NITEROI_BRIDGE.endZ; z += 22) {
    const center = toMapPoint(NITEROI_BRIDGE.x, z);
    const marking = document.createElementNS(svgNamespace, 'circle');
    marking.setAttribute('cx', center.x.toFixed(2));
    marking.setAttribute('cy', center.y.toFixed(2));
    marking.setAttribute('r', '0.32');
    marking.setAttribute('class', 'mini-map-road-centerline');
    miniMapRoads.appendChild(marking);
  }

  for (const layout of LOCAL_STREET_LAYOUTS) {
    if (layout.type === 'roundabout') {
      addFeatureCircle(layout.x, layout.z, layout.radius, 'mini-map-roundabout-road');
      addFeatureCircle(layout.x, layout.z, layout.radius - 3.6, 'mini-map-roundabout-island');
      addRoad(layout.x, layout.z - 30, layout.x, layout.z - layout.radius - 3.5, 'mini-map-road-minor');
    } else {
      const bulbZ = layout.z + 14;
      addRoad(layout.x, layout.z - 30, layout.x, bulbZ, 'mini-map-road-minor');
      addFeatureCircle(layout.x, bulbZ, layout.radius, 'mini-map-culdesac');
      addFeatureCircle(layout.x, bulbZ, 2.2, 'mini-map-roundabout-island');
    }
  }
}

drawMiniMapRoads();

function updateMiniMap() {
  if (!miniMap || !miniPlayer || !miniMapRoads) return;
  const subject = (playerState.inCar || playerState.inHelicopter) && playerState.carTarget
    ? playerState.carTarget.position
    : player.position;
  const viewSize = 180;
  miniMapRoads.setAttribute(
    'viewBox',
    `${(subject.x - viewSize / 2).toFixed(2)} ${(subject.z - viewSize / 2).toFixed(2)} ${viewSize} ${viewSize}`
  );
}

function updateWalkAnimation(inputX, inputZ, crouched, delta) {
  if (!walkAnimationReady || !walkAnimationMixer) return false;

  const queuedPunchAction = queuedPunchType === 'combo' ? punchComboAnimationAction : punchAnimationAction;
  if (playerState.punchQueued && queuedPunchAction && playerState.grounded && !playerState.inCar && !playerState.inHelicopter && !playerState.enteringCar) {
    playerState.punchQueued = false;
    queuedPunchType = null;
    playerState.currentPunchAction = queuedPunchAction;
    playerState.punching = true;
  }

  const moving = inputX !== 0 || inputZ !== 0;
  const canWalk = moving && !crouched && !playerState.jumping && !playerState.inCar && !playerState.inHelicopter;
  const stopAfterForward = playerState.stopForwardAnimationPending && !moving && !crouched && !playerState.inCar && !playerState.inHelicopter;
  const requestedAction = playerState.enteringCar
    ? enterCarAnimationAction
    : playerState.jumping
    ? jumpAnimationAction
    : playerState.punching
      ? playerState.currentPunchAction
      : canWalk
        ? keys.shift ? runAnimationAction || walkAnimationAction
          : inputZ < 0 ? backwardWalkAnimationAction || walkAnimationAction
            : inputX < 0 ? leftStrafeAnimationAction || walkAnimationAction
              : inputX > 0 ? rightStrafeAnimationAction || walkAnimationAction : walkAnimationAction
        : stopAfterForward ? stopWalkingAnimationAction : null;

  if (requestedAction === stopWalkingAnimationAction) playerState.stopForwardAnimationPending = false;
  else if (moving) playerState.stopForwardAnimationPending = false;

  if (requestedAction !== activeLocomotionAction) {
    if (activeLocomotionAction) {
      activeLocomotionAction.fadeOut(0.16);
      fadingLocomotionActions.set(activeLocomotionAction, 0.16);
    }

    activeLocomotionAction = requestedAction;
    if (activeLocomotionAction) {
      fadingLocomotionActions.delete(activeLocomotionAction);
      activeLocomotionAction
        .reset()
        .setEffectiveTimeScale(activeLocomotionAction === runAnimationAction ? 1 : keys.shift ? 1.5 : 1)
        .setEffectiveWeight(1)
        .fadeIn(0.16)
        .play();
    }
  }

  if (activeLocomotionAction) {
    activeLocomotionAction.setEffectiveTimeScale(activeLocomotionAction === runAnimationAction ? 1 : keys.shift ? 1.5 : 1);
  }
  walkAnimationMixer.update(delta);

  for (const [action, timeRemaining] of fadingLocomotionActions) {
    const nextTime = Math.max(0, timeRemaining - delta);
    if (nextTime === 0) {
      action.stop();
      fadingLocomotionActions.delete(action);
    } else {
      fadingLocomotionActions.set(action, nextTime);
    }
  }

  return activeLocomotionAction !== null || fadingLocomotionActions.size > 0;
}

function updatePlayerMovementState(inputX, inputZ, delta, importedAnimationControlsRig) {
  const moving = inputX !== 0 || inputZ !== 0;
  const crouched = !!(keys.c || keys.control || keys.controlleft || keys.controlright) && !playerState.inCar && !playerState.inHelicopter;
  playerState.crouching = crouched && !playerState.jumping;

  if (!playerState.inCar && !playerState.inHelicopter) {
    if (playerState.jumping) {
      playerState.jumpVelocity -= 18 * delta;
      playerState.jumpHeight = Math.max(0, playerState.jumpHeight + playerState.jumpVelocity * delta);
      if (playerState.jumpHeight <= 0) {
        playerState.jumpHeight = 0;
        playerState.jumping = false;
        playerState.grounded = true;
        playerState.jumpVelocity = 0;
      } else {
        playerState.grounded = false;
      }
    } else {
      playerState.jumpHeight = 0;
      playerState.jumpVelocity = 0;
      playerState.grounded = true;
    }

    player.position.y = getSurfaceHeight(player.position.x, player.position.z) + playerState.jumpHeight;
  }

  if (playerState.inCar && playerState.carTarget) {
    const target = playerState.carTarget.position.clone();
    target.y = 0.9;
    player.position.lerp(target, 0.12);
    player.rotation.y = playerState.carTarget.rotation.y;
  }
  if (playerState.inHelicopter && playerState.carTarget) {
    player.position.set(
      playerState.carTarget.position.x,
      playerState.carTarget.position.y + 2,
      playerState.carTarget.position.z
    );
    player.rotation.y = playerState.carTarget.rotation.y;
  }

  if (playerModel) {
    playerModel.rotation.x = 0;
    playerModel.rotation.z = 0;
  }

  if (playerRig && !importedAnimationControlsRig) {
    const step = performance.now() * (keys.shift && moving && !playerState.crouching ? 0.034 : 0.019);
    const swing = moving && !playerState.inCar && !playerState.inHelicopter ? Math.sin(step) : 0;
    const jumpBias = playerState.jumping ? 0.5 : 0;
    const resting = !moving && !playerState.crouching && !playerState.jumping
      && !playerState.inCar && !playerState.inHelicopter && !playerState.enteringCar && !playerState.punching;
    if (playerRig.leftShoulder && playerRig.leftShoulderRest) {
      playerRig.leftShoulder.rotation.set(
        resting ? 2.75 : playerRig.leftShoulderRest.x,
        playerRig.leftShoulderRest.y,
        resting ? -0.72 : playerRig.leftShoulderRest.z
      );
    }
    if (playerRig.rightShoulder && playerRig.rightShoulderRest) {
      playerRig.rightShoulder.rotation.set(
        resting ? 2.75 : playerRig.rightShoulderRest.x,
        playerRig.rightShoulderRest.y,
        resting ? 0.72 : playerRig.rightShoulderRest.z
      );
    }
    if (playerRig.leftForeArm) playerRig.leftForeArm.rotation.x = resting ? 0.18 : 0;
    if (playerRig.rightForeArm) playerRig.rightForeArm.rotation.x = resting ? 0.18 : 0;
    if (playerRig.leftLeg) playerRig.leftLeg.rotation.x = playerState.inCar ? -0.15 : (playerState.crouching ? 0.8 : moving ? swing * 1.6 : 0.12 + jumpBias);
    if (playerRig.rightLeg) playerRig.rightLeg.rotation.x = playerState.inCar ? 0.15 : (playerState.crouching ? -0.8 : moving ? -swing * 1.6 : -0.12 - jumpBias);
    if (playerRig.leftArm) {
      playerRig.leftArm.rotation.x = playerState.inCar ? 0.35 : (playerState.crouching ? 0.9 : moving ? -swing * 1.2 : 0.16 + jumpBias);
      playerRig.leftArm.rotation.z = playerRig.leftArmRestZ;
    }
    if (playerRig.rightArm) {
      playerRig.rightArm.rotation.x = playerState.inCar ? -0.35 : (playerState.crouching ? -0.9 : moving ? swing * 1.2 : -0.16 - jumpBias);
      playerRig.rightArm.rotation.z = playerRig.rightArmRestZ;
    }
    if (playerRig.spine) playerRig.spine.rotation.x = playerState.jumping ? 0.4 : (playerState.crouching ? 0.4 : moving ? Math.sin(step * 0.7) * 0.22 : 0.03);
    if (playerRig.hips) playerRig.hips.rotation.z = playerState.inCar ? 0 : (moving ? Math.sin(step) * 0.1 : 0);
  }

}

const mapPanel = document.getElementById('world-map');
const closeMapButton = document.getElementById('map-close');
let mapVisible = false;

window.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('pointerdown', (event) => {
  if (!gameStarted) return;
  if (event.button === 0 && event.target === renderer.domElement && !mapVisible && !playerState.inCar && !playerState.inHelicopter && !playerState.enteringCar && playerState.grounded && !playerState.punching && !playerState.punchQueued) {
    if (pendingPunchTimer !== null) {
      window.clearTimeout(pendingPunchTimer);
      pendingPunchTimer = null;
      queuedPunchType = 'combo';
      playerState.punchQueued = true;
    } else {
      pendingPunchTimer = window.setTimeout(() => {
        pendingPunchTimer = null;
        if (!mapVisible && !playerState.inCar && !playerState.inHelicopter && !playerState.enteringCar && playerState.grounded && !playerState.punching) {
          queuedPunchType = 'single';
          playerState.punchQueued = true;
        }
      }, punchComboClickWindow);
    }
  }
  if (event.button === 2 && event.target === renderer.domElement) {
    orbitCamera.dragging = true;
    renderer.domElement.setPointerCapture(event.pointerId);
  }
});
window.addEventListener('pointerup', () => { orbitCamera.dragging = false; });
window.addEventListener('pointermove', (event) => {
  if (!orbitCamera.dragging) return;
  orbitCamera.yaw -= event.movementX * 0.005;
  const minPitch = orbitCamera.mode === 'firstPerson' ? -0.55 : -0.15;
  const maxPitch = orbitCamera.mode === 'firstPerson' ? 0.55 : 0.85;
  orbitCamera.pitch = THREE.MathUtils.clamp(orbitCamera.pitch - event.movementY * 0.003, minPitch, maxPitch);
});
window.addEventListener('wheel', (event) => {
  if (orbitCamera.mode === 'follow') {
    orbitCamera.distance = THREE.MathUtils.clamp(orbitCamera.distance + event.deltaY * 0.01, 6, 22);
  }
}, { passive: true });

function revealMap() {
  mapVisible = true;
  mapPanel.classList.remove('hidden');
  document.body.classList.add('map-open');
}

function hideMap() {
  mapVisible = false;
  mapPanel.classList.add('hidden');
  document.body.classList.remove('map-open');
}

closeMapButton.addEventListener('click', () => hideMap());
window.addEventListener('keydown', (event) => {
  if (!gameStarted || gamePaused || inAmmuRio) return;
  const key = event.key.toLowerCase();
  if (key === 'm') {
    if (mapVisible) hideMap();
    else revealMap();
  }
  if (key === 'v' && !event.repeat) {
    orbitCamera.mode = orbitCamera.mode === 'follow' ? 'firstPerson' : 'follow';
  }
});
const cameraTarget = new THREE.Vector3();
const cameraPositionTarget = new THREE.Vector3();
const cameraLookTarget = new THREE.Vector3();
const clock = new THREE.Clock();
let gameTimeStartedAt = performance.now();
let displayedGameMinute = -1;
const gameTimeDisplay = document.getElementById('game-time');

function updateGameTime() {
  const elapsedGameMinutes = Math.floor((performance.now() - gameTimeStartedAt) / 1000);
  const minutesOfDay = (8 * 60 + elapsedGameMinutes) % (24 * 60)
  if (minutesOfDay === displayedGameMinute) return;
  displayedGameMinute = minutesOfDay;
  updateSky(minutesOfDay);
  const hours = String(Math.floor(minutesOfDay / 60)).padStart(2, '0');
  const minutes = String(minutesOfDay % 60).padStart(2, '0');
  const time = `${hours}:${minutes}`;
  gameTimeDisplay.textContent = time;
  gameTimeDisplay.dateTime = time;
}

function drivePlayerCar(delta) {
  const car = playerState.carTarget;
  if (!playerState.inCar || !car) return;

  const driveInput = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
  const steeringInput = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  if (driveInput === 0) {
    car.userData.driveSpeed = 0;
    return;
  }

  car.rotation.y += steeringInput * Math.sign(driveInput) * 1.65 * delta;
  car.userData.driveSpeed = driveInput * 13;
  const nextX = THREE.MathUtils.clamp(
    car.position.x + Math.sin(car.rotation.y) * car.userData.driveSpeed * delta,
    WORLD_BOUNDS.minX + 5,
    WORLD_BOUNDS.maxX - 5
  );
  const nextZ = THREE.MathUtils.clamp(
    car.position.z + Math.cos(car.rotation.y) * car.userData.driveSpeed * delta,
    WORLD_BOUNDS.minZ + 5,
    WORLD_BOUNDS.maxZ - 5
  );
  const resolved = resolveWorldMovement(
    car.position.x,
    car.position.z,
    nextX,
    nextZ,
    1.5,
    car.position.y,
    1.5
  );
  const blocked = resolved.x !== nextX || resolved.z !== nextZ;
  car.position.set(resolved.x, getSurfaceHeight(resolved.x, resolved.z), resolved.z);
  if (blocked) car.userData.driveSpeed = 0;
}

function drivePlayerHelicopter(delta, inputX, inputZ, viewForward, viewRight) {
  const aircraft = playerState.carTarget;
  if (!playerState.inHelicopter || !aircraft) return;

  const direction = new THREE.Vector3()
    .addScaledVector(viewForward, inputZ)
    .addScaledVector(viewRight, inputX);
  if (direction.lengthSq() > 0) {
    direction.normalize();
    aircraft.position.addScaledVector(direction, 13 * delta);
    aircraft.rotation.y = Math.atan2(direction.x, direction.z);
  }

  const groundHeight = getSurfaceHeight(aircraft.position.x, aircraft.position.z);
  const verticalInput = (keys.arrowup ? 1 : 0) - (keys.arrowdown ? 1 : 0);
  aircraft.position.y = THREE.MathUtils.clamp(
    aircraft.position.y + verticalInput * 8 * delta,
    groundHeight,
    groundHeight + 65
  );
  aircraft.position.x = THREE.MathUtils.clamp(aircraft.position.x, WORLD_BOUNDS.minX + 12, WORLD_BOUNDS.maxX - 12);
  aircraft.position.z = THREE.MathUtils.clamp(aircraft.position.z, WORLD_BOUNDS.minZ + 12, WORLD_BOUNDS.maxZ - 12);
}

function animate() {
  requestAnimationFrame(animate);
  if (!gameStarted || gamePaused || inAmmuRio) {
    renderer.render(scene, camera);
    return;
  }
  const delta = Math.min(clock.getDelta(), .04);
  if (performance.now() - lastAutosaveAt >= 1500) {
    saveGame();
    lastAutosaveAt = performance.now();
  }
  updateGameTime();
  skyAnchor.position.set(player.position.x, 0, player.position.z);
  moon.position.set(player.position.x - 35, 55, player.position.z + 25);
  const markerPulse = 1 + Math.sin(performance.now() * 0.003) * 0.08;
  ammuRio.userData.marker.scale.setScalar(markerPulse);
  if (pistolPickup) {
    pistolPickupElapsed += delta;
    pistolPickup.rotation.y += delta * 1.2;
    pistolPickup.position.y = pistolPickup.userData.baseY + Math.sin(pistolPickupElapsed * 2.2) * 0.18;
  }
  if (shotgunPickup) {
    shotgunPickupElapsed += delta;
    shotgunPickup.rotation.y += delta * 0.8;
    shotgunPickup.position.y = shotgunPickup.userData.baseY + Math.sin(shotgunPickupElapsed * 2.2) * 0.18;
  }
  if (playerState.inHelicopter && helicopter.userData.mainRotor) {
    helicopter.userData.mainRotor.rotation.y += delta * 28;
  }
  const inputX = playerState.inHelicopter
    ? (keys.d ? 1 : 0) - (keys.a ? 1 : 0)
    : (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  const inputZ = playerState.inHelicopter
    ? (keys.w ? 1 : 0) - (keys.s ? 1 : 0)
    : (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
  const viewForward = new THREE.Vector3(Math.sin(orbitCamera.yaw), 0, Math.cos(orbitCamera.yaw));
  const viewRight = new THREE.Vector3(Math.cos(orbitCamera.yaw), 0, -Math.sin(orbitCamera.yaw));
  const direction = new THREE.Vector3()
    .addScaledVector(viewForward, inputZ)
    .addScaledVector(viewRight, inputX);
  const moving = direction.lengthSq() > 0;
  const isCrouched = !!(keys.c || keys.control || keys.controlleft || keys.controlright)
    && !playerState.inCar && !playerState.inHelicopter;

  const importedAnimationControlsRig = updateWalkAnimation(inputX, inputZ, isCrouched, delta);

  if (playerState.enteringCar && playerState.carTarget) {
    playerState.enterProgress += delta;
    const animationDuration = enterCarAnimationAction?.getClip().duration || 1.5;
    if (playerState.enterProgress >= Math.min(animationDuration, 2.5)) {
      playerState.enteringCar = false;
      playerState.inCar = playerState.vehicleType === 'car';
      playerState.inHelicopter = playerState.vehicleType === 'helicopter';
      if (activeLocomotionAction === enterCarAnimationAction) {
        enterCarAnimationAction.stop();
        activeLocomotionAction = null;
      }
    }
  }

  drivePlayerCar(delta);
  drivePlayerHelicopter(delta, inputX, inputZ, viewForward, viewRight);

  if (!playerState.inCar && !playerState.inHelicopter && !playerState.enteringCar && moving) {
    direction.normalize();
    const speed = keys.shift ? 9 : isCrouched ? 3.2 : 5.5;
    const nextX = player.position.x + direction.x * speed * delta;
    const nextZ = player.position.z + direction.z * speed * delta;
    const resolved = resolveWorldMovement(
      player.position.x,
      player.position.z,
      nextX,
      nextZ,
      0.45,
      player.position.y,
      1.8
    );
    const canMove = resolved.x !== player.position.x || resolved.z !== player.position.z;
    player.position.set(resolved.x, player.position.y, resolved.z);
    const walkingForwardOnly = keys.w && !keys.s && !keys.a && !keys.d && !isCrouched && !playerState.jumping;
    const forwardLocomotion = activeLocomotionAction !== null
      && (activeLocomotionAction === walkAnimationAction || activeLocomotionAction === runAnimationAction);
    if (canMove && walkingForwardOnly && forwardLocomotion) {
      const clipDuration = activeLocomotionAction.getClip().duration;
      const animationSpeed = activeLocomotionAction.getEffectiveTimeScale();
      if (clipDuration > 0 && animationSpeed > 0) {
        player.position.addScaledVector(viewForward, 0.8 * delta * animationSpeed / clipDuration);
      }
    }
    player.rotation.y = orbitCamera.yaw + Math.PI;
  }

  updatePlayerMovementState(inputX, inputZ, delta, importedAnimationControlsRig);

  if (playerState.inCar || playerState.inHelicopter) {
    player.position.y = (playerState.carTarget?.position.y || 0) + (playerState.inHelicopter ? 2 : 0.9);
  }

  if (pistolPickup && !playerState.inCar && !playerState.inHelicopter) {
    const pickupDistance = Math.hypot(
      player.position.x - pistolPickupLocation.x,
      player.position.z - pistolPickupLocation.z
    );
    if (pickupDistance <= pistolPickupRadius) collectPistol();
  }
  if (shotgunPickup && !playerState.inCar && !playerState.inHelicopter) {
    const pickupDistance = Math.hypot(
      player.position.x - shotgunPickupLocation.x,
      player.position.z - shotgunPickupLocation.z
    );
    if (pickupDistance <= shotgunPickupRadius) collectShotgun();
  }
  updateHeldPistolTransform();
  updateHeldShotgunTransform();
  updateHeldSniperTransform();

  player.position.x = THREE.MathUtils.clamp(player.position.x, WORLD_BOUNDS.minX + 5, WORLD_BOUNDS.maxX - 5);
  player.position.z = THREE.MathUtils.clamp(player.position.z, WORLD_BOUNDS.minZ + 5, WORLD_BOUNDS.maxZ - 5);
  traffic.forEach((car) => {
    if (playerState.carTarget === car || car.userData.parked) return;
    const nextX = car.position.x + car.userData.speed * delta;
    if (isOnTijucaMountain(nextX, car.position.z, 4)) {
      car.userData.speed = 0;
      car.userData.parked = true;
      return;
    }
    car.position.x = nextX;
    car.position.y = getSurfaceHeight(car.position.x, car.position.z);
    if (car.userData.speed > 0 && car.position.x > WORLD_BOUNDS.maxX + 10) {
      car.position.x = WORLD_BOUNDS.minX - 10;
      car.rotation.y = 0;
      if (car.userData.useImportedVehicle) assignRandomTrafficVehicle(car);
    } else if (car.userData.speed < 0 && car.position.x < WORLD_BOUNDS.minX - 10) {
      car.position.x = WORLD_BOUNDS.maxX + 10;
      car.rotation.y = Math.PI;
      if (car.userData.useImportedVehicle) assignRandomTrafficVehicle(car);
    }
  });
  const targetFov = orbitCamera.mode === 'firstPerson' ? 72 : playerState.inCar || playerState.inHelicopter ? 88 : (mapVisible ? 72 : 58);
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.06);
  camera.updateProjectionMatrix();

  if (playerModel) playerModel.visible = orbitCamera.mode !== 'firstPerson' && !playerState.inCar && !playerState.inHelicopter;
  if (orbitCamera.mode === 'firstPerson') {
    if (playerState.inCar && playerState.carTarget) {
      const car = playerState.carTarget;
      cameraTarget.set(
        car.position.x + Math.sin(car.rotation.y) * 0.8,
        car.position.y + 1.55,
        car.position.z + Math.cos(car.rotation.y) * 0.8
      );
    } else {
      const head = playerModel?.getObjectByName('mixamorigHead_06');
      if (head) {
        head.getWorldPosition(cameraTarget);
      } else {
        cameraTarget.set(player.position.x, player.position.y + 1.55, player.position.z);
      }
    }

    camera.position.copy(cameraTarget);
    const yaw = orbitCamera.yaw;
    const pitch = orbitCamera.pitch;
    cameraLookTarget.set(
      cameraTarget.x + Math.sin(yaw) * Math.cos(pitch),
      cameraTarget.y + Math.sin(pitch),
      cameraTarget.z + Math.cos(yaw) * Math.cos(pitch)
    );
    camera.lookAt(cameraLookTarget);
  } else {
    const cameraSubject = playerState.inCar && playerState.carTarget ? playerState.carTarget : player;
    cameraLookTarget.set(cameraSubject.position.x, cameraSubject.position.y + 1.2, cameraSubject.position.z);
    cameraPositionTarget.set(
      cameraLookTarget.x - viewForward.x * orbitCamera.distance * Math.cos(orbitCamera.pitch),
      cameraLookTarget.y + Math.sin(orbitCamera.pitch) * orbitCamera.distance,
      cameraLookTarget.z - viewForward.z * orbitCamera.distance * Math.cos(orbitCamera.pitch)
    );
    camera.position.lerp(cameraPositionTarget, 1 - Math.pow(.005, delta));
    camera.lookAt(cameraLookTarget);
  }
  const missionDistance = Math.hypot(player.position.x - missionGoal.x, player.position.z - missionGoal.z);
  const missionProgress = THREE.MathUtils.clamp(100 * (1 - missionDistance / missionStartDistance), 0, 100);
  document.querySelector('#distance').textContent = `${(missionDistance / 100).toFixed(1)} km`;
  document.querySelector('#mission-progress').style.width = `${missionProgress}%`;
  const inTijuca = isOnTijucaMountain(player.position.x, player.position.z, 24);
  const inBridge = Math.abs(player.position.x - NITEROI_BRIDGE.x) < 24
    && player.position.z >= NITEROI_BRIDGE.startZ - 12
    && player.position.z <= NITEROI_BRIDGE.endZ + 12;
  const inTijucaBeach = player.position.x >= TIJUCA_BEACH.minX
    && player.position.z >= -300 && player.position.z <= -245;
  const nearSugarloaf = Math.hypot(player.position.x - 85, player.position.z + 80) < 42;
  const nearAmmuRio = Math.hypot(
    player.position.x - AMMU_RIO_LOCATION.x,
    player.position.z - AMMU_RIO_LOCATION.z
  ) < 12;
  const inNiteroi = player.position.z >= 920 && player.position.z <= 1180
    && player.position.x >= -240 && player.position.x <= 225;
  document.querySelector('#district').textContent = inBridge
    ? 'Ponte Rio-Niterói'
    : nearAmmuRio ? 'Ammu-Rio'
    : inNiteroi ? 'Netróit'
      : inTijuca ? 'Tijuca'
      : inTijucaBeach ? 'Praia da Tijuca'
        : nearSugarloaf ? 'Pão de Açúcar'
          : Math.abs(player.position.x) < 55 && Math.abs(player.position.z) < 45
            ? 'Copacabana'
            : player.position.x > 100 ? 'Urca' : player.position.x < -100 ? 'Leme' : player.position.z < 0 ? 'Zona Norte' : 'Zona Sul';
  updateMiniMap();
  interactionPrompt.hidden = !nearAmmuRio || playerState.inCar || playerState.inHelicopter;
  document.querySelector('#toast').classList.toggle('visible', missionDistance < 8);
  renderer.render(scene, camera);
}
const titleScreen = document.getElementById('title-screen');
const startGameButton = document.getElementById('start-game');
const continueGameButton = document.getElementById('continue-game');
const gameMenuButton = document.getElementById('open-game-menu');
const gameMenu = document.getElementById('game-menu');
const gameMenuMessage = document.getElementById('game-menu-message');
const titleSaveMessage = document.getElementById('title-save-message');
const gameMenuMapTab = document.getElementById('game-menu-map-tab');
const gameMenuControlsTab = document.getElementById('game-menu-controls-tab');
const gameMenuMapPanel = document.getElementById('game-menu-map-panel');
const gameMenuControlsPanel = document.getElementById('game-menu-controls-panel');
const gameMinutesAtStart = 17 * 60;

function readSavedGame() {
  try {
    const serializedSave = localStorage.getItem(GAME_SAVE_KEY);
    if (!serializedSave) return null;
    const save = JSON.parse(serializedSave);
    if (save?.version !== 1 || !Number.isFinite(save.x) || !Number.isFinite(save.z)
      || save.x < WORLD_BOUNDS.minX || save.x > WORLD_BOUNDS.maxX
      || save.z < WORLD_BOUNDS.minZ || save.z > WORLD_BOUNDS.maxZ
      || !Number.isInteger(save.minutesOfDay) || save.minutesOfDay < 0 || save.minutesOfDay >= 24 * 60) {
      throw new Error('O arquivo de progresso salvo está inválido.');
    }
    return save;
  } catch (error) {
    console.error('Não foi possível ler o progresso salvo:', error);
    return null;
  }
}

function refreshTitleSaveState() {
  continueGameButton.hidden = !readSavedGame();
}

function saveGame() {
  const actorPosition = (playerState.inCar || playerState.inHelicopter) && playerState.carTarget
    ? playerState.carTarget.position
    : player.position;
  try {
    localStorage.setItem(GAME_SAVE_KEY, JSON.stringify({
      version: 1,
      x: actorPosition.x,
      z: actorPosition.z,
      minutesOfDay: displayedGameMinute >= 0 ? displayedGameMinute : gameMinutesAtStart
    }));
    continueGameButton.hidden = false;
    return true;
  } catch (error) {
    const message = 'Não foi possível salvar o progresso neste navegador.';
    console.error(message, error);
    gameMenuMessage.textContent = message;
    gameMenuMessage.hidden = false;
    titleSaveMessage.textContent = message;
    titleSaveMessage.hidden = false;
    return false;
  }
}

function beginGame(savedGame = null) {
  if (savedGame) {
    player.position.set(savedGame.x, getSurfaceHeight(savedGame.x, savedGame.z), savedGame.z);
    const elapsedMinutes = (savedGame.minutesOfDay - gameMinutesAtStart + 24 * 60) % (24 * 60);
    gameTimeStartedAt = performance.now() - elapsedMinutes * 1000;
  } else {
    resetPlayer();
    gameTimeStartedAt = performance.now();
  }
  displayedGameMinute = -1;
  gameStarted = true;
  gamePaused = false;
  hasRunGameThisPage = true;
  lastAutosaveAt = performance.now();
  updateGameTime();
  document.body.classList.remove('game-not-started');
  titleScreen.classList.add('hidden');
  gameMenu.hidden = true;
  startGameButton.disabled = false;
  saveGame();
}

function openGameMenu() {
  if (!gameStarted || gamePaused) return;
  if (mapVisible) hideMap();
  saveGame();
  gamePaused = true;
  selectGameMenuTab('map');
  gameMenuMessage.hidden = true;
  gameMenu.hidden = false;
}

function selectGameMenuTab(tab) {
  const showMap = tab === 'map';
  gameMenuMapTab.classList.toggle('active', showMap);
  gameMenuMapTab.setAttribute('aria-selected', String(showMap));
  gameMenuControlsTab.classList.toggle('active', !showMap);
  gameMenuControlsTab.setAttribute('aria-selected', String(!showMap));
  gameMenuMapPanel.hidden = !showMap;
  gameMenuControlsPanel.hidden = showMap;
}

function resumeGame() {
  gamePaused = false;
  gameMenu.hidden = true;
}

function exitToTitle() {
  if (!saveGame()) return;
  if (playerState.inCar && playerState.carTarget) {
    playerState.carTarget.userData.speed = 0;
    playerState.carTarget.userData.driveSpeed = 0;
    playerState.carTarget.userData.parked = true;
  }
  if (playerState.inHelicopter && playerState.carTarget) {
    player.position.set(
      playerState.carTarget.position.x,
      getSurfaceHeight(playerState.carTarget.position.x, playerState.carTarget.position.z),
      playerState.carTarget.position.z
    );
  }
  playerState.inCar = false;
  playerState.inHelicopter = false;
  playerState.enteringCar = false;
  playerState.carTarget = null;
  playerState.vehicleType = null;
  playerState.enterProgress = 0;
  gameStarted = false;
  gamePaused = false;
  gameMenu.hidden = true;
  titleScreen.classList.remove('hidden');
  document.body.classList.add('game-not-started');
  titleSaveMessage.hidden = true;
  refreshTitleSaveState();
}

startGameButton.addEventListener('click', () => {
  titleSaveMessage.hidden = true;
  try {
    localStorage.removeItem(GAME_SAVE_KEY);
  } catch (error) {
    console.error('Não foi possível apagar o progresso salvo:', error);
    titleSaveMessage.textContent = 'Não foi possível iniciar um jogo novo porque o progresso salvo não pôde ser apagado.';
    titleSaveMessage.hidden = false;
    return;
  }

  if (hasRunGameThisPage) {
    try {
      sessionStorage.setItem(START_NEW_GAME_KEY, 'true');
      location.reload();
      return;
    } catch (error) {
      console.error('Não foi possível reiniciar o jogo para criar uma sessão nova:', error);
    }
  }
  beginGame();
});

continueGameButton.addEventListener('click', () => {
  titleSaveMessage.hidden = true;
  const savedGame = readSavedGame();
  if (!savedGame) {
    refreshTitleSaveState();
    titleSaveMessage.textContent = 'Não há progresso salvo para continuar.';
    titleSaveMessage.hidden = false;
    return;
  }
  beginGame(savedGame);
});

gameMenuButton.addEventListener('click', openGameMenu);
gameMenuMapTab.addEventListener('click', () => selectGameMenuTab('map'));
gameMenuControlsTab.addEventListener('click', () => selectGameMenuTab('controls'));
document.getElementById('resume-game').addEventListener('click', resumeGame);
document.getElementById('exit-to-title').addEventListener('click', exitToTitle);
window.addEventListener('beforeunload', () => {
  if (gameStarted) saveGame();
});

refreshTitleSaveState();
try {
  if (sessionStorage.getItem(START_NEW_GAME_KEY) === 'true') {
    sessionStorage.removeItem(START_NEW_GAME_KEY);
    beginGame();
  }
} catch (error) {
  console.error('Não foi possível verificar a solicitação de novo jogo:', error);
}
animate();

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
