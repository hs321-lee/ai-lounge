// 12월 발표 '수업 중 개인 AI 활용' 카드 세 개의 실시간 3D (three.js).
// Blender(scripts/blender/recap-3d.py)에서 내보낸 GLB의 모델·애니메이션·카메라를 그대로 쓰고,
// 곡선 관은 extras의 중심선으로 다시 만들어 앞에서부터 그립니다.
// 반복: 만들어짐(4초) → 정지(2.6초) → 작아지며 사라짐(0.7초) → 잠깐 비움(0.3초) → 다시 만들어짐.
// WebGL을 못 쓰면 이 모듈이 아무것도 바꾸지 않아 Blender 정지 그림과 라벨이 그대로 남습니다.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const FPS = 30;                     // Blender 장면의 프레임 속도
const BUILD = 4.0, HOLD = 2.6, OUT = 0.7, GAP = 0.3;
const CYCLE = BUILD + HOLD + OUT + GAP;
const STAGGER = 0.35;               // 01 → 02 → 03 시작 간격
const LABELS_AT = 3.5;              // 모델이 거의 완성된 뒤 라벨 등장
const TUBE_SEGMENTS = 160, TUBE_SIDES = 14;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeInBack = x => { const c = 1.6; return (c + 1) * x ** 3 - c * x ** 2; };

function buildTube(holder, materials) {
  const { points, radius, draw, material } = holder.userData;
  const vectors = [];
  for (let i = 0; i < points.length; i += 3) vectors.push(new THREE.Vector3(points[i], points[i + 1], points[i + 2]));
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vectors), TUBE_SEGMENTS, radius, TUBE_SIDES, false);
  const mesh = new THREE.Mesh(geometry, materials.get(material) || new THREE.MeshStandardMaterial({ color: 0xec6100 }));
  mesh.castShadow = true;
  holder.parent.add(mesh);
  const total = geometry.index.count, perSegment = TUBE_SIDES * 6;
  // Blender의 bevel_factor_end(SINE, 양쪽 완만) 시점을 그대로 따릅니다.
  return time => {
    const k = clamp((time * FPS + 1 - draw[0]) / draw[1]);
    const eased = 0.5 - Math.cos(Math.PI * k) / 2;
    mesh.geometry.setDrawRange(0, Math.round((total / perSegment) * eased) * perSegment);
    mesh.visible = eased > 0.002;
  };
}

