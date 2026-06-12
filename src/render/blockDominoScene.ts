import * as THREE from 'three';
import {
  type BlockDominoesState,
  type BlockMove,
  type Player,
} from '../game/blockDominoes';
import { buildPlaySurface, WOOD_COLOR } from './boardGrid';
import { TILE_W, TILE_D } from './dominoMesh';
import { layoutChain } from './chainLayout';
import {
  createDominoBack,
  createDominoMesh,
  disposeGroup,
  TILE_H,
  updateDominoFace,
} from './dominoMesh';
import { makeWoodTexture } from './materials';
import { buildPlacementSlots } from './placementSlots';

const TABLE_SURFACE_Y = 0.04;
const TILE_LIFT = 0.08;
const TABLE_DEPTH = 12;
const FELT_DEPTH = 10.4;
/** Wood rail beyond the felt — player rack sits here (+Z = bottom of screen). */
const PLAYER_HAND_Z = FELT_DEPTH / 2 + (TABLE_DEPTH - FELT_DEPTH) / 4;
const CPU_HAND_Z = -PLAYER_HAND_Z;
const HAND_SURFACE_Y = TABLE_SURFACE_Y + 0.04;
const CAMERA_FOV = 45;
const LOOK_AT = new THREE.Vector3(0, 0, 0.5);

interface ScreenRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface DropAnim {
  mesh: THREE.Group;
  baseY: number;
  t: number;
  duration: number;
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
  private readonly cellHighlights = new Map<string, THREE.Group>();
  private readonly handMeshes = new Map<string, THREE.Group>();
  private readonly chainMeshes: THREE.Group[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly clock = new THREE.Clock();
  private readonly dropAnims: DropAnim[] = [];
  private readonly playerRack = new THREE.Group();
  private placementListener: ((player: Player) => void) | null = null;
  private dropListener: ((move: BlockMove) => void) | null = null;
  private currentLegal: BlockMove[] = [];
  private interactive = false;
  private syncedState: BlockDominoesState | null = null;
  private targetCameraX = 0;
  private currentCameraX = 0;
  private selectedHandIndex: number | null = null;
  private isDragging = false;
  private dragHandIndex: number | null = null;
  private dragMesh: THREE.Group | null = null;

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
    this.scene.background = new THREE.Color(0x2a1810);
    this.scene.fog = new THREE.FogExp2(0x2a1810, 0.022);

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 80);
    this.updateCamera();

    this.scene.add(new THREE.HemisphereLight(0xffeedd, 0x8b7355, 0.55));
    this.scene.add(new THREE.AmbientLight(0xfff0e0, 0.36));

