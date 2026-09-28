import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1719);
scene.fog = new THREE.Fog(0x0c1719, 48, 165);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 400);
camera.position.set(10, 8, 13);
const renderer = new THREE.WebGLRenderer({ antialias: true });
window.__scene = scene;
window.__camera = camera;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.querySelector('#game').appendChild(renderer.domElement);

const orbitCamera = {
  mode: 'follow',
  yaw: Math.PI * 0.55,
  pitch: 0.7,
  distance: 12,
  minDistance: 7,
  maxDistance: 24,
  dragging: false
};

const cameraMoveInput = { forward: 0, strafe: 0, lift: 0 };

const palette = {
  asphalt: 0x202a2b, sidewalk: 0x85887d, sand: 0xc29a69, ocean: 0x164d5a,
  mountain: 0x173e39, mountainFar: 0x23534a, building: 0xc76749, cream: 0xe8d5a7,
  acid: 0xd2f06d, coral: 0xf07e4f, black: 0x111b1c, car: 0xd64f3e
};
const mat = (color, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });
const box = (w, h, d, material, x, y, z) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh; };

scene.add(new THREE.HemisphereLight(0xa4c5bf, 0x16201c, 1.8));
const moon = new THREE.DirectionalLight(0xffd7a3, 2.8);
moon.position.set(-35, 55, 25); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.camera.left = -80; moon.shadow.camera.right = 80; moon.shadow.camera.top = 80; moon.shadow.camera.bottom = -80; scene.add(moon);

const ground = box(180, 0.25, 180, mat(0x263635), 0, -0.14, 0);
const ocean = box(110, 0.3, 70, mat(palette.ocean, 0.35), 0, -0.02, -55);
const sand = box(110, 0.2, 8, mat(palette.sand), 0, 0.05, -18);
const road = box(110, 0.18, 16, mat(palette.asphalt), 0, 0.07, -6);
const sideWalk = mat(palette.sidewalk);
box(110, 0.28, 2.5, sideWalk, 0, .18, -15);
box(110, 0.28, 2.5, sideWalk, 0, .18, 3);
for (let x = -52; x < 55; x += 8) { box(4.6, .03, .12, mat(0xd4c979), x, .18, -6); }

function getSurfaceHeight(z) {
  if (z >= -14 && z <= 2) return 0.16;
  if ((z >= -16.25 && z < -14) || (z > 2 && z <= 4.25)) return 0.32;
  if (z >= -22 && z < -16.25) return 0.15;
  return -0.015;
}

function mountain(x, z, scale, color) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(16 * scale, 32 * scale, 7), mat(color));
  m.position.set(x, 14 * scale - .2, z); m.rotation.y = .25; m.castShadow = true; scene.add(m);
}
mountain(-51, -44, 1.6, palette.mountainFar); mountain(-22, -48, 1.25, palette.mountain); mountain(19, -49, 1.7, palette.mountainFar); mountain(53, -46, 1.1, palette.mountain);

function building(x, z, w, h, d, color, floors = 4) {
  const b = box(w, h, d, mat(color), x, h / 2, z);
  for (let floor = 0; floor < floors; floor++) for (let col = -1; col <= 1; col++) {
    const window = box(.42, .55, .025, mat(floor % 2 ? 0xf7cc75 : 0x8eb8ac), x + col * (w / 4), floor * (h / floors) + 1.15, z - d / 2 - .02);
    window.castShadow = false;
  }
  return b;
}
for (let i = 0; i < 12; i++) {
  const x = -50 + i * 9.2;
  building(x, 10 + (i % 2) * 4, 6.2, 9 + (i % 4) * 2.4, 5, i % 3 === 0 ? palette.cream : i % 3 === 1 ? palette.building : 0x58766c, 4);
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

const promenade = new THREE.Mesh(new THREE.BoxGeometry(110, 0.14, 5.4), mat(0xd9c39b));
promenade.position.set(0, 0.21, -11.6);
promenade.receiveShadow = true;
scene.add(promenade);

const carStopStripe = new THREE.Mesh(new THREE.BoxGeometry(100, 0.02, 0.22), mat(0xf5efdc));
carStopStripe.position.set(0, 0.24, -8.2);
scene.add(carStopStripe);

// A graphic landmark silhouette on the far hill.
const statue = new THREE.Group(); statue.position.set(34, 19, -45); scene.add(statue);
const statueBody = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.4, 8, 8), mat(palette.cream)); statueBody.position.y = 3.9; statue.add(statueBody);
const statueHead = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), mat(palette.cream)); statueHead.position.y = 8.5; statue.add(statueHead);
for (const side of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(8, .55, .55), mat(palette.cream)); arm.position.set(side * 3.8, 7.2, 0); arm.rotation.z = side * -.05; statue.add(arm); }