async function createCard(stage, index, environment, loader, reduce) {
  const gltf = await loader.loadAsync(stage.dataset.glb);
  if (!stage.isConnected) return null;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.domElement.className = "recap-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  scene.environment = environment;
  scene.environmentIntensity = 0.8;
  const root = gltf.scene;
  scene.add(root);
  const camera = gltf.cameras[0];
  camera.updateMatrixWorld(true);

  // Blender 조명 배치(키·채움·테두리)를 three.js 좌표(Y 위)로 옮겼습니다.
  const key = new THREE.DirectionalLight(0xfff1e2, 2.4);
  key.position.set(-6, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 9;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  scene.add(key, new THREE.HemisphereLight(0xfff4e8, 0xe8d6c2, 1.3));
  const rim = new THREE.DirectionalLight(0xffd2ad, 0.8);
  rim.position.set(2, 6, -8);
  scene.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ color: 0x4a2a14, opacity: 0.2 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const materials = new Map();
  root.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true;  // 그림자는 바닥만 받습니다(모델끼리 받으면 VSM 번짐이 생김).
    materials.set(node.material.name, node.material);
  });
  const tubes = [];
  root.traverse(node => { if (node.userData?.points) tubes.push(node); });
  const drawers = tubes.map(holder => buildTube(holder, materials));

  // 재생 상태(일시정지·종료)에 기대지 않고, 매 프레임 각 클립의 시각을 직접 지정합니다.
  // (LoopOnce는 끝에 닿으면 멈춰서, 반복할 때 처음 상태에 고정되기 때문입니다.)
  const mixer = new THREE.AnimationMixer(root);
  const actions = gltf.animations.map(clip => mixer.clipAction(clip).play());
  const end = Math.max(...gltf.animations.map(clip => clip.duration));
  const seek = time => {
    for (const action of actions) action.time = Math.min(time, action.getClip().duration - 1e-4);
    mixer.update(0);
  };

  const anchors = new Map();
  root.traverse(node => { if (node.name.startsWith("anchor_")) anchors.set(node.name.slice(7), node); });
  const labels = [...stage.querySelectorAll(".recap-label[data-anchor]")].map(element => ({ element, anchor: anchors.get(element.dataset.anchor) }));
  const projected = new THREE.Vector3();

  stage.prepend(renderer.domElement);
  const resize = () => {
    const { clientWidth: width, clientHeight: height } = stage;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();

  // 장면 시각 하나로 모델·관·라벨·사라짐을 모두 정합니다.
  const pose = (time, labelsOn, scale = 1) => {
    seek(time);
    drawers.forEach(draw => draw(time));
    root.scale.setScalar(Math.max(scale, 0.0001));
    root.updateMatrixWorld(true);
    labels.forEach(({ element, anchor }, order) => {
      if (anchor) {
        projected.setFromMatrixPosition(anchor.matrixWorld).project(camera);
        element.style.setProperty("--x", `${(projected.x + 1) * 50}%`);
        element.style.setProperty("--y", `${(1 - projected.y) * 50}%`);
      }
      element.classList.toggle("is-shown", labelsOn && (reduce || time >= LABELS_AT + order * 0.08));
    });
    renderer.render(scene, camera);
  };

  return {
    stage,
    offset: index * STAGGER,
    resize,
    still() { pose(end + 1, true); },
    frame(clock) {
      const t = clock - index * STAGGER;
      if (t < 0) return pose(0, false);
      const c = t % CYCLE;
      if (c < BUILD) return pose(c, c >= LABELS_AT);
      if (c < BUILD + HOLD) return pose(end + 1, true);
      if (c < BUILD + HOLD + OUT) return pose(end + 1, false, 1 - easeInBack(clamp((c - BUILD - HOLD) / OUT)));
      return pose(0, false, 0);
    },
    dispose() {
      renderer.domElement.remove();
      renderer.dispose();
      root.traverse(node => { if (node.isMesh) node.geometry.dispose(); });
    },
  };
}

export function mountRecap3D(container) {
  const stages = [...container.querySelectorAll(".recap-stage[data-glb]")];
  if (!stages.length) return () => {};
  const probe = document.createElement("canvas");
  if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return () => {};
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let cards = [], frame = 0, start = 0, visible = false, disposed = false, observer, sizeObserver;

  const tick = now => {
    frame = 0;
    if (!visible || disposed) return;
    const clock = (now - start) / 1000;
    cards.forEach(card => card.frame(clock));
    frame = requestAnimationFrame(tick);
  };
  const play = () => {
    if (reduce.matches) { cards.forEach(card => card.still()); return; }
    start = performance.now();
    if (!frame) frame = requestAnimationFrame(tick);
  };

  (async () => {
    const helper = new THREE.WebGLRenderer({ alpha: true });
    const pmrem = new THREE.PMREMGenerator(helper);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    helper.dispose();
    const loader = new GLTFLoader();
    cards = (await Promise.all(stages.map((stage, index) => createCard(stage, index, environment, loader, reduce.matches).catch(() => null)))).filter(Boolean);
    if (disposed) { cards.forEach(card => card.dispose()); return; }
    cards.forEach(card => { card.frame(0); card.stage.classList.add("is-live"); });
    sizeObserver = new ResizeObserver(() => { cards.forEach(card => card.resize()); if (reduce.matches) cards.forEach(card => card.still()); });
    stages.forEach(stage => sizeObserver.observe(stage));
    // 슬라이드에 들어올 때마다 01부터 다시 시작하고, 화면 밖에서는 그리지 않습니다.
    const showing = new Set();
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? showing.add(entry.target) : showing.delete(entry.target));
      if (showing.size && !visible) { visible = true; play(); }
      else if (!showing.size) visible = false;
    }, { threshold: 0.4 });
    stages.forEach(stage => observer.observe(stage));
  })().catch(() => {});

  return () => {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    sizeObserver?.disconnect();
    cards.forEach(card => card.dispose());
  };
}