    const key = new THREE.DirectionalLight(0xffe8cc, 1.1);
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
      new THREE.BoxGeometry(20, 0.28, 12),
      new THREE.MeshStandardMaterial({ map: wood, color: WOOD_COLOR, roughness: 0.62 }),
    );
    table.position.y = -0.14;
    table.receiveShadow = true;
    this.tableRoot.add(table);

    this.tableRoot.add(buildPlaySurface(17.2, FELT_DEPTH, TABLE_SURFACE_Y));
    this.buildRacks();
  }

  private buildRacks() {
    const wood = makeWoodTexture();
    const rackMat = new THREE.MeshStandardMaterial({
      map: wood,
      color: WOOD_COLOR,
      roughness: 0.65,
    });

    for (const z of [PLAYER_HAND_Z, CPU_HAND_Z]) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.05, 0.9), rackMat);
      rack.position.set(0, HAND_SURFACE_Y - 0.025, z);
      rack.receiveShadow = true;
      this.playerRack.add(rack);
    }

    this.tableRoot.add(this.playerRack);
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.updateCameraForScreenSize(w, h);
  }

  private updateCamera() {
    this.camera.position.set(0, 10.5, 7.2);
    this.camera.lookAt(LOOK_AT);
  }

  private updateCameraForScreenSize(width: number, height: number) {
    const isMobile = width < 768 || height < 768;
    const isPortrait = height > width;

    // Position camera to see the larger board (17.2 x 10.4)
    // With FOV 45, at Z=14 we can see ~11.5 units height, which covers the board depth of 10.4 with margin
    let baseY = 15;
    let baseZ = 14;

    if (isMobile) {
      if (isPortrait) {
        // Portrait mobile: move camera higher to see full width in portrait
        baseY = 18;
        baseZ = 12;
      } else {
        // Landscape mobile: similar to desktop but slightly adjusted
        baseY = 15;
        baseZ = 13;
      }
    }

    // Apply horizontal pan (translation only, no tilt)
    this.camera.position.set(this.currentCameraX, baseY, baseZ);
    this.camera.lookAt(this.currentCameraX, LOOK_AT.y, LOOK_AT.z);
  }

  setPlacementListener(fn: ((player: Player) => void) | null) {
    this.placementListener = fn;
  }

  setDropListener(fn: ((move: BlockMove) => void) | null) {
    this.dropListener = fn;
  }

  render() {
    const dt = this.clock.getDelta();
    this.updateDropAnims(dt);
    this.updateCameraPosition(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updateCameraPosition(dt: number) {
    // Smoothly interpolate current X to target X (pure pan, no tilt)
    const lerpFactor = 3.0;
    this.currentCameraX += (this.targetCameraX - this.currentCameraX) * lerpFactor * dt;
    this.updateCameraForScreenSize(this.canvas.clientWidth, this.canvas.clientHeight);
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
    this.rebuildChain(state);
    this.rebuildHands(state, legal, interactive);
    this.updateCellHighlights(state, legal, this.selectedHandIndex);
    this.updateTargetCameraX(state);
  }

  private updateTargetCameraX(state: BlockDominoesState) {
    if (state.chain.length === 0) {
      this.targetCameraX = 0;
      return;
    }

    // Calculate the center of the chain
    const placements = layoutChain(state.chain, state.snakeTurn);
    let sumX = 0;
    for (const p of placements) {
      sumX += p.x;
    }
    const centerX = sumX / placements.length;

    // Set target X to follow chain center, but limit the range
    const maxOffset = 3;
    this.targetCameraX = Math.max(-maxOffset, Math.min(maxOffset, centerX * 0.5));
  }

  private rebuildChain(state: BlockDominoesState) {
    while (this.chainMeshes.length > state.chain.length) {
      const g = this.chainMeshes.pop()!;
      this.chainRoot.remove(g);
      disposeGroup(g);
    }

    const n = state.chain.length;
    const placements = layoutChain(state.chain, state.snakeTurn);
    const yBase = TABLE_SURFACE_Y + TILE_LIFT + TILE_H * 0.5;

    for (let i = 0; i < n; i++) {
      const tile = state.chain[i];
      const { x, z, rotationY } = placements[i];
      const y = yBase;
      // Determine if the domino needs to be visually flipped based on orientation
      // leftPip/rightPip indicate which pip is at which end of the chain
      // If leftPip != domino.low, the domino needs to be flipped
      const needsFlip = tile.leftPip !== tile.domino.low;
      const renderLeft = needsFlip ? tile.domino.high : tile.domino.low;
      const renderRight = needsFlip ? tile.domino.low : tile.domino.high;
      if (i < this.chainMeshes.length) {
        const g = this.chainMeshes[i];
        g.position.set(x, y, z);
        g.rotation.set(0, rotationY, 0);
        updateDominoFace(g, renderLeft, renderRight);
      } else {
        const g = createDominoMesh(renderLeft, renderRight, 0, false);
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
      this.handsRoot.remove(g);
      disposeGroup(g);
    }
    this.handMeshes.clear();

    const legalIndices = new Set(
      interactive ? legal.map((m) => m.handIndex) : [],
    );

    for (const player of [0, 1] as Player[]) {
      const hand = state.hands[player];
      const z = player === 0 ? PLAYER_HAND_Z : CPU_HAND_Z;
      const spread = Math.min(1.02, 6.6 / Math.max(hand.length, 1));
      const startX = -((hand.length - 1) * spread) / 2;

      for (let i = 0; i < hand.length; i++) {
        const d = hand[i];
        const key = `${player}-${d.id}`;

        const showFace = player === 0;
        const g = showFace
          ? createDominoMesh(d.low, d.high, player, true)
          : createDominoBack(player);
        g.userData = { kind: 'hand', player, handIndex: i };

        const handY = HAND_SURFACE_Y + TILE_H * 0.5;
        g.position.set(startX + i * spread, handY, z);
        // Lay flat on the rack with long edge along the row
        g.rotation.set(0, Math.PI / 2, 0);

        g.traverse((child) => {
          if (child instanceof THREE.Mesh && child.name !== 'handHit') {
            child.raycast = () => {};
          }
        });

        const hitPad = new THREE.Mesh(
          new THREE.PlaneGeometry(TILE_D * 1.04, TILE_W * 1.12),
          new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
        );
        hitPad.rotation.x = -Math.PI / 2;
        hitPad.position.y = TILE_H * 0.5 + 0.004;
        hitPad.name = 'handHit';
        hitPad.userData = { kind: 'hand', player, handIndex: i };
        g.add(hitPad);

        const hl = g.getObjectByName('highlight') as THREE.Mesh | undefined;
        if (hl) {
          const isSelected = interactive && player === 0 && this.selectedHandIndex === i;
          const isPlayable = interactive && player === 0 && legalIndices.has(i);
          hl.visible = isSelected || isPlayable;
          // Change color for selected domino
          if (isSelected) {
            (hl.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8); // Blue for selected
          } else {
            (hl.material as THREE.MeshBasicMaterial).color.setHex(0x2dd4bf); // Teal for playable
          }
        }

        const outline = g.userData.outline as THREE.LineSegments | undefined;
        if (outline) {
          outline.visible = interactive && player === 0 && this.selectedHandIndex === i;
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
    for (const ghost of this.cellHighlights.values()) {
      this.highlightsRoot.remove(ghost);
      disposeGroup(ghost);
    }
    this.cellHighlights.clear();

    const slots = buildPlacementSlots(state, legal, handIndex);
    const seen = new Set<string>();

    for (const slot of slots) {
      const key = `${slot.move.handIndex}:${slot.move.end}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Create a simple blue box instead of a full domino with pips
      const ghost = new THREE.Group();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_W, TILE_H, TILE_D),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        }),
      );
      ghost.add(box);
      
      const slotY = TABLE_SURFACE_Y + TILE_LIFT + TILE_H * 0.5;
      ghost.position.set(slot.x, slotY, slot.z);
      ghost.rotation.y = slot.rotationY;
      ghost.userData = {
        kind: 'slot',
        handIndex: slot.move.handIndex,
        end: slot.move.end,
      };
      this.highlightsRoot.add(ghost);
      this.cellHighlights.set(key, ghost);
    }
  }

  private animateDrop(mesh: THREE.Group, player: Player) {
    const baseY = mesh.position.y;
    mesh.position.y = baseY + 0.35;
    this.dropAnims.push({ mesh, baseY, t: 0, duration: 0.28 });
    this.placementListener?.(player);
  }

  private projectHandTileBounds(mesh: THREE.Group, rect: DOMRect): ScreenRect | null {
    const face = mesh.getObjectByName('face') as THREE.Mesh | undefined;
    if (!face) return null;

    face.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(face);
    if (box.isEmpty()) return null;

    const corners = [
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const corner of corners) {
      const projected = corner.clone().project(this.camera);
      const sx = (projected.x * 0.5 + 0.5) * rect.width + rect.left;
      const sy = (-projected.y * 0.5 + 0.5) * rect.height + rect.top;
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
    }

    const pad = 6;
    return {
      minX: minX - pad,
      maxX: maxX + pad,
      minY: minY - pad,
      maxY: maxY + pad,
    };
  }

  private positionDragMesh(clientX: number, clientY: number) {
    if (!this.dragMesh) return;

    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const plane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -(TABLE_SURFACE_Y + TILE_LIFT + TILE_H * 0.5),
    );
    const intersection = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, intersection)) {
      this.dragMesh.position.copy(intersection);
      this.dragMesh.rotation.set(0, Math.PI / 2, 0);
    }
  }

  private pickHand(clientX: number, clientY: number): number | null {
    const rect = this.canvas.getBoundingClientRect();

    // Match clicks to the pip face as it appears on screen
    let bestIndex: number | null = null;
    let bestArea = Infinity;

    for (const [, mesh] of this.handMeshes) {
      if (mesh.parent !== this.handsRoot) continue;
      if (mesh.userData?.player !== 0) continue;

      const bounds = this.projectHandTileBounds(mesh, rect);
      if (!bounds) continue;

      if (
        clientX >= bounds.minX &&
        clientX <= bounds.maxX &&
        clientY >= bounds.minY &&
        clientY <= bounds.maxY
      ) {
        const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
        if (area < bestArea) {
          bestArea = area;
          bestIndex = mesh.userData.handIndex as number;
        }
      }
    }

    return bestIndex;
  }

  private selectTile(handIndex: number) {
    if (!this.syncedState) return;
    
    // Check if this tile is playable
    const canPlay = this.currentLegal.some((m) => m.handIndex === handIndex);
    if (!canPlay) return;

    // Toggle selection
    if (this.selectedHandIndex === handIndex) {
      this.selectedHandIndex = null;
    } else {
      this.selectedHandIndex = handIndex;
    }
    
    // Rebuild to update highlights
    this.rebuildHands(this.syncedState, this.currentLegal, this.interactive);
    this.updateCellHighlights(this.syncedState, this.currentLegal, this.selectedHandIndex);
  }

  private playTile(handIndex: number, end: 'left' | 'right') {
    if (!this.syncedState) return;
    
    // Find the specific move
    const move = this.currentLegal.find((m) => m.handIndex === handIndex && m.end === end);
    if (!move) return;
    
    // Clear selection and play
    this.selectedHandIndex = null;
    this.dropListener?.(move);
  }

  private pickPlacementSlot(clientX: number, clientY: number): { handIndex: number; end: 'left' | 'right' } | null {
    if (this.selectedHandIndex === null || !this.syncedState) return null;

    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const slotGroups = Array.from(this.cellHighlights.values());
    const hits = this.raycaster.intersectObjects(slotGroups, true);

    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        const ud = obj.userData;
        if (ud?.kind === 'slot' && ud.handIndex === this.selectedHandIndex) {
          return { handIndex: ud.handIndex as number, end: ud.end as 'left' | 'right' };
        }
        obj = obj.parent;
      }
    }

    return null;
  }

  private bindEvents() {
    window.addEventListener('resize', () => this.resize());

    const handlePointerDown = (clientX: number, clientY: number) => {
      if (!this.interactive) return;

      // First check if clicking on a placement slot (only when a domino is selected)
      if (this.selectedHandIndex !== null) {
        const slot = this.pickPlacementSlot(clientX, clientY);
        if (slot) {
          this.playTile(slot.handIndex, slot.end);
          return;
        }
      }

      // Check if clicking on a hand domino
      const handIndex = this.pickHand(clientX, clientY);
      if (handIndex !== null) {
        // Check if this tile is playable
        const canPlay = this.currentLegal.some((m) => m.handIndex === handIndex);
        if (canPlay) {
          this.isDragging = true;
          this.dragHandIndex = handIndex;
          this.selectedHandIndex = handIndex;
          this.rebuildHands(this.syncedState!, this.currentLegal, this.interactive);
          this.updateCellHighlights(this.syncedState!, this.currentLegal, this.selectedHandIndex);

          // Create drag mesh (ghost domino)
          if (this.syncedState && this.dragHandIndex !== null) {
            const domino = this.syncedState.hands[0][this.dragHandIndex];
            this.dragMesh = createDominoMesh(domino.low, domino.high, 0, false);
            this.dragMesh.rotation.set(0, Math.PI / 2, 0);
            this.dragMesh.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                const originalMat = child.material;
                if (Array.isArray(originalMat)) {
                  child.material = originalMat.map(m => {
                    const cloned = m.clone();
                    cloned.transparent = true;
                    cloned.opacity = 0.6;
                    return cloned;
                  });
                } else if (originalMat && typeof originalMat.clone === 'function') {
                  const cloned = originalMat.clone();
                  cloned.transparent = true;
                  cloned.opacity = 0.6;
                  child.material = cloned;
                }
              }
            });
            this.scene.add(this.dragMesh);
            this.positionDragMesh(clientX, clientY);
          }
        } else {
          this.selectTile(handIndex);
        }
        return;
      }

      // Clicked elsewhere - deselect
      if (this.selectedHandIndex !== null) {
        this.selectedHandIndex = null;
        this.rebuildHands(this.syncedState!, this.currentLegal, this.interactive);
        this.updateCellHighlights(this.syncedState!, this.currentLegal, null);
      }
    };

    const handlePointerMove = (clientX: number, clientY: number) => {
      if (!this.isDragging || this.dragHandIndex === null) return;
      this.positionDragMesh(clientX, clientY);
    };

    const handlePointerUp = (clientX: number, clientY: number) => {
      if (!this.isDragging || this.dragHandIndex === null) return;

      // Check if dropped on a placement slot
      const slot = this.pickPlacementSlot(clientX, clientY);
      if (slot && slot.handIndex === this.dragHandIndex) {
        this.playTile(slot.handIndex, slot.end);
      }

      // Clean up drag state
      this.isDragging = false;
      this.dragHandIndex = null;
      if (this.dragMesh) {
        this.scene.remove(this.dragMesh);
        disposeGroup(this.dragMesh);
        this.dragMesh = null;
      }
    };

    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => {
      handlePointerDown(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      handlePointerMove(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('mouseup', (e) => {
      handlePointerUp(e.clientX, e.clientY);
    });

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      handlePointerDown(touch.clientX, touch.clientY);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      handlePointerMove(touch.clientX, touch.clientY);
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      handlePointerUp(touch.clientX, touch.clientY);
    }, { passive: false });
  }
}