function makeCar(color = palette.car, scale = 1) {
  const car = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1 * scale, .65 * scale, 4.1 * scale), mat(color)); body.position.y = .7 * scale; body.castShadow = true; car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55 * scale, .65 * scale, 1.95 * scale), mat(0x263d3d, .25)); cabin.position.set(0, 1.18 * scale, -.2 * scale); cabin.castShadow = true; car.add(cabin);
  const wheelMat = mat(0x151b1c); for (const x of [-1, 1]) for (const z of [-1.35, 1.35]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.4 * scale, .4 * scale, .25 * scale, 12), wheelMat); wheel.rotation.z = Math.PI / 2; wheel.position.set(x * 1.02 * scale, .43 * scale, z * scale); car.add(wheel); }
  return car;
}
const player = new THREE.Group(); player.position.set(0, 0, 0); scene.add(player);
window.__player = player;

const playerState = {
  crouching: false,
  jumping: false,
  inCar: false,
  jumpVelocity: 0,
  jumpHeight: 0,
  grounded: true,
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
let playerMixer = null;
let playerAction = null;
let idleAction = null;
let playerRig = null;
const loader = new GLTFLoader();
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
      leftArm: model.getObjectByName('mixamorigLeftArm_09') || model.getObjectByName('LeftArm'),
      rightArm: model.getObjectByName('mixamorigRightArm_033') || model.getObjectByName('RightArm'),
      leftLeg: model.getObjectByName('mixamorigLeftLeg_00') || model.getObjectByName('LeftLeg'),
      rightLeg: model.getObjectByName('mixamorigRightLeg_061') || model.getObjectByName('RightLeg')
    };

    if (gltf.animations && gltf.animations.length) {
      playerMixer = new THREE.AnimationMixer(model);

      const walkClip = gltf.animations.find((clip) => /walk|run|move|stride|cycle/i.test(clip.name || '')) || gltf.animations[0];
      const idleClip = gltf.animations.find((clip) => /idle|stand|breath|pose|wave/i.test(clip.name || ''));

      if (walkClip) {
        playerAction = playerMixer.clipAction(walkClip);
        playerAction.loop = THREE.LoopRepeat;
        playerAction.play();
      }

      if (idleClip && idleClip !== walkClip) {
        idleAction = playerMixer.clipAction(idleClip);
        idleAction.loop = THREE.LoopRepeat;
        idleAction.play();
        idleAction.setEffectiveWeight(0.2);
      }
    }
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
[[-19, -6, palette.cream, .7], [25, -6, 0x3f7f71, .65], [48, -6, 0xd3a64e, .75]].forEach(([x, z, color, speed]) => { const car = makeCar(color, .85); car.position.set(x, 0, z); car.userData.speed = speed; traffic.push(car); scene.add(car); });

const keys = {};
const keyName = (event) => event.key.toLowerCase();
addEventListener('keydown', (event) => {
  const name = keyName(event);
  keys[name] = true;
  if (event.code === 'Space' && !event.repeat && !playerState.inCar && !playerState.jumping && playerState.grounded) {
    playerState.jumping = true;
    playerState.grounded = false;
    playerState.jumpVelocity = 7.2;
  }
  if (event.key.toLowerCase() === 'e' && !playerState.inCar) {
    const nearestCar = traffic.find((car) => car.position.distanceTo(player.position) < 3.5);
    if (nearestCar) {
      playerState.inCar = true;
      playerState.carTarget = nearestCar;
      playerState.enterProgress = 0;
    }
  }
  if (event.key.toLowerCase() === 'f' && playerState.inCar) {
    playerState.inCar = false;
    playerState.carTarget = null;
    playerState.enterProgress = 0;
  }
  if (event.key.toLowerCase() === 'r') resetPlayer();
});
addEventListener('keyup', (event) => { keys[keyName(event)] = false; });
const start = player.position.clone();
function resetPlayer() {
  player.position.copy(start);
  player.position.y = 0;
  playerState.jumping = false;
  playerState.grounded = true;
  playerState.jumpHeight = 0;
  playerState.jumpVelocity = 0;
  document.querySelector('#toast').classList.remove('visible');
}

const miniMap = document.getElementById('mini-map');
const miniPlayer = document.getElementById('mini-player');

