// Voxel lobby — @reactiive_-inspired pink/green cherry-blossom world.
//
// Default view: a clean top-down 2D canvas render of the QR with the
// reference palette (pink "dark" cells on pale-mint background, with soft
// edges and a painterly speckle). This is what phones scan.
//
// On tap: smoothly transitions into a rotating 3D voxel world using the same
// palette — pale mint ground + cherry-blossom tree. Tap again to flatten.
//
// Graceful fallback: pure 2D QR if WebGL is unavailable or reduced-motion is
// set — still honors the reference palette.

import * as THREE from 'three';
import QR from 'qrcode';

export interface VoxelLobbyHandle {
  dispose(): void;
  el: HTMLElement;
}

export interface VoxelLobbyOptions {
  joinUrl: string;
  size?: number;
}

/* ---------- palette ---------- */

// 2D QR: pure black on ivory. No decoration, no rounded cells — scanners
// fire instantly because this is exactly what they're trained on.
//
// 3D world: cherry-pink + pale mint palette, used only when the user opts in.
const PALETTE = {
  qrDark:        '#0F0F14',        // clutch-ink
  qrLight:       '#FAFAF7',        // clutch-paper

  // 3D scene
  grassTopHex:   0xE8EFCD,
  darkCellHex:   0xC24A78,
  dirtSideHex:   0xB98A5A,
  trunkDarkHex:  0x4A2E1E,
  trunkMidHex:   0x6B4127,
  leavesAHex:    0xFFD2E0,
  leavesBHex:    0xF2A7C3,
  leavesCHex:    0xE27AA6,
  leavesDHex:    0xFFF0F6,
} as const;

/* ---------- entry ---------- */

export async function mountVoxelLobby(
  parent: HTMLElement,
  opts: VoxelLobbyOptions,
): Promise<VoxelLobbyHandle> {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Outer container. Column layout so the QR sits in a clean frame and any
  // CTAs live BELOW it, never overlapping.
  const container = document.createElement('div');
  container.className = 'voxel-lobby relative flex flex-col items-center select-none';
  parent.appendChild(container);

  // The QR frame owns the full canvas area; 3D scene overlays on top of the
  // 2D canvas when active. Nothing else is allowed inside this frame.
  const frame = document.createElement('div');
  frame.className = 'relative w-full';
  frame.style.aspectRatio = '1 / 1';
  container.appendChild(frame);

  const matrix = computeQrMatrix(opts.joinUrl);
  const size = opts.size ?? 560;

  const canvas2d = await render2dQr(opts.joinUrl, size);
  canvas2d.className =
    'block w-full h-full rounded-3xl shadow-md transition-opacity duration-500 bg-white';
  frame.appendChild(canvas2d);

  // CTA lives BELOW the QR, outside the frame — never overlaps the scan area.
  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className =
    'mt-4 inline-flex items-center gap-2 rounded-full border border-black/10 ' +
    'bg-white hover:bg-black/[0.03] px-4 py-2 text-xs font-semibold ' +
    'uppercase tracking-wider text-clutch-mute hover:text-clutch-ink ' +
    'transition-colors';
  cta.innerHTML = `
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M10 2l7 4v8l-7 4-7-4V6l7-4z"/>
      <path d="M10 2v16"/>
      <path d="M3 6l7 4 7-4"/>
    </svg>
    <span data-role="cta-label">View in 3D</span>
  `;
  container.appendChild(cta);

  if (prefersReduced || !supportsWebGL()) {
    // Scanner-only mode. Remove the 3D CTA — don't offer what we can't deliver.
    cta.remove();
    return { el: container, dispose: () => container.remove() };
  }

  // Lazy-mounted 3D scene; starts hidden, shown on click.
  let scene: VoxelScene | null = null;
  let mode: 'qr' | 'iso' = 'qr';

  const setLabel = (t: string): void => {
    const el = cta.querySelector('[data-role="cta-label"]');
    if (el) el.textContent = t;
  };

  const activate3d = (): void => {
    if (mode === 'iso' || !container.isConnected) return;
    mode = 'iso';
    if (!scene) {
      try {
        scene = new VoxelScene(frame, matrix, size);
      } catch (err) {
        console.warn('[voxel-lobby] 3D init failed, staying on 2D:', err);
        mode = 'qr';
        return;
      }
    }
    scene.setActive(true);
    canvas2d.classList.add('opacity-0');
    setLabel('Back to QR');
  };

  const deactivate3d = (): void => {
    if (mode === 'qr') return;
    mode = 'qr';
    scene?.setActive(false);
    canvas2d.classList.remove('opacity-0');
    setLabel('View in 3D');
  };

  const toggle = (): void => { mode === 'qr' ? activate3d() : deactivate3d(); };
  cta.addEventListener('click', toggle);
  frame.addEventListener('clutch:deactivate-3d', deactivate3d);

  return {
    el: container,
    dispose: () => {
      scene?.dispose();
      container.remove();
    },
  };
}

