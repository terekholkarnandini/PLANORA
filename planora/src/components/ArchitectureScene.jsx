import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

function ArchitectureScene() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    /* =========================================================
       SCENE
    ========================================================= */

    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0x06111f);

    scene.fog = new THREE.Fog(
      0x06111f,
      18,
      34
    );


    /* =========================================================
       CAMERA
    ========================================================= */

    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );

    camera.position.set(
      9.5,
      8,
      10
    );


    /* =========================================================
       RENDERER
    ========================================================= */

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
    });

    renderer.setSize(
      container.clientWidth,
      container.clientHeight
    );

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type =
      THREE.PCFSoftShadowMap;

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 1.15;

    container.appendChild(
      renderer.domElement
    );


    /* =========================================================
       CONTROLS
    ========================================================= */

    const controls = new OrbitControls(
      camera,
      renderer.domElement
    );

    controls.enableDamping = true;

    controls.dampingFactor = 0.055;

    controls.enablePan = false;

    controls.minDistance = 6;
    controls.maxDistance = 19;

    controls.minPolarAngle =
      Math.PI * 0.16;

    controls.maxPolarAngle =
      Math.PI * 0.48;

    controls.target.set(
      0,
      0.9,
      0
    );


    /* =========================================================
       LIGHTING
    ========================================================= */

    const hemisphereLight =
      new THREE.HemisphereLight(
        0xd9ecff,
        0x382619,
        1.5
      );

    scene.add(hemisphereLight);


    const sunLight =
      new THREE.DirectionalLight(
        0xfff1dc,
        3.2
      );

    sunLight.position.set(
      8,
      12,
      7
    );

    sunLight.castShadow = true;

    sunLight.shadow.mapSize.set(
      2048,
      2048
    );

    sunLight.shadow.camera.left = -12;
    sunLight.shadow.camera.right = 12;
    sunLight.shadow.camera.top = 12;
    sunLight.shadow.camera.bottom = -12;

    scene.add(sunLight);


    const coolFill =
      new THREE.DirectionalLight(
        0x70a8ff,
        1.1
      );

    coolFill.position.set(
      -6,
      5,
      -4
    );

    scene.add(coolFill);


    /* warm interior glow */

    const livingLight =
      new THREE.PointLight(
        0xffb56b,
        9,
        8
      );

    livingLight.position.set(
      -1.8,
      2,
      1.4
    );

    scene.add(livingLight);


    const kitchenLight =
      new THREE.PointLight(
        0xffc887,
        7,
        6
      );

    kitchenLight.position.set(
      2.5,
      2,
      -1.5
    );

    scene.add(kitchenLight);


    /* =========================================================
       MATERIALS
    ========================================================= */

    const wallMaterial =
  new THREE.MeshStandardMaterial({
    color: 0xc7c1b8,
    roughness: 0.82,
    metalness: 0,
  });

    const wallTopMaterial =
  new THREE.MeshStandardMaterial({
    color: 0xddd8cf,
    roughness: 0.65,
  });

    const woodFloorMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x8d6548,
        roughness: 0.73,
      });

    const warmWoodMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x68412b,
        roughness: 0.62,
      });

    const lightWoodMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xa87a55,
        roughness: 0.65,
      });

    const tileMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xb9c1c5,
        roughness: 0.65,
      });

    const kitchenFloorMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x9a9a94,
        roughness: 0.7,
      });

    const darkMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x202a33,
        roughness: 0.55,
      });

    const blackMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x111820,
        roughness: 0.45,
      });

    const whiteMaterial =
  new THREE.MeshStandardMaterial({
    color: 0xd9d5cc,
    roughness: 0.72,
  });

    const mattressMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xe6e2da,
        roughness: 0.9,
      });

    const cushionMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x8798a5,
        roughness: 0.9,
      });

    const sofaMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x6f7d86,
        roughness: 0.92,
      });

    const glassMaterial =
      new THREE.MeshPhysicalMaterial({
        color: 0xa4d8ff,
        transparent: true,
        opacity: 0.32,
        transmission: 0.25,
        roughness: 0.08,
        metalness: 0,
        side: THREE.DoubleSide,
      });

    const plantMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x406f49,
        roughness: 0.9,
      });

    const potMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x75513c,
        roughness: 0.8,
      });

    const rugMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x506273,
        roughness: 1,
      });


    /* =========================================================
       HOUSE GROUP
    ========================================================= */

    const house = new THREE.Group();

    scene.add(house);


    /* =========================================================
       GENERAL HELPERS
    ========================================================= */

    function box(
      width,
      height,
      depth,
      x,
      y,
      z,
      material,
      castShadow = true
    ) {
      const geometry =
        new THREE.BoxGeometry(
          width,
          height,
          depth
        );

      const mesh =
        new THREE.Mesh(
          geometry,
          material
        );

      mesh.position.set(
        x,
        y,
        z
      );

      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;

      house.add(mesh);

      return mesh;
    }


    /* =========================================================
       BASE PLATFORM
    ========================================================= */

    box(
      8.7,
      0.32,
      6.7,
      0,
      -0.18,
      0,
      darkMaterial
    );


    /* =========================================================
       ROOM FLOORS
       Matches the 2D plan:
       BED | BATH | KITCHEN
       LIVING     | BED
    ========================================================= */

    // top-left bedroom
    box(
      3.15,
      0.08,
      2.92,
      -2.4,
      0.02,
      -1.5,
      woodFloorMaterial,
      false
    );

    // bathroom
    box(
      1.9,
      0.08,
      2.92,
      0.2,
      0.02,
      -1.5,
      tileMaterial,
      false
    );

    // kitchen
    box(
      2.7,
      0.08,
      2.92,
      2.6,
      0.02,
      -1.5,
      kitchenFloorMaterial,
      false
    );

    // living room
    box(
      5.1,
      0.08,
      2.92,
      -1.4,
      0.02,
      1.5,
      woodFloorMaterial,
      false
    );

    // second bedroom
    box(
      2.7,
      0.08,
      2.92,
      2.6,
      0.02,
      1.5,
      woodFloorMaterial,
      false
    );


    /* =========================================================
       WALL HELPERS
    ========================================================= */

    const wallHeight = 2.55;
    const wallThickness = 0.12;


    function wallX(
      length,
      x,
      z,
      height = wallHeight
    ) {
      return box(
        length,
        height,
        wallThickness,
        x,
        height / 2,
        z,
        wallMaterial
      );
    }


    function wallZ(
      length,
      x,
      z,
      height = wallHeight
    ) {
      return box(
        wallThickness,
        height,
        length,
        x,
        height / 2,
        z,
        wallMaterial
      );
    }


    /* wall with doorway gap */

    function wallXWithDoor(
      startX,
      endX,
      z,
      doorCenter,
      doorWidth = 0.85
    ) {
      const leftEnd =
        doorCenter - doorWidth / 2;

      const rightStart =
        doorCenter + doorWidth / 2;

      const leftLength =
        leftEnd - startX;

      const rightLength =
        endX - rightStart;

      if (leftLength > 0) {
        wallX(
          leftLength,
          startX + leftLength / 2,
          z
        );
      }

      if (rightLength > 0) {
        wallX(
          rightLength,
          rightStart + rightLength / 2,
          z
        );
      }

      /* lintel over doorway */

      box(
        doorWidth,
        0.4,
        wallThickness,
        doorCenter,
        2.35,
        z,
        wallMaterial
      );
    }


    function wallZWithDoor(
      startZ,
      endZ,
      x,
      doorCenter,
      doorWidth = 0.85
    ) {
      const firstEnd =
        doorCenter - doorWidth / 2;

      const secondStart =
        doorCenter + doorWidth / 2;

      const firstLength =
        firstEnd - startZ;

      const secondLength =
        endZ - secondStart;

      if (firstLength > 0) {
        wallZ(
          firstLength,
          x,
          startZ + firstLength / 2
        );
      }

      if (secondLength > 0) {
        wallZ(
          secondLength,
          x,
          secondStart + secondLength / 2
        );
      }

      box(
        wallThickness,
        0.4,
        doorWidth,
        x,
        2.35,
        doorCenter,
        wallMaterial
      );
    }


    /* =========================================================
       OUTER WALLS
    ========================================================= */

    // left
    wallZ(
      6,
      -4,
      0
    );

    // right
    wallZ(
      6,
      4,
      0
    );


    /* BACK WALL WITH WINDOW OPENINGS */

    // lower sill
    box(
      8,
      0.72,
      wallThickness,
      0,
      0.36,
      -3,
      wallMaterial
    );

    // top lintel
    box(
      8,
      0.55,
      wallThickness,
      0,
      2.275,
      -3,
      wallMaterial
    );

    // vertical sections between windows

    const rearSections = [
      [-4, -3.15],
      [-1.65, -0.3],
      [0.7, 1.85],
      [3.35, 4],
    ];

    rearSections.forEach(
      ([start, end]) => {
        box(
          end - start,
          1.35,
          wallThickness,
          (start + end) / 2,
          1.395,
          -3,
          wallMaterial
        );
      }
    );


    /* =========================================================
       BACK WINDOWS
    ========================================================= */

    function rearWindow(
      x,
      width
    ) {
      const frame =
        new THREE.Group();

      const pane =
        new THREE.Mesh(
          new THREE.PlaneGeometry(
            width,
            1.25
          ),
          glassMaterial
        );

      pane.position.set(
        x,
        1.4,
        -2.93
      );

      house.add(pane);

      /* frame bars */

      box(
        width + 0.08,
        0.055,
        0.05,
        x,
        0.77,
        -2.9,
        blackMaterial
      );

      box(
        width + 0.08,
        0.055,
        0.05,
        x,
        2.03,
        -2.9,
        blackMaterial
      );

      box(
        0.055,
        1.31,
        0.05,
        x - width / 2,
        1.4,
        -2.9,
        blackMaterial
      );

      box(
        0.055,
        1.31,
        0.05,
        x + width / 2,
        1.4,
        -2.9,
        blackMaterial
      );
    }

    rearWindow(
      -2.4,
      1.5
    );

    rearWindow(
      0.2,
      0.9
    );

    rearWindow(
      2.6,
      1.5
    );


    /* =========================================================
       FRONT CUTAWAY WALL
       Kept low so interior stays visible
    ========================================================= */

    wallX(
      8,
      0,
      3,
      0.72
    );

    /* tall corner columns */

    box(
      0.18,
      wallHeight,
      0.18,
      -3.9,
      wallHeight / 2,
      2.9,
      wallMaterial
    );

    box(
      0.18,
      wallHeight,
      0.18,
      3.9,
      wallHeight / 2,
      2.9,
      wallMaterial
    );


    /* =========================================================
       INTERNAL WALLS
    ========================================================= */

    // upper-left bedroom divider
    wallZWithDoor(
      -3,
      0,
      -0.8,
      -0.55
    );

    // bath/kitchen divider
    wallZWithDoor(
      -3,
      0,
      1.2,
      -0.55
    );

    // living / second bedroom
    wallZWithDoor(
      0,
      3,
      1.2,
      0.55
    );


    // horizontal middle separators

    wallXWithDoor(
      -4,
      -0.8,
      0,
      -1.55
    );

    wallXWithDoor(
      -0.8,
      1.2,
      0,
      0.2,
      0.75
    );

    wallXWithDoor(
      1.2,
      4,
      0,
      2.1
    );


    /* =========================================================
       WALL TOP CAPS
    ========================================================= */

    function topCapX(
      length,
      x,
      z
    ) {
      box(
        length,
        0.055,
        0.17,
        x,
        wallHeight + 0.025,
        z,
        wallTopMaterial,
        false
      );
    }

    topCapX(
      8,
      0,
      -3
    );


    /* =========================================================
       BED HELPER
    ========================================================= */

    function createBed(
      x,
      z,
      rotation = 0
    ) {
      const bed =
        new THREE.Group();

      /* frame */

      const frame =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            1.55,
            0.22,
            2.05
          ),
          warmWoodMaterial
        );

      frame.position.y = 0.18;

      frame.castShadow = true;

      bed.add(frame);


      /* mattress */

      const mattress =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            1.45,
            0.22,
            1.9
          ),
          mattressMaterial
        );

      mattress.position.y = 0.4;

      mattress.castShadow = true;

      bed.add(mattress);


      /* headboard */

      const headboard =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            1.58,
            0.75,
            0.12
          ),
          warmWoodMaterial
        );

      headboard.position.set(
        0,
        0.6,
        -0.98
      );

      bed.add(headboard);


      /* pillows */

      [-0.38, 0.38].forEach(
        (px) => {
          const pillow =
            new THREE.Mesh(
              new THREE.BoxGeometry(
                0.55,
                0.12,
                0.36
              ),
              whiteMaterial
            );

          pillow.position.set(
            px,
            0.58,
            -0.6
          );

          pillow.castShadow = true;

          bed.add(pillow);
        }
      );

      bed.position.set(
        x,
        0,
        z
      );

      bed.rotation.y = rotation;

      house.add(bed);
    }


    createBed(
      -2.5,
      -1.65
    );

    createBed(
      2.65,
      1.55,
      Math.PI
    );


    /* =========================================================
       BEDROOM SIDE TABLES
    ========================================================= */

    box(
      0.45,
      0.45,
      0.45,
      -3.45,
      0.24,
      -2.15,
      lightWoodMaterial
    );

    box(
      0.45,
      0.45,
      0.45,
      1.65,
      0.24,
      2.1,
      lightWoodMaterial
    );


    /* =========================================================
       LIVING ROOM
    ========================================================= */

    /* rug */

    box(
      2.5,
      0.035,
      1.65,
      -1.8,
      0.08,
      1.35,
      rugMaterial,
      false
    );


    /* sofa base */

    box(
      2.35,
      0.48,
      0.78,
      -2.35,
      0.32,
      2.15,
      sofaMaterial
    );

    /* sofa back */

    box(
      2.35,
      0.8,
      0.2,
      -2.35,
      0.72,
      2.48,
      sofaMaterial
    );


    /* sofa cushions */

    [-3.05, -2.35, -1.65].forEach(
      (x) => {
        box(
          0.62,
          0.18,
          0.58,
          x,
          0.63,
          2.07,
          cushionMaterial
        );
      }
    );


    /* coffee table */

    box(
      1.35,
      0.09,
      0.7,
      -2.1,
      0.44,
      1.05,
      lightWoodMaterial
    );

    [
      [-2.65, 0.82],
      [-1.55, 0.82],
      [-2.65, 1.28],
      [-1.55, 1.28],
    ].forEach(
      ([x, z]) => {
        box(
          0.08,
          0.4,
          0.08,
          x,
          0.22,
          z,
          blackMaterial
        );
      }
    );


    /* =========================================================
       DINING TABLE
    ========================================================= */

    box(
      1.15,
      0.09,
      0.75,
      0.2,
      0.62,
      1.72,
      lightWoodMaterial
    );

    box(
      0.12,
      0.58,
      0.12,
      -0.25,
      0.31,
      1.72,
      blackMaterial
    );

    box(
      0.12,
      0.58,
      0.12,
      0.65,
      0.31,
      1.72,
      blackMaterial
    );


    /* simple dining chairs */

    function chair(
      x,
      z,
      rotation = 0
    ) {
      const group =
        new THREE.Group();

      const seat =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            0.42,
            0.1,
            0.42
          ),
          warmWoodMaterial
        );

      seat.position.y = 0.42;

      group.add(seat);

      const back =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            0.42,
            0.55,
            0.08
          ),
          warmWoodMaterial
        );

      back.position.set(
        0,
        0.7,
        -0.18
      );

      group.add(back);

      group.position.set(
        x,
        0,
        z
      );

      group.rotation.y =
        rotation;

      group.traverse(
        (object) => {
          if (object.isMesh)
            object.castShadow = true;
        }
      );

      house.add(group);
    }

    chair(
      -0.55,
      1.72,
      -Math.PI / 2
    );

    chair(
      0.95,
      1.72,
      Math.PI / 2
    );


    /* =========================================================
       KITCHEN
    ========================================================= */

    /* rear cabinets */

    box(
      2.25,
      0.82,
      0.55,
      2.55,
      0.44,
      -2.65,
      whiteMaterial
    );

    /* countertop */

    box(
      2.32,
      0.09,
      0.62,
      2.55,
      0.9,
      -2.65,
      darkMaterial
    );


    /* right-side cabinet */

    box(
      0.55,
      0.82,
      1.35,
      3.65,
      0.44,
      -1.65,
      whiteMaterial
    );

    box(
      0.62,
      0.09,
      1.42,
      3.65,
      0.9,
      -1.65,
      darkMaterial
    );


    /* kitchen island */

    box(
      1.25,
      0.78,
      0.65,
      2.45,
      0.42,
      -1.15,
      lightWoodMaterial
    );

    box(
      1.35,
      0.08,
      0.75,
      2.45,
      0.85,
      -1.15,
      blackMaterial
    );


    /* tall fridge */

    box(
      0.65,
      1.75,
      0.62,
      3.45,
      0.9,
      -2.55,
      darkMaterial
    );


    /* =========================================================
       BATHROOM
    ========================================================= */

    /* vanity */

    box(
      0.85,
      0.65,
      0.42,
      -0.25,
      0.35,
      -2.62,
      whiteMaterial
    );

    box(
      0.92,
      0.08,
      0.48,
      -0.25,
      0.72,
      -2.62,
      darkMaterial
    );


    /* toilet */

    const toiletBase =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.25,
          0.29,
          0.42,
          24
        ),
        whiteMaterial
      );

    toiletBase.position.set(
      0.65,
      0.22,
      -1.55
    );

    toiletBase.castShadow = true;

    house.add(toiletBase);

    box(
      0.45,
      0.55,
      0.18,
      0.65,
      0.52,
      -1.77,
      whiteMaterial
    );


    /* shower glass */

    const showerGlass =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          0.9,
          1.75
        ),
        glassMaterial
      );

    showerGlass.position.set(
      -0.35,
      0.9,
      -1.45
    );

    showerGlass.rotation.y =
      Math.PI / 2;

    house.add(showerGlass);


    /* =========================================================
       PLANT
    ========================================================= */

    function createPlant(
      x,
      z
    ) {
      const pot =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.2,
            0.16,
            0.35,
            18
          ),
          potMaterial
        );

      pot.position.set(
        x,
        0.18,
        z
      );

      pot.castShadow = true;

      house.add(pot);


      const foliage =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            0.38,
            18,
            18
          ),
          plantMaterial
        );

      foliage.scale.set(
        0.7,
        1.4,
        0.7
      );

      foliage.position.set(
        x,
        0.72,
        z
      );

      foliage.castShadow = true;

      house.add(foliage);
    }

    createPlant(
      -3.45,
      2.35
    );


    /* =========================================================
       GROUND
    ========================================================= */

    const groundMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x07111a,
        roughness: 1,
      });

    const ground =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          35,
          35
        ),
        groundMaterial
      );

    ground.rotation.x =
      -Math.PI / 2;

    ground.position.y = -0.37;

    ground.receiveShadow = true;

    scene.add(ground);


    /* subtle grid */

    const grid =
      new THREE.GridHelper(
        30,
        30,
        0x245b84,
        0x142b3d
      );

    grid.position.y = -0.35;

    grid.material.transparent = true;
    grid.material.opacity = 0.28;

    scene.add(grid);


    /* =========================================================
       ANIMATION
    ========================================================= */

    let frameId;

    function animate() {
      frameId =
        requestAnimationFrame(
          animate
        );

      controls.update();

      renderer.render(
        scene,
        camera
      );
    }

    animate();


    /* =========================================================
       RESIZE
    ========================================================= */

    const resizeObserver =
      new ResizeObserver(() => {
        const width =
          container.clientWidth;

        const height =
          container.clientHeight;

        if (!width || !height)
          return;

        camera.aspect =
          width / height;

        camera.updateProjectionMatrix();

        renderer.setSize(
          width,
          height
        );
      });

    resizeObserver.observe(
      container
    );


    /* =========================================================
       CLEANUP
    ========================================================= */

    return () => {
      cancelAnimationFrame(frameId);

      resizeObserver.disconnect();

      controls.dispose();

      scene.traverse(
        (object) => {
          if (object.geometry) {
            object.geometry.dispose();
          }
        }
      );

      renderer.dispose();

      if (
        renderer.domElement &&
        container.contains(
          renderer.domElement
        )
      ) {
        container.removeChild(
          renderer.domElement
        );
      }
    };
  }, []);


  return (
    <div
      ref={mountRef}
      className="threeDPreviewContainer"
    />
  );
}

export default ArchitectureScene;