import { measurePlan } from "../../shared/measurements";
import { buildFurniture } from "./furniture";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { wallSegments, length, type Plan } from "../../shared/geometry";
import { Box } from "lucide-react";
export type SceneHandle = { capture: () => string };
const SceneView = forwardRef<SceneHandle, { plan: Plan }>(({ plan }, ref) => {
  const host = useRef<HTMLDivElement>(null),
    renderer = useRef<THREE.WebGLRenderer | null>(null),
    [error, setError] = useState("");
  useImperativeHandle(ref, () => ({
    capture() {
      if (!renderer.current)
        throw Error("3D rendering is unavailable on this device");
      return renderer.current.domElement.toDataURL("image/png");
    },
  }));
  useEffect(() => {
    const el = host.current!;
    let r: THREE.WebGLRenderer;
    try {
      r = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setError(
        "Your browser cannot initialize 3D graphics. You can still edit and save your 2D plan.",
      );
      return;
    }
    setError("");
    renderer.current = r;
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setClearColor("#e9ece6");
    el.appendChild(r.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9ece6");
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
    const controls = new OrbitControls(camera, r.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 3;
    controls.maxDistance = 120;
    const xs = plan.walls.flatMap((w) => [w.a.x, w.b.x]),
      zs = plan.walls.flatMap((w) => [w.a.y, w.b.y]);
    const minX = Math.min(0, ...xs),
      maxX = Math.max(8, ...xs),
      minZ = Math.min(0, ...zs),
      maxZ = Math.max(6, ...zs),
      cx = (minX + maxX) / 2,
      cz = (minZ + maxZ) / 2,
      span = Math.max(maxX - minX, maxZ - minZ, 8);
    camera.position.set(cx + span * 1.3, span * 1.35, cz + span * 1.55);
    controls.target.set(cx, 0.3, cz);
    controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x909a86, 2.4));
    const light = new THREE.DirectionalLight(0xfff6e2, 4);
    light.position.set(cx + 5, 18, cz - 8);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -span;
    light.shadow.camera.right = span;
    light.shadow.camera.top = span;
    light.shadow.camera.bottom = -span;
    light.shadow.normalBias = 0.03;
    scene.add(light);
    function box(
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      color: string,
      rot = 0,
      roughness = 0.8,
    ) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness }),
      );
      mesh.position.set(x, y + h / 2, z);
      mesh.rotation.y = rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    }
    for (const room of measurePlan(plan).rooms) {
      const shape = new THREE.Shape(room.polygon.map(p => new THREE.Vector2(p.x, -p.y)));
      const floor = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth:.16, bevelEnabled:false}), new THREE.MeshStandardMaterial({color:plan.floorColor,roughness:.85}));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -.16;
      floor.receiveShadow = true;
      scene.add(floor);
    }
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: "#e9ece6", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.19;
    ground.receiveShadow = true;
    scene.add(ground);
    for (const w of plan.walls) {
      const angle = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
      for (const s of wallSegments(plan, w.id)) {
        const t = s.offset + s.width / 2;
        box(
          s.width,
          s.height,
          w.thickness,
          w.a.x + Math.cos(angle) * t,
          s.bottom,
          w.a.y + Math.sin(angle) * t,
          w.color,
          -angle,
        );
      }
      for (const o of plan.openings.filter((o) => o.wallId === w.id)) {
        const t = o.offset + o.width / 2,
          x = w.a.x + Math.cos(angle) * t,
          z = w.a.y + Math.sin(angle) * t;
        const frameColor = "#a8967c";
        box(
          o.width,
          0.045,
          w.thickness + 0.035,
          x,
          o.sill + o.height - 0.045,
          z,
          frameColor,
          -angle,
        );
        if (o.kind === "window") {
          const glass = box(
            o.width - 0.06,
            o.height - 0.06,
            0.025,
            x,
            o.sill + 0.03,
            z,
            "#bad5db",
            -angle,
            0.1,
          );
          (glass.material as THREE.MeshStandardMaterial).transparent = true;
          (glass.material as THREE.MeshStandardMaterial).opacity = 0.35;
          box(
            o.width,
            0.05,
            w.thickness + 0.06,
            x,
            o.sill,
            z,
            frameColor,
            -angle,
          );
        }
      }
    }
    for (const f of plan.furniture) scene.add(buildFurniture(f));
    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      r.setSize(Math.max(width, 1), Math.max(height, 1));
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    let frame = 0;
    function animate() {
      frame = requestAnimationFrame(animate);
      controls.update();
      r.render(scene, camera);
    }
    animate();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => mat.dispose());
        }
      });
      r.dispose();
      r.domElement.remove();
      renderer.current = null;
    };
  }, [plan]);
  return (
    <div className="scene-host" ref={host}>
      {error && (
        <div className="graphics-fallback">
          <Box />
          <h3>3D is unavailable on this device.</h3>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
});
export default SceneView;