/* ---------- QR matrix ---------- */

interface QrMatrix {
  size: number;
  data: Uint8Array;
}

function computeQrMatrix(text: string): QrMatrix {
  const q = QR.create(text, { errorCorrectionLevel: 'M' });
  return { size: q.modules.size, data: q.modules.data as Uint8Array };
}

/* ---------- 2D scannable render (default) ----------

   Uses the `qrcode` library's toCanvas so the output is byte-for-byte what
   every QR scanner expects. Pure black on ivory; no decoration, no rounded
   cells, no overlays. Scanners lock instantly.
*/

async function render2dQr(joinUrl: string, pxSize: number): Promise<HTMLCanvasElement> {
  const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
  const canvas = document.createElement('canvas');
  await QR.toCanvas(canvas, joinUrl, {
    errorCorrectionLevel: 'M',
    // 4-module quiet zone per QR spec — phone scanners need this to lock on
    // reliably, especially under glare, reflections, or at an angle.
    margin: 4,
    width: pxSize * dpr,
    color: {
      dark: PALETTE.qrDark,
      light: PALETTE.qrLight,
    },
  });
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  return canvas;
}

/* ---------- 3D voxel scene (on click) ---------- */

class VoxelScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  // Plain performance.now() timer. THREE.Clock was deprecated in recent
  // three.js; the replacement (THREE.Timer) is still in examples/ and not
  // API-stable. We only need elapsed seconds since setActive(true).
  private clockStart = 0;
  private rafId = 0;
  private resizeObserver: ResizeObserver;
  private disposers: Array<() => void> = [];
  private canvas: HTMLCanvasElement;

  private orbitAngle = Math.PI * 0.22;
  private pivot: THREE.Group;
  private leafCanopy: THREE.InstancedMesh[] = [];
  private leafBasePositions: THREE.Vector3[][] = [];

  private active = false;
  private introStart = 0;
  private worldHalf: number;

  private disposed = false;

  constructor(container: HTMLElement, matrix: QrMatrix, size: number) {
    this.worldHalf = matrix.size * 0.5 + 2.5;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(size, size);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap was deprecated in three.js 0.180+; PCFShadowMap is the
    // currently-supported replacement (the runtime silently downgrades anyway).
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.canvas = this.renderer.domElement;
    this.canvas.className =
      'block absolute inset-0 w-full h-full rounded-3xl opacity-0 transition-opacity duration-500';
    container.appendChild(this.canvas);
    // Clicking the 3D canvas also dismisses back to the QR — quick exit.
    this.canvas.addEventListener('click', () => {
      container.dispatchEvent(new CustomEvent('clutch:deactivate-3d'));
    });

    // --- scene + camera ---
    this.scene = new THREE.Scene();
    this.scene.background = null;
    const camSize = this.worldHalf * 1.22;
    this.camera = new THREE.OrthographicCamera(-camSize, camSize, camSize, -camSize, 0.1, 300);
    this.camera.position.set(32, 34, 32);
    this.camera.lookAt(0, 0, 0);

    // --- lighting ---
    this.scene.add(new THREE.AmbientLight(0xfff8ec, 0.75));
    this.scene.add(new THREE.HemisphereLight(0xfff0d8, 0xdfe9b6, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(18, 36, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const shadowHalf = matrix.size * 0.8;
    sun.shadow.camera.left = -shadowHalf;
    sun.shadow.camera.right = shadowHalf;
    sun.shadow.camera.top = shadowHalf;
    sun.shadow.camera.bottom = -shadowHalf;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this.buildBasePlate(matrix);
    this.buildTree(matrix);

    this.resizeObserver = new ResizeObserver(() => this.onResize(container));
    this.resizeObserver.observe(container);

    this.tick = this.tick.bind(this);
    // Start paused; wait for setActive(true)
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    if (active) {
      this.canvas.classList.remove('opacity-0');
      this.introStart = performance.now();
      this.clockStart = this.introStart;
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.canvas.classList.add('opacity-0');
      cancelAnimationFrame(this.rafId);
    }
  }

  // ---------- base plate ----------

  private buildBasePlate(matrix: QrMatrix): void {
    const { size, data } = matrix;

    // Warm earth side slab
    const dirtGeom = new THREE.BoxGeometry(size, 0.85, size);
    const dirtMat = new THREE.MeshStandardMaterial({
      color: PALETTE.dirtSideHex,
      roughness: 1,
    });
    const dirt = new THREE.Mesh(dirtGeom, dirtMat);
    dirt.position.set(0, -0.48, 0);
    dirt.receiveShadow = true;
    dirt.castShadow = true;
    this.pivot.add(dirt);
    this.disposers.push(() => { dirtGeom.dispose(); dirtMat.dispose(); });

    // Voxel cube with micro-gap
    const BLOCK = 0.96;
    const cubeGeom = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK);
    this.disposers.push(() => cubeGeom.dispose());

    let darkCount = 0;
    let lightCount = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i]) darkCount++;
      else lightCount++;
    }

    // Mint grass — matches 2D light cells
    const grassMat = new THREE.MeshStandardMaterial({
      color: PALETTE.grassTopHex,
      roughness: 0.95,
    });
    const grassMesh = new THREE.InstancedMesh(cubeGeom, grassMat, lightCount);
    grassMesh.castShadow = true;
    grassMesh.receiveShadow = true;
    this.disposers.push(() => grassMat.dispose());

    // Cherry-pink dark cells — matches 2D dark cells
    const darkMat = new THREE.MeshStandardMaterial({
      color: PALETTE.darkCellHex,
      roughness: 0.85,
    });
    const darkMesh = new THREE.InstancedMesh(cubeGeom, darkMat, darkCount);
    darkMesh.castShadow = true;
    darkMesh.receiveShadow = true;
    this.disposers.push(() => darkMat.dispose());

    const tmp = new THREE.Object3D();
    let gi = 0;
    let di = 0;
    const offset = -size / 2 + 0.5;

    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const bit = data[z * size + x];
        const wx = x + offset;
        const wz = z + offset;
        if (bit) {
          tmp.position.set(wx, 0.18, wz);
          tmp.scale.set(1, 1, 1);
          tmp.rotation.set(0, 0, 0);
          tmp.updateMatrix();
          darkMesh.setMatrixAt(di++, tmp.matrix);
        } else {
          const h = 0.98 + pseudoRandom(x * 7 + z * 13) * 0.04;
          tmp.position.set(wx, 0.30, wz);
          tmp.scale.set(1, h, 1);
          tmp.updateMatrix();
          grassMesh.setMatrixAt(gi++, tmp.matrix);
        }
      }
    }
    grassMesh.instanceMatrix.needsUpdate = true;
    darkMesh.instanceMatrix.needsUpdate = true;
    this.pivot.add(grassMesh);
    this.pivot.add(darkMesh);
  }

  // ---------- tree ----------

  private buildTree(matrix: QrMatrix): void {
    const BLOCK = 0.96;
    const cubeGeom = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK);
    this.disposers.push(() => cubeGeom.dispose());

    const trunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.trunkDarkHex, roughness: 1 });
    const trunkMatLight = new THREE.MeshStandardMaterial({ color: PALETTE.trunkMidHex, roughness: 1 });
    this.disposers.push(() => { trunkMat.dispose(); trunkMatLight.dispose(); });

    const trunkHeight = 3;
    for (let i = 0; i < trunkHeight; i++) {
      const block = new THREE.Mesh(cubeGeom, i === trunkHeight - 1 ? trunkMatLight : trunkMat);
      block.position.set(0, 1.0 + i, 0);
      block.castShadow = true;
      block.receiveShadow = true;
      this.pivot.add(block);
    }

    const canopyCentre = new THREE.Vector3(0, trunkHeight + 2.2, 0);
    const radius = Math.min(4.8, matrix.size * 0.15);

    const blocksA: THREE.Vector3[] = [];
    const blocksB: THREE.Vector3[] = [];
    const blocksC: THREE.Vector3[] = [];
    const blocksD: THREE.Vector3[] = [];

    const R = Math.ceil(radius) + 1;
    for (let dx = -R; dx <= R; dx++) {
      for (let dy = -R; dy <= R; dy++) {
        for (let dz = -R; dz <= R; dz++) {
          const yf = dy * 1.35;
          const d = Math.sqrt(dx * dx + yf * yf + dz * dz);
          if (d > radius) continue;
          const jitter = pseudoRandom(dx * 31 + dy * 17 + dz * 7);
          if (d > radius - 0.5 && jitter < 0.35) continue;
          if (d < radius - 2.0 && jitter < 0.45) continue;

          const pos = new THREE.Vector3(
            canopyCentre.x + dx,
            canopyCentre.y + dy,
            canopyCentre.z + dz,
          );
          const bucket = pseudoRandom(dx + dy * 91 + dz * 17);
          if (bucket < 0.06) blocksD.push(pos);
          else if (bucket < 0.14) blocksC.push(pos);
          else if (bucket < 0.45) blocksB.push(pos);
          else blocksA.push(pos);
        }
      }
    }

    this.addLeafInstances(cubeGeom, PALETTE.leavesAHex, blocksA);
    this.addLeafInstances(cubeGeom, PALETTE.leavesBHex, blocksB);
    this.addLeafInstances(cubeGeom, PALETTE.leavesCHex, blocksC);
    this.addLeafInstances(cubeGeom, PALETTE.leavesDHex, blocksD);
  }

  private addLeafInstances(geom: THREE.BoxGeometry, color: number, positions: THREE.Vector3[]): void {
    if (positions.length === 0) return;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const mesh = new THREE.InstancedMesh(geom, mat, positions.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const tmp = new THREE.Object3D();
    for (let i = 0; i < positions.length; i++) {
      tmp.position.copy(positions[i]!);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.pivot.add(mesh);
    this.leafCanopy.push(mesh);
    this.leafBasePositions.push(positions);
    this.disposers.push(() => mat.dispose());
  }

  // ---------- loop ----------

  private tick(): void {
    if (this.disposed || !this.active) return;
    const now = performance.now();
    const t = (now - this.clockStart) / 1000;

    const INTRO_MS = 900;
    const introT = Math.min(1, (now - this.introStart) / INTRO_MS);
    const introEase = easeOutCubic(introT);

    this.orbitAngle += 0.0014 * introEase;
    this.pivot.rotation.y = this.orbitAngle;
    this.pivot.scale.setScalar(0.88 + 0.12 * introEase);
    this.pivot.position.y = (1 - introEase) * -4;

    const tmp = new THREE.Object3D();
    for (let mi = 0; mi < this.leafCanopy.length; mi++) {
      const mesh = this.leafCanopy[mi]!;
      const positions = this.leafBasePositions[mi]!;
      for (let i = 0; i < positions.length; i++) {
        const p = positions[i]!;
        const phase = p.x * 0.6 + p.z * 0.7;
        const sway = Math.sin(t * 1.05 + phase) * 0.05;
        const lift = Math.cos(t * 0.85 + phase * 0.4) * 0.03;
        tmp.position.set(p.x + sway, p.y + lift, p.z + sway * 0.5);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.tick);
  }

  private onResize(container: HTMLElement): void {
    const w = container.clientWidth;
    if (w <= 0) return;
    this.renderer.setSize(w, w, false);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active = false;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    for (const d of this.disposers) d();
    for (const m of this.leafCanopy) m.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        obj.geometry?.dispose?.();
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}

/* ---------- helpers ---------- */

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch { return false; }
}

function pseudoRandom(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