function updateMiniMap() {
  if (!miniMap || !miniPlayer) return;
  const x = THREE.MathUtils.clamp(((player.position.x + 55) / 110) * 100, 5, 95);
  const z = THREE.MathUtils.clamp(((player.position.z + 24) / 46) * 100, 8, 92);
  miniPlayer.style.left = `${x}%`;
  miniPlayer.style.top = `${z}%`;
}

function updatePlayerMovementState(inputX, inputZ, delta) {
  const moving = inputX !== 0 || inputZ !== 0;
  const crouched = !!(keys.c || keys.control || keys.controlleft || keys.controlright) && !playerState.inCar;
  playerState.crouching = crouched && !playerState.jumping;

  if (!playerState.inCar) {
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

    player.position.y = playerState.jumpHeight;
  }

  if (playerState.inCar && playerState.carTarget) {
    const target = playerState.carTarget.position.clone();
    target.y = 0.9;
    player.position.lerp(target, 0.12);
    player.rotation.y = playerState.carTarget.rotation.y;
  }

  if (playerModel) {
    playerModel.rotation.x = 0;
    playerModel.rotation.z = 0;
  }

  if (playerRig) {
    const step = performance.now() * (keys.shift && moving && !playerState.crouching ? 0.034 : 0.019);
    const swing = moving && !playerState.inCar ? Math.sin(step) : 0;
    const jumpBias = playerState.jumping ? 0.5 : 0;
    if (playerRig.leftLeg) playerRig.leftLeg.rotation.x = playerState.inCar ? -0.15 : (playerState.crouching ? 0.8 : moving ? swing * 1.6 : 0.12 + jumpBias);
    if (playerRig.rightLeg) playerRig.rightLeg.rotation.x = playerState.inCar ? 0.15 : (playerState.crouching ? -0.8 : moving ? -swing * 1.6 : -0.12 - jumpBias);
    if (playerRig.leftArm) playerRig.leftArm.rotation.x = playerState.inCar ? 0.35 : (playerState.crouching ? 0.9 : moving ? -swing * 1.2 : 0.16 + jumpBias);
    if (playerRig.rightArm) playerRig.rightArm.rotation.x = playerState.inCar ? -0.35 : (playerState.crouching ? -0.9 : moving ? swing * 1.2 : -0.16 - jumpBias);
    if (playerRig.spine) playerRig.spine.rotation.x = playerState.jumping ? 0.4 : (playerState.crouching ? 0.4 : moving ? Math.sin(step * 0.7) * 0.22 : 0.03);
    if (playerRig.hips) playerRig.hips.rotation.z = playerState.inCar ? 0 : (moving ? Math.sin(step) * 0.1 : 0);
  }

  if (playerMixer) {
    const animRunning = moving && !playerState.crouching && !playerState.jumping && !playerState.inCar;
    if (playerAction) {
      playerAction.timeScale = playerState.inCar ? 0.2 : (animRunning ? (keys.shift ? 1.8 : 1.25) : 0.6);
      playerAction.setEffectiveWeight(animRunning ? 1 : 0.2);
    }
    if (idleAction) {
      idleAction.setEffectiveWeight(playerState.inCar ? 0.1 : (animRunning ? 0.1 : 0.8));
    }
    playerMixer.update(delta);
  }
}

const mapPanel = document.getElementById('world-map');
const closeMapButton = document.getElementById('map-close');
const districts = [...document.querySelectorAll('.district')];
let mapVisible = false;
let mapRevealTimer = null;

window.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('pointerdown', (event) => {
  if (event.button === 2 && !playerState.inCar) orbitCamera.dragging = true;
});
window.addEventListener('pointerup', () => { orbitCamera.dragging = false; });
window.addEventListener('pointermove', (event) => {
  if (!orbitCamera.dragging || orbitCamera.mode !== 'free') return;
  orbitCamera.yaw -= event.movementX * 0.005;
  orbitCamera.pitch = THREE.MathUtils.clamp(orbitCamera.pitch - event.movementY * 0.003, 0.18, 1.15);
});
window.addEventListener('wheel', (event) => {
  if (orbitCamera.mode === 'free') {
    orbitCamera.distance = THREE.MathUtils.clamp(orbitCamera.distance + event.deltaY * 0.01, orbitCamera.minDistance, orbitCamera.maxDistance);
  }
}, { passive: true });

function revealMap() {
  mapVisible = true;
  mapPanel.classList.remove('hidden');
  districts.forEach((district, index) => {
    const delay = index * 110;
    setTimeout(() => district.classList.add('visible'), delay);
  });
}

