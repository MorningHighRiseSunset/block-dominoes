import * as THREE from 'three';

export const dominoMaterials = {
  face: new THREE.MeshPhysicalMaterial({
    color: 0xd4c4a8,
    roughness: 0.42,
    metalness: 0.02,
    clearcoat: 0.45,
    clearcoatRoughness: 0.32,
  }),
  back: new THREE.MeshPhysicalMaterial({
    color: 0x4a1520,
    roughness: 0.48,
    metalness: 0.06,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
  }),
  pip: new THREE.MeshStandardMaterial({
    color: 0x1a1612,
    roughness: 0.85,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }),
  divider: new THREE.MeshStandardMaterial({
    color: 0x8b7355,
    roughness: 0.6,
  }),
};

let backLabelTexture: THREE.CanvasTexture | null = null;

export function getDominoBackTexture(): THREE.CanvasTexture {
  if (backLabelTexture) return backLabelTexture;

  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#6e2430');
  g.addColorStop(0.5, '#521820');
  g.addColorStop(1, '#3d1018');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,220,180,0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, h / 2);
  ctx.lineTo(w - 12, h / 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(240, 228, 200, 0.92)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.fillText('?', w / 2, h * 0.27);
  ctx.fillText('?', w / 2, h * 0.73);

  backLabelTexture = new THREE.CanvasTexture(canvas);
  backLabelTexture.colorSpace = THREE.SRGBColorSpace;
  return backLabelTexture;
}

export function makeSlateFeltTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const rad = ctx.createRadialGradient(cx, cx, 10, cx, cx, size * 0.75);
  rad.addColorStop(0, '#4a5568');
  rad.addColorStop(0.6, '#3d4654');
  rad.addColorStop(1, '#2d3440');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.5, 2.5);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeFeltTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const rad = ctx.createRadialGradient(cx, cx, 20, cx, cx, size * 0.72);
  rad.addColorStop(0, '#1f7a4f');
  rad.addColorStop(0.55, '#166b42');
  rad.addColorStop(1, '#0f4a2e');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeWoodTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2a1810';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 48; i++) {
    const y = (i / 48) * size;
    const shade = 35 + Math.random() * 40;
    ctx.fillStyle = `rgb(${shade + 40},${shade + 18},${shade})`;
    ctx.fillRect(0, y, size, size / 48 + 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
