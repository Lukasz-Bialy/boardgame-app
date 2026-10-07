"use client";

import { useEffect, useRef } from "react";
import type * as ThreeNS from "three";

type Three = typeof ThreeNS;

// Kolory kości: klejnoty zgodne z paletą „papier i sukno” (mosiądz na numerach)
export const DIE_COLORS: Record<number, string> = {
  4: "#3F7A5A",
  6: "#35507A",
  8: "#6B3F7A",
  10: "#7A5A2E",
  12: "#2F6B6B",
  20: "#8E2A24",
};

interface Face {
  centroid: ThreeNS.Vector3;
  quat: ThreeNS.Quaternion; // obrót płaszczyzny numeru: lokalne +Z = normalna ściany, +Y = „góra” cyfry
  size: number;
}

function d10Geometry(T: Three): ThreeNS.BufferGeometry {
  // Trapezoedr pięciokątny: wysokość czubka dobrana tak, by ściany-latawce były płaskie
  const c = Math.cos(Math.PI / 5);
  const a = 0.1;
  const h = (a * (1 + c)) / (1 - c);
  const ring = Array.from({ length: 10 }, (_, i) => {
    const ang = (i * Math.PI) / 5;
    return new T.Vector3(Math.cos(ang), i % 2 === 0 ? a : -a, Math.sin(ang));
  });
  const top = new T.Vector3(0, h, 0);
  const bottom = new T.Vector3(0, -h, 0);
  const tris: ThreeNS.Vector3[][] = [];
  for (let k = 0; k < 5; k++) {
    const u0 = ring[(2 * k) % 10], l1 = ring[(2 * k + 1) % 10], u2 = ring[(2 * k + 2) % 10];
    tris.push([top, u0, l1], [top, l1, u2]);
    const l0 = ring[(2 * k + 1) % 10], u1 = ring[(2 * k + 2) % 10], l2 = ring[(2 * k + 3) % 10];
    tris.push([bottom, l0, u1], [bottom, u1, l2]);
  }
  const pos: number[] = [];
  for (const [p, q, r] of tris) {
    const n = new T.Vector3().subVectors(q, p).cross(new T.Vector3().subVectors(r, p));
    const center = new T.Vector3().add(p).add(q).add(r);
    // Ściany na zewnątrz — odwracamy kolejność, jeśli normalna patrzy do środka
    const ordered = n.dot(center) < 0 ? [p, r, q] : [p, q, r];
    for (const v of ordered) pos.push(v.x, v.y, v.z);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.scale(1.25, 1.25, 1.25);
  g.computeVertexNormals();
  return g;
}

function geometryFor(T: Three, sides: number): ThreeNS.BufferGeometry {
  switch (sides) {
    case 4:
      return new T.TetrahedronGeometry(1.55);
    case 6:
      return new T.BoxGeometry(1.7, 1.7, 1.7).toNonIndexed();
    case 8:
      return new T.OctahedronGeometry(1.4);
    case 10:
      return d10Geometry(T);
    case 12:
      return new T.DodecahedronGeometry(1.4);
    default:
      return new T.IcosahedronGeometry(1.45);
  }
}

// Grupuje trójkąty w ściany po normalnej i wyznacza, gdzie i jak położyć numer
function extractFaces(T: Three, g: ThreeNS.BufferGeometry, sides: number): Face[] {
  const p = g.getAttribute("position");
  const groups: { n: ThreeNS.Vector3; verts: ThreeNS.Vector3[] }[] = [];
  for (let i = 0; i < p.count; i += 3) {
    const a = new T.Vector3().fromBufferAttribute(p, i);
    const b = new T.Vector3().fromBufferAttribute(p, i + 1);
    const c = new T.Vector3().fromBufferAttribute(p, i + 2);
    const n = new T.Vector3().subVectors(b, a).cross(new T.Vector3().subVectors(c, a)).normalize();
    let grp = groups.find((x) => x.n.dot(n) > 0.995);
    if (!grp) groups.push((grp = { n, verts: [] }));
    for (const v of [a, b, c]) if (!grp.verts.some((w) => w.distanceToSquared(v) < 1e-6)) grp.verts.push(v);
  }

  return groups.map(({ n, verts }) => {
    const centroid = verts.reduce((acc, v) => acc.add(v), new T.Vector3()).divideScalar(verts.length);
    // Kierunek „w górę” cyfry: do najdalszego wierzchołka (czubek trójkąta/latawca), na sześcianie do środka krawędzi
    let up: ThreeNS.Vector3;
    if (sides === 6) {
      const axis = Math.abs(n.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(0, 0, 1);
      up = axis.sub(n.clone().multiplyScalar(axis.dot(n))).normalize();
    } else {
      const far = verts.reduce((best, v) => (v.distanceTo(centroid) > best.distanceTo(centroid) ? v : best), verts[0]);
      up = far.clone().sub(centroid).normalize();
    }
    const x = new T.Vector3().crossVectors(up, n).normalize();
    const quat = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, up, n));

    // Promień wpisany ≈ najmniejsza odległość środka od krawędzi (wierzchołki posortowane po kącie)
    const sorted = [...verts].sort((v, w) => {
      const lv = v.clone().sub(centroid), lw = w.clone().sub(centroid);
      return Math.atan2(lv.dot(up), lv.dot(x)) - Math.atan2(lw.dot(up), lw.dot(x));
    });
    let inr = Infinity;
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i], e = sorted[(i + 1) % sorted.length];
      const line = new T.Line3(s, e);
      const closest = line.closestPointToPoint(centroid, true, new T.Vector3());
      inr = Math.min(inr, closest.distanceTo(centroid));
    }
    return { centroid, quat, size: inr * (sides === 10 ? 1.5 : 1.35) };
  });
}