function hideMap() {
  mapVisible = false;
  mapPanel.classList.add('hidden');
  districts.forEach((district) => district.classList.remove('visible'));
}

closeMapButton.addEventListener('click', () => hideMap());
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'm') {
    if (mapVisible) hideMap();
    else revealMap();
  }
  if (key === 'v' && !event.repeat) {
    orbitCamera.mode = orbitCamera.mode === 'follow' ? 'free' : 'follow';
  }
  if (key === 'q') cameraMoveInput.lift = 1;
  if (key === 'e') cameraMoveInput.lift = -1;
  if (key === 'w' || key === 'arrowup') cameraMoveInput.forward = 1;
  if (key === 's' || key === 'arrowdown') cameraMoveInput.forward = -1;
  if (key === 'a' || key === 'arrowleft') cameraMoveInput.strafe = -1;
  if (key === 'd' || key === 'arrowright') cameraMoveInput.strafe = 1;
});
window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'q' || key === 'e') cameraMoveInput.lift = 0;
  if (key === 'w' || key === 'arrowup' || key === 's' || key === 'arrowdown') cameraMoveInput.forward = 0;
  if (key === 'a' || key === 'arrowleft' || key === 'd' || key === 'arrowright') cameraMoveInput.strafe = 0;
});
setTimeout(() => revealMap(), 500);

const cameraTarget = new THREE.Vector3();
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .04);
  const inputX = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  const inputZ = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
  const direction = new THREE.Vector3(inputX, 0, inputZ);
  const moving = direction.lengthSq() > 0;
  const isCrouched = !!(keys.c || keys.control || keys.controlleft || keys.controlright) && !playerState.inCar;

  if (!playerState.inCar && moving) {
    direction.normalize();
    const speed = keys.shift ? 9 : isCrouched ? 3.2 : 5.5;
    player.position.addScaledVector(direction, speed * delta);
    player.rotation.y = Math.atan2(direction.x, direction.z) + Math.PI;
  }

  updatePlayerMovementState(inputX, inputZ, delta);

  if (playerState.inCar) {
    player.position.y = 0.3;
  }

  if (playerState.inCar && playerState.carTarget) {
    playerState.carTarget.rotation.y += delta * 0.35;
  }

  player.position.x = THREE.MathUtils.clamp(player.position.x, -49, 49);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -13, 7);
  traffic.forEach(car => { car.position.x += car.userData.speed * delta * 5; if (car.position.x > 57) car.position.x = -57; });
  const targetFov = playerState.inCar ? 88 : (mapVisible ? 72 : 58);
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.06);
  camera.updateProjectionMatrix();

  if (orbitCamera.mode === 'free') {
    const forward = new THREE.Vector3(Math.sin(orbitCamera.yaw), 0, Math.cos(orbitCamera.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const vertical = new THREE.Vector3(0, 1, 0);
    const move = new THREE.Vector3();

    if (cameraMoveInput.forward !== 0) move.addScaledVector(forward, cameraMoveInput.forward);
    if (cameraMoveInput.strafe !== 0) move.addScaledVector(right, cameraMoveInput.strafe);
    if (cameraMoveInput.lift !== 0) move.addScaledVector(vertical, cameraMoveInput.lift);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(delta * 12);
      camera.position.add(move);
    }

    const lookTarget = camera.position.clone().add(forward).add(new THREE.Vector3(0, Math.sin(orbitCamera.pitch) * 2, 0));
    camera.lookAt(lookTarget);
  } else {
    cameraTarget.set(player.position.x + 10, playerState.inCar ? 5.2 : 6.4, player.position.z + (playerState.inCar ? 14 : 11));
    camera.position.lerp(cameraTarget, 1 - Math.pow(.005, delta));
    camera.lookAt(player.position.x, 1, player.position.z - 3);
  }
  const distance = Math.max(0, 1200 - Math.round(Math.abs(player.position.x) * 12 + Math.abs(player.position.z) * 5));
  document.querySelector('#distance').textContent = `${(distance / 1000).toFixed(1)} km`;
  document.querySelector('#mission-progress').style.width = `${Math.min(100, 23 + (Math.abs(player.position.x) / 50) * 65)}%`;
  document.querySelector('#district').textContent = player.position.x > 22 ? 'Urca' : player.position.x < -22 ? 'Leme' : 'Copacabana';
  updateMiniMap();
  if (Math.abs(player.position.x) > 43) document.querySelector('#toast').classList.add('visible');
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
