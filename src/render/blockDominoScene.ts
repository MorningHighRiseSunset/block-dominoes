import * as THREE from 'three';
import {
  type BlockDominoesState,
  type BlockMove,
  type Player,
} from '../game/blockDominoes';
import { buildPlaySurface, DOMINO_LENGTH, WOOD_COLOR } from './boardGrid';
import { TILE_W } from './dominoMesh';
import { layoutChain } from './chainLayout';
import {
  createDominoBack,
  createDominoMesh,
  disposeGroup,
  DOMINO_MAT,
  TILE_H,
  updateDominoFace,
} from './dominoMesh';
import { makeWoodTexture } from './materials';
import { buildPlacementSlots, findSlotAt, type PlacementSlot } from './placementSlots';

const TABLE_SURFACE_Y = 0.04;
const TILE_LIFT = 0.08;
/** +Z = bottom of screen (your hand). −Z = top (CPU). */
const PLAYER_HAND_Z = 3.35;
const CPU_HAND_Z = -3.35;
const CAMERA_FOV = 40;
const LOOK_AT = new THREE.Vector3(0, 0, 0.5);

interface DropAnim {
  mesh: THREE.Group;
  baseY: number;
  t: number;
  duration: number;
}

interface DragState {
  handIndex: number;
  mesh: THREE.Group;
  homeX: number;
  homeY: number;
  homeZ: number;
}