function labelTexture(T: Three, text: string, underline: boolean): ThreeNS.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${text.length > 1 ? 62 : 74}px Georgia, "Times New Roman", serif`;
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(20, 12, 6, 0.75)";
  ctx.strokeText(text, 64, 68);
  ctx.fillStyle = "#F3DFAE";
  ctx.fillText(text, 64, 68);
  if (underline) {
    ctx.fillRect(44, 106, 40, 7);
  }
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

export default function Dice3D({
  sides,
  value,
  size = 240,
  color,
  duration = 1900,
  onDone,
}: {
  sides: number;
  value: number;
  size?: number;
  color?: string;
  duration?: number;
  onDone?: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    const disposers: (() => void)[] = [];

    (async () => {
      const T = await import("three");
      const el = mountRef.current;
      if (disposed || !el) return;

      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(size, size);
      renderer.outputColorSpace = T.SRGBColorSpace;
      el.appendChild(renderer.domElement);
      disposers.push(() => {
        renderer.dispose();
        renderer.domElement.remove();
      });

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0, 7.2);
      scene.add(new T.AmbientLight(0xfff4e0, 0.7));
      const key = new T.DirectionalLight(0xffffff, 2.2);
      key.position.set(3, 4, 6);
      scene.add(key);
      const rim = new T.DirectionalLight(0xffc27a, 1.1);
      rim.position.set(-5, -2, 2);
      scene.add(rim);

      const geo = geometryFor(T, sides);
      const dieColor = new T.Color(color ?? DIE_COLORS[sides] ?? DIE_COLORS[20]);
      const mat = new T.MeshStandardMaterial({ color: dieColor, roughness: 0.32, metalness: 0.18, flatShading: true });
      const die = new T.Group();
      die.add(new T.Mesh(geo, mat));
      const edges = new T.LineSegments(
        new T.EdgesGeometry(geo, 12),
        new T.LineBasicMaterial({ color: dieColor.clone().offsetHSL(0, -0.1, 0.25), transparent: true, opacity: 0.55 })
      );
      die.add(edges);

      const faces = extractFaces(T, geo, sides);
      const textures: ThreeNS.Texture[] = [];
      faces.forEach((f, i) => {
        const label = String(i + 1);
        const tex = labelTexture(T, label, sides >= 8 && (label === "6" || label === "9"));
        textures.push(tex);
        const plane = new T.Mesh(
          new T.PlaneGeometry(f.size, f.size),
          new T.MeshStandardMaterial({
            map: tex,
            transparent: true,
            roughness: 0.4,
            metalness: 0.3,
            polygonOffset: true,
            polygonOffsetFactor: -4,
          })
        );
        plane.position.copy(f.centroid).add(new T.Vector3(0, 0, 1).applyQuaternion(f.quat).multiplyScalar(0.004));
        plane.quaternion.copy(f.quat);
        die.add(plane);
      });
      scene.add(die);
      disposers.push(() => {
        geo.dispose();
        mat.dispose();
        edges.geometry.dispose();
        textures.forEach((t) => t.dispose());
        die.traverse((o) => {
          if (o instanceof T.Mesh && o.geometry !== geo) {
            o.geometry.dispose();
            (o.material as ThreeNS.Material).dispose();
          }
        });
      });

      // Końcowe ułożenie: ściana z wynikiem zwrócona do kamery, cyfra prosto (z lekkim, naturalnym przekrzywieniem)
      const face = faces[Math.min(faces.length, Math.max(1, value)) - 1];
      const twist = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), (Math.random() - 0.5) * 0.35);
      const tilt = new T.Quaternion().setFromEuler(new T.Euler(-0.18, 0.12, 0));
      const target = tilt.multiply(twist).multiply(face.quat.clone().invert());

      const start = new T.Quaternion().setFromEuler(new T.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      const axis = new T.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const spin = Math.PI * (5 + Math.random() * 2);
      const fromLeft = Math.random() < 0.5 ? -1 : 1;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const total = reduced ? 1 : duration;
      const t0 = performance.now();
      const spinQ = new T.Quaternion();
      let finished = false;

      const frame = (now: number) => {
        if (disposed) return;
        const t = Math.min(1, (now - t0) / total);
        const e = easeOutCubic(t);
        spinQ.setFromAxisAngle(axis, spin * e).multiply(start);
        die.quaternion.copy(spinQ).slerp(target, smooth(0.5, 1, t));
        // Rzut z boku: odbicia gasnące do zera, lekki „podskok” przy lądowaniu
        die.position.set(
          fromLeft * 3.2 * (1 - e),
          1.6 * Math.abs(Math.cos(t * Math.PI * 2.6)) * Math.pow(1 - t, 2.2) - 0.1 * (1 - t),
          1.4 * (1 - e)
        );
        const land = smooth(0.82, 0.9, t) * (1 - smooth(0.9, 1, t));
        die.scale.setScalar(1 + land * 0.06);
        renderer.render(scene, camera);
        if (t < 1) raf = requestAnimationFrame(frame);
        else if (!finished) {
          finished = true;
          doneRef.current?.();
        }
      };
      raf = requestAnimationFrame(frame);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      disposers.forEach((d) => d());
    };
  }, [sides, value, size, color, duration]);

  return <div ref={mountRef} style={{ width: size, height: size }} className="relative" aria-hidden />;
}
