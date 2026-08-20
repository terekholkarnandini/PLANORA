import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'

function House() {
  const group = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!group.current) return

    const t = state.clock.getElapsedTime()

    group.current.rotation.y = Math.sin(t * 0.25) * 0.12
    group.current.position.y = Math.sin(t * 0.7) * 0.08
  })

  return (
    <group ref={group} rotation={[0.15, -0.4, 0]}>

      {/* FLOOR */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[5.8, 0.12, 4]} />

        <meshStandardMaterial
          color="#10181c"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>


      {/* LEFT ROOM */}
      <mesh position={[-1.55, 0.45, 0]}>
        <boxGeometry args={[2.3, 1, 1.8]} />

        <meshStandardMaterial
          color="#172329"
          metalness={0.4}
          roughness={0.35}
        />
      </mesh>


      {/* RIGHT ROOM */}
      <mesh position={[1.45, 0.45, 0]}>
        <boxGeometry args={[2.2, 1, 1.8]} />

        <meshStandardMaterial
          color="#172329"
          metalness={0.4}
          roughness={0.35}
        />
      </mesh>


      {/* BACK ROOM */}
      <mesh position={[0, 0.45, -1.1]}>
        <boxGeometry args={[5.4, 1, 0.5]} />

        <meshStandardMaterial
          color="#1b282e"
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>


      {/* WINDOWS */}

      <mesh position={[-1.55, 0.48, 0.92]}>
        <boxGeometry args={[1.2, 0.45, 0.03]} />

        <meshStandardMaterial
          color="#7de7ff"
          emissive="#174e5c"
          emissiveIntensity={2}
          transparent
          opacity={0.7}
        />
      </mesh>


      <mesh position={[1.45, 0.48, 0.92]}>
        <boxGeometry args={[1.2, 0.45, 0.03]} />

        <meshStandardMaterial
          color="#7de7ff"
          emissive="#174e5c"
          emissiveIntensity={2}
          transparent
          opacity={0.7}
        />
      </mesh>


      {/* CENTRAL ENTRY */}

      <mesh position={[0, 0.35, 0.95]}>
        <boxGeometry args={[0.9, 0.7, 0.08]} />

        <meshStandardMaterial
          color="#7de7ff"
          emissive="#174e5c"
          emissiveIntensity={1.5}
          transparent
          opacity={0.6}
        />
      </mesh>

    </group>
  )
}


function Scene() {

  return (
    <>
      <ambientLight intensity={0.5} />

      <directionalLight
        position={[5, 8, 5]}
        intensity={2}
      />

      <pointLight
        position={[0, 2, 3]}
        color="#7de7ff"
        intensity={5}
      />

      <House />

      <gridHelper
        args={[12, 12, '#18343d', '#0c1c21']}
        position={[0, -0.22, 0]}
      />
    </>
  )
}


export default function ArchitectureScene() {

  return (
    <div className="three-scene">

      <Canvas
        camera={{
          position: [6, 4, 7],
          fov: 35
        }}
      >

        <Scene />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
          enableDamping
        />

      </Canvas>

    </div>
  )
}