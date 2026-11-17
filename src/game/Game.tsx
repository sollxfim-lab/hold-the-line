import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Rig } from './Rig';

export function Game() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 68, near: 0.03, far: 240, position: [0, 13.5, 33] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
        gl.shadowMap.type = THREE.PCFShadowMap;
      }}
    >
      <color attach="background" args={['#2a2418']} />
      <fog attach="fog" args={['#2a2418', 36, 138]} />

      <ambientLight intensity={0.5} color="#cbbfa2" />
      <hemisphereLight args={['#cab98d', '#20211a', 1.05]} />
      <directionalLight
        position={[26, 40, 20]}
        intensity={2.3}
        color="#ffe0b0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-62}
        shadow-camera-right={62}
        shadow-camera-top={62}
        shadow-camera-bottom={-62}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-30, 18, -24]} intensity={0.35} color="#8fa7b8" />

      <Rig />
    </Canvas>
  );
}