export class BlockDominoScene {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private readonly tableRoot = new THREE.Group();
  private readonly chainRoot = new THREE.Group();
  private readonly handsRoot = new THREE.Group();
  private readonly highlightsRoot = new THREE.Group();
  private readonly cellHighlights = new Map<string, THREE.Mesh>();
  private readonly handMeshes = new Map<string, THREE.Group>();
  private readonly chainMeshes: THREE.Group[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly clock = new THREE.Clock();
  private readonly dropAnims: DropAnim[] = [];
  private readonly dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TABLE_SURFACE_Y + TILE_LIFT));
  private readonly hitPoint = new THREE.Vector3();
  private placementListener: ((player: Player) => void) | null = null;
  private dropListener: ((move: BlockMove) => void) | null = null;
  private drag: DragState | null = null;
  private dragGhost: THREE.Group | null = null;
  private currentLegal: BlockMove[] = [];
  private currentSlots: PlacementSlot[] = [];
  private interactive = false;
  private syncedState: BlockDominoesState | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2433);
    this.scene.fog = new THREE.FogExp2(0x1a2433, 0.022);

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 80);
    this.updateCamera();

    this.scene.add(new THREE.HemisphereLight(0xe8eef8, 0x4a5568, 0.55));
    this.scene.add(new THREE.AmbientLight(0xf0f4fa, 0.36));

    const key = new THREE.DirectionalLight(0xfff8ee, 1.1);
    key.position.set(2, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = 8;
    key.shadow.camera.left = -sc;
    key.shadow.camera.right = sc;
    key.shadow.camera.top = sc;
    key.shadow.camera.bottom = -sc;
    this.scene.add(key);

    this.buildTable();
    this.scene.add(this.tableRoot);
    this.scene.add(this.chainRoot);
    this.scene.add(this.handsRoot);
    this.scene.add(this.highlightsRoot);
    this.bindEvents();
    this.resize();
  }

  private buildTable() {
    const wood = makeWoodTexture();
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.28, 8),
      new THREE.MeshStandardMaterial({ map: wood, color: WOOD_COLOR, roughness: 0.62 }),
    );
    table.position.y = -0.14;
    table.receiveShadow = true;
    this.tableRoot.add(table);

    this.tableRoot.add(buildPlaySurface(11.2, 6.4, TABLE_SURFACE_Y));
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private updateCamera() {
    this.camera.position.set(0, 10.5, 7.2);
    this.camera.lookAt(LOOK_AT);
  }

  setPlacementListener(fn: ((player: Player) => void) | null) {
    this.placementListener = fn;
  }

  setDropListener(fn: ((move: BlockMove) => void) | null) {
    this.dropListener = fn;
  }

  render() {
    this.updateDropAnims(this.clock.getDelta());
    this.renderer.render(this.scene, this.camera);
  }

  private updateDropAnims(dt: number) {
    for (let i = this.dropAnims.length - 1; i >= 0; i--) {
      const a = this.dropAnims[i];
      a.t += dt;
      const u = Math.min(1, a.t / a.duration);
      const ease = 1 - (1 - u) ** 3;
      a.mesh.position.y = a.baseY + (1 - ease) * 0.35;
      if (u >= 1) {
        a.mesh.position.y = a.baseY;
        this.dropAnims.splice(i, 1);
      }
    }
  }

  sync(state: BlockDominoesState, legal: BlockMove[], interactive: boolean) {
    this.syncedState = state;
    this.currentLegal = legal;
    this.interactive = interactive;
    if (!this.drag) {
      this.currentSlots = buildPlacementSlots(state, legal, null);
    }
    this.rebuildChain(state);
    this.rebuildHands(state, legal, interactive);
    if (!this.drag) {
      this.updateCellHighlights(state, legal, null);
    }
  }

  private rebuildChain(state: BlockDominoesState) {
    while (this.chainMeshes.length > state.chain.length) {
      const g = this.chainMeshes.pop()!;
      this.chainRoot.remove(g);
      disposeGroup(g);
    }

    const n = state.chain.length;
    const placements = layoutChain(n);
    const yBase = TABLE_SURFACE_Y + TILE_LIFT + TILE_H * 0.5;

    for (let i = 0; i < n; i++) {
      const tile = state.chain[i];
      const { x, z, rotationY } = placements[i];
      const y = yBase + i * 0.003;
      if (i < this.chainMeshes.length) {
        const g = this.chainMeshes[i];
        g.position.set(x, y, z);
        g.rotation.set(0, rotationY, 0);
        updateDominoFace(g, tile.leftPip, tile.rightPip);
      } else {
        const g = createDominoMesh(tile.leftPip, tile.rightPip, 0, false);
        g.position.set(x, y, z);
        g.rotation.set(0, rotationY, 0);
        this.chainRoot.add(g);
        this.chainMeshes.push(g);
        const pl = state.lastMove?.player ?? 0;
        this.animateDrop(g, pl);
      }
    }
  }

  private rebuildHands(
    state: BlockDominoesState,
    legal: BlockMove[],
    interactive: boolean,
  ) {
    for (const g of this.handMeshes.values()) {
      if (this.drag?.mesh === g) continue;
      this.handsRoot.remove(g);
      disposeGroup(g);
    }
    if (!this.drag) this.handMeshes.clear();

    const legalIndices = new Set(
      interactive ? legal.map((m) => m.handIndex) : [],
    );

    for (const player of [0, 1] as Player[]) {
      const hand = state.hands[player];
      const z = player === 0 ? PLAYER_HAND_Z : CPU_HAND_Z;
      const spread = Math.min(0.56, 5.2 / Math.max(hand.length, 1));
      const startX = -((hand.length - 1) * spread) / 2;

      for (let i = 0; i < hand.length; i++) {
        const d = hand[i];
        const key = `${player}-${d.id}`;
        if (this.drag && player === 0 && this.drag.handIndex === i) continue;

        const showFace = player === 0;
        const g = showFace
          ? createDominoMesh(d.low, d.high, player, true)
          : createDominoBack(player);
        g.userData = { kind: 'hand', player, handIndex: i };

        const handY = TABLE_SURFACE_Y + TILE_H * 0.5 + 0.32;
        g.position.set(startX + i * spread, handY, z);
        g.rotation.set(player === 0 ? -0.55 : 0.55, 0, 0);

        const hl = g.getObjectByName('highlight') as THREE.Mesh | undefined;
        if (hl) {
          hl.visible = interactive && player === 0 && legalIndices.has(i);
        }

        this.handsRoot.add(g);
        this.handMeshes.set(key, g);
      }
    }
  }

  private updateCellHighlights(
    state: BlockDominoesState,
    legal: BlockMove[],
    handIndex: number | null,
  ) {
    for (const mesh of this.cellHighlights.values()) {
      this.highlightsRoot.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.cellHighlights.clear();

    const slots = buildPlacementSlots(state, legal, handIndex);
    const seen = new Set<string>();

    for (const slot of slots) {
      const key = `${slot.move.handIndex}:${slot.move.end}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const active = handIndex !== null;
      const mat = active
        ? DOMINO_MAT.placementHighlight.clone()
        : DOMINO_MAT.slotHint.clone();
      const alongX = Math.abs(Math.cos(slot.rotationY)) > 0.5;
      const w = alongX ? DOMINO_LENGTH : TILE_W;
      const d = alongX ? TILE_W : DOMINO_LENGTH;
      const slotY = TABLE_SURFACE_Y + TILE_LIFT + TILE_H * 0.5;
      const hi = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, TILE_H * 0.4, d * 0.92), mat);
      hi.position.set(slot.x, slotY, slot.z);
      hi.rotation.y = slot.rotationY;
      this.highlightsRoot.add(hi);
      this.cellHighlights.set(key, hi);
    }
  }

  private animateDrop(mesh: THREE.Group, player: Player) {
    const baseY = mesh.position.y;
    mesh.position.y = baseY + 0.35;
    this.dropAnims.push({ mesh, baseY, t: 0, duration: 0.28 });
    this.placementListener?.(player);
  }

  private raycastBoard(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray.intersectPlane(this.dragPlane, this.hitPoint)
      ? this.hitPoint.clone()
      : null;
  }

  private pickHand(clientX: number, clientY: number): number | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const handGroups = [...this.handMeshes.values()].filter(
      (g) => g.parent === this.handsRoot,
    );
    const hits = this.raycaster.intersectObjects(handGroups, true);
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        if (obj.userData?.kind === 'hand' && obj.userData.player === 0) {
          return obj.userData.handIndex as number;
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  private startDrag(handIndex: number) {
    if (!this.syncedState) return;
    const state = this.syncedState;
    const hand = state.hands[0];
    const d = hand[handIndex];
    const key = `0-${d.id}`;
    const mesh = this.handMeshes.get(key);
    if (!mesh) return;

    const domino = hand[handIndex];
    updateDominoFace(mesh, domino.low, domino.high);

    this.drag = {
      handIndex,
      mesh,
      homeX: mesh.position.x,
      homeY: mesh.position.y,
      homeZ: mesh.position.z,
    };

    this.currentSlots = buildPlacementSlots(state, this.currentLegal, handIndex);
    this.updateCellHighlights(state, this.currentLegal, handIndex);

    mesh.position.y = TABLE_SURFACE_Y + TILE_LIFT + TILE_H * 0.5 + 0.15;
    this.canvas.style.cursor = 'grabbing';
  }

  private updateDrag(clientX: number, clientY: number) {
    if (!this.drag) return;
    const pt = this.raycastBoard(clientX, clientY);
    if (!pt) return;
    this.drag.mesh.position.set(pt.x, TABLE_SURFACE_Y + TILE_LIFT + TILE_H * 0.5 + 0.15, pt.z);

    const slot = findSlotAt(this.currentSlots, pt.x, pt.z, this.drag.handIndex, 1.1);
    if (slot && !this.dragGhost && this.syncedState) {
      const tile = this.syncedState.hands[0][this.drag.handIndex];
      this.dragGhost = createDominoMesh(tile.low, tile.high, 0, false, {
        highlight: false,
        outline: false,
      });
      this.tintGhost(this.dragGhost);
      this.highlightsRoot.add(this.dragGhost);
    }
    if (this.dragGhost && this.syncedState) {
      if (slot) {
        const tile = this.syncedState.hands[0][this.drag.handIndex];
        const endPip = slot.move.end === 'left' ? this.syncedState.leftEnd! : this.syncedState.rightEnd!;
        let leftPip = tile.low;
        let rightPip = tile.high;
        if (this.syncedState.chain.length > 0) {
          if (slot.move.end === 'left') {
            rightPip = tile.low === endPip ? tile.high : tile.low;
            leftPip = endPip;
          } else {
            leftPip = tile.low === endPip ? tile.high : tile.low;
            rightPip = endPip;
          }
        }
        updateDominoFace(this.dragGhost, leftPip, rightPip);
        this.dragGhost.visible = true;
        this.dragGhost.position.set(
          slot.x,
          TABLE_SURFACE_Y + TILE_LIFT + TILE_H * 0.5,
          slot.z,
        );
        this.dragGhost.rotation.set(0, slot.rotationY, 0);
      } else {
        this.dragGhost.visible = false;
      }
    }
  }

  private endDrag(clientX: number, clientY: number) {
    if (!this.drag) return;

    const { handIndex, mesh, homeX, homeY, homeZ } = this.drag;
    const pt = this.raycastBoard(clientX, clientY);
    const slot = pt
      ? findSlotAt(this.currentSlots, pt.x, pt.z, handIndex)
      : null;

    if (slot) {
      const d = this.syncedState!.hands[0][handIndex];
      this.handsRoot.remove(mesh);
      disposeGroup(mesh);
      this.handMeshes.delete(`0-${d.id}`);
      this.clearDragGhost();
      this.drag = null;
      this.canvas.style.cursor = 'default';
      this.dropListener?.(slot.move);
      return;
    }

    this.clearDragGhost();
    mesh.position.set(homeX, homeY, homeZ);
    this.drag = null;
    this.canvas.style.cursor = 'default';
    if (this.syncedState) {
      this.updateCellHighlights(this.syncedState, this.currentLegal, null);
    }
  }

  private clearDragGhost() {
    if (this.dragGhost) {
      this.highlightsRoot.remove(this.dragGhost);
      disposeGroup(this.dragGhost);
      this.dragGhost = null;
    }
  }

  private tintGhost(ghost: THREE.Group) {
    ghost.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = child.material.clone();
        (child.material as THREE.Material).transparent = true;
        (child.material as THREE.Material).opacity = 0.55;
        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissive = new THREE.Color(0x38bdf8);
          child.material.emissiveIntensity = 0.35;
        }
      }
    });
  }

  private bindEvents() {
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.interactive || e.button !== 0 || this.drag) return;
      const handIndex = this.pickHand(e.clientX, e.clientY);
      if (handIndex === null) return;
      const canPlay = this.currentLegal.some((m) => m.handIndex === handIndex);
      if (!canPlay) return;
      this.startDrag(handIndex);
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.interactive || !this.drag) return;
      this.updateDrag(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('pointerup', (e) => {
      if (this.drag) {
        this.endDrag(e.clientX, e.clientY);
      }
      try {
        (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    });
  }
}
