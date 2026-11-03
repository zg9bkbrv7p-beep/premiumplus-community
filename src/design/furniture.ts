import * as THREE from "three";
import type { Furniture } from "../../shared/geometry";
export function buildFurniture(f: Furniture): THREE.Group {
  const group = new THREE.Group();
  const add = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string,
  ) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    m.position.set(x, y + h / 2, z);
    group.add(m);
  };
  if (f.kind === "sofa") {
    add(f.width, 0.18, f.depth, 0, 0.17, 0, "#6d695e");
    add(f.width - 0.1, 0.32, f.depth - 0.13, 0, 0.35, 0, f.color);
    add(f.width, 0.48, 0.18, 0, 0.55, -f.depth / 2 + 0.09, f.color);
    add(0.18, 0.52, f.depth, -f.width / 2 + 0.09, 0.35, 0, f.color);
    add(0.18, 0.52, f.depth, f.width / 2 - 0.09, 0.35, 0, f.color);
    for (let i = 0; i < 3; i++)
      add(
        (f.width - 0.44) / 3 - 0.025,
        0.14,
        f.depth - 0.25,
        -f.width / 2 + 0.22 + ((i + 0.5) * (f.width - 0.44)) / 3,
        0.66,
        0.04,
        f.color,
      );
  } else if (f.kind === "bed") {
    add(f.width, 0.25, f.depth, 0, 0.15, 0, "#998674");
    add(f.width - 0.07, 0.22, f.depth - 0.1, 0, 0.4, 0, f.color);
    add(f.width, 0.9, 0.1, 0, 0, -f.depth / 2, "#a99780");
    add(
      f.width * 0.38,
      0.12,
      0.45,
      -f.width * 0.23,
      0.62,
      -f.depth * 0.31,
      "#f4f0e8",
    );
    add(
      f.width * 0.38,
      0.12,
      0.45,
      f.width * 0.23,
      0.62,
      -f.depth * 0.31,
      "#f4f0e8",
    );
  } else if (f.kind === "plant") {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(
        f.width * 0.42,
        f.width * 0.32,
        f.height * 0.4,
        20,
      ),
      new THREE.MeshStandardMaterial({ color: "#b7a087" }),
    );
    pot.position.y = f.height * 0.2;
    group.add(pot);
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(f.width * 0.6, 16, 12),
      new THREE.MeshStandardMaterial({ color: f.color }),
    );
    bush.scale.y = 1.3;
    bush.position.y = f.height * 0.72;
    group.add(bush);
  } else if (f.kind === "table") {
    add(f.width, 0.1, f.depth, 0, f.height - 0.1, 0, f.color);
    for (const x of [-1, 1])
      for (const z of [-1, 1])
        add(
          0.07,
          f.height - 0.1,
          0.07,
          x * (f.width / 2 - 0.12),
          0,
          z * (f.depth / 2 - 0.12),
          "#756c5f",
        );
  } else if (["cabinet", "refrigerator", "oven"].includes(f.kind)) {
    add(f.width, f.height, f.depth, 0, 0, 0, f.color);
    const front = -f.depth / 2 - .006;
    if (f.kind === "oven") {
      add(f.width * .78, f.height * .5, .012, 0, f.height * .2, front, "#303d38");
      add(f.width * .65, .035, .035, 0, f.height * .76, front - .02, "#b9bdb7");
    } else {
      add(.035, f.height * .28, .035, f.width * .32, f.height * .45, front - .02, "#b9bdb7");
      if (f.kind === "refrigerator") add(f.width, .015, .015, 0, f.height * .72, front, "#768079");
    }
  } else {
    add(f.width, 0.1, f.depth, 0, 0.42, 0, f.color);
    add(f.width, 0.5, 0.08, 0, 0.5, -f.depth / 2, "#b2a189");
    for (const x of [-1, 1])
      for (const z of [-1, 1])
        add(
          0.05,
          0.42,
          0.05,
          x * (f.width / 2 - 0.08),
          0,
          z * (f.depth / 2 - 0.08),
          "#766c5d",
        );
  }
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3()),
    center = bounds.getCenter(new THREE.Vector3());
  for (const child of group.children) {
    child.position.x -= center.x;
    child.position.y -= bounds.min.y;
    child.position.z -= center.z;
  }
  group.scale.set(f.width / size.x, f.height / size.y, f.depth / size.z);
  group.position.set(f.x, 0, f.y);
  group.rotation.y = (-f.rotation * Math.PI) / 180;
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return group;
}
