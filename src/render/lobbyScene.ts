import * as THREE from 'three';
import type { Pip } from '../game/blockDominoes';
import { buildChessBoard, WOOD_COLOR } from './boardGrid';
import { createDominoMesh } from './dominoMesh';
import { makeWoodTexture } from './materials';

interface FloatTile {
  mesh: THREE.Group;
  base: THREE.Vector3;
  phase: number;
  spin: number;
}

const DECOR: [Pip, Pip][] = [
  [6, 6],
  [5, 3],
  [4, 0],
  [2, 2],
  [6, 1],
  [3, 3],
  [5, 5],
  [0, 4],
];

const LOBBY_CELL = 0.55;
const LOBBY_COLS = 12;
const LOBBY_ROWS = 6;

export class LobbyScene {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly world = new THREE.Group();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly tiles: FloatTile[] = [];
  private readonly clock = new THREE.Clock();
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.world.position.y = -3.2;
    this.scene.add(this.world);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    this.camera.position.set(0, 2.8, 10);
    this.camera.lookAt(0, -2.4, 0);

    this.scene.add(new THREE.HemisphereLight(0xe8eef8, 0x4d6d85, 0.55));
    this.scene.add(new THREE.AmbientLight(0xf0f4fa, 0.35));

    const key = new THREE.DirectionalLight(0xfff8ee, 1.05);
    key.position.set(4, 10, 6);
    key.castShadow = true;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x7a9eb8, 0.35);
    rim.position.set(-5, 3, -4);
    this.scene.add(rim);

    this.buildTable();
    this.buildDecorTiles();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  private buildTable() {
    const wood = makeWoodTexture();
    const boardW = LOBBY_COLS * LOBBY_CELL + 0.6;
    const boardD = LOBBY_ROWS * LOBBY_CELL + 0.6;

    const table = new THREE.Mesh(
      new THREE.BoxGeometry(boardW + 1.2, 0.3, boardD + 1.2),
      new THREE.MeshStandardMaterial({ map: wood, color: WOOD_COLOR, roughness: 0.65 }),
    );
    table.position.y = -0.35;
    table.receiveShadow = true;
    this.world.add(table);

    const board = buildChessBoard(LOBBY_COLS, LOBBY_ROWS, LOBBY_CELL, -0.17, 0.05);
    this.world.add(board);
  }

  private buildDecorTiles() {
    const radius = 3.1;
    DECOR.forEach(([low, high], i) => {
      const angle = (i / DECOR.length) * Math.PI * 2 - Math.PI / 2;
      const mesh = createDominoMesh(low, high, 0, false, { highlight: false, outline: false });
      mesh.traverse((c) => {
        if (c instanceof THREE.Mesh) c.castShadow = true;
      });

      const base = new THREE.Vector3(
        Math.cos(angle) * radius,
        0.15 + (i % 3) * 0.12,
        Math.sin(angle) * radius * 0.65,
      );
      mesh.position.copy(base);
      mesh.rotation.set(-0.2 + (i % 2) * 0.15, angle + Math.PI / 2, (i % 2) * 0.08);

      this.world.add(mesh);
      this.tiles.push({
        mesh,
        base,
        phase: i * 0.7,
        spin: 0.15 + (i % 4) * 0.04,
      });
    });

    const hero = createDominoMesh(6, 6, 0, false, { highlight: false, outline: false });
    hero.position.set(0, 0.55, 0);
    hero.rotation.set(-0.35, 0.4, 0);
    hero.scale.setScalar(1.15);
    hero.traverse((c) => {
      if (c instanceof THREE.Mesh) c.castShadow = true;
    });
    this.world.add(hero);
    this.tiles.push({ mesh: hero, base: hero.position.clone(), phase: 0, spin: 0.08 });
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w < 1 || h < 1) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.tick();
  }

  stop() {
    this.running = false;
  }

  private tick = () => {
    if (!this.running) return;
    const t = this.clock.getElapsedTime();

    for (const tile of this.tiles) {
      const bob = Math.sin(t * 0.9 + tile.phase) * 0.08;
      tile.mesh.position.y = tile.base.y + bob;
      tile.mesh.rotation.y += tile.spin * 0.012;
    }

    this.camera.position.x = Math.sin(t * 0.12) * 0.6;
    this.camera.lookAt(0, -2.2, 0);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.tick);
  };
}
