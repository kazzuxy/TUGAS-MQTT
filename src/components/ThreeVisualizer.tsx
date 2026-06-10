import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// --- TEMPERATURE VISUALIZER ---
interface TemperatureVisualizerProps {
  temperature: number;
}

export function TemperatureVisualizer({ temperature }: TemperatureVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 200;

    // SCENE, CAMERA, RENDERER
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 5, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x3b82f6, 0.4);
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    // DETERMINE STATE BASED ON TEMPERATURE
    let colorHex = 0x10b981; // green
    let statusText = 'Normal';
    let speedMult = 1;
    let shiver = false;
    let shiverSpeed = 1;

    if (temperature < 25) {
      colorHex = 0x3b82f6; // blue
      statusText = 'Dingin';
      speedMult = 0.4;
      shiver = true;
      shiverSpeed = 10;
    } else if (temperature >= 25 && temperature <= 30) {
      colorHex = 0x10b981; // green
      statusText = 'Normal';
      speedMult = 1;
    } else if (temperature > 30 && temperature <= 35) {
      colorHex = 0xf97316; // orange
      statusText = 'Panas';
      speedMult = 2.5;
    } else if (temperature > 35) {
      colorHex = 0xef4444; // red
      statusText = 'Sangat Panas';
      speedMult = 4;
      shiver = true;
      shiverSpeed = 25;
    }

    // MAIN HEAD MESH
    const headGeo = new THREE.SphereGeometry(1.2, 32, 32);
    const headMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.3,
      metalness: 0.1,
      bumpScale: 0.05
    });
    const head = new THREE.Mesh(headGeo, headMat);
    scene.add(head);

    // EYES
    const eyeGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b }); // dark blue slate

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.4, 0.25, 0.95);
    head.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.4, 0.25, 0.95);
    head.add(rightEye);

    // MOUTH DESIGN BASED ON STATUS
    let mouthMesh: THREE.Mesh | null = null;
    if (temperature < 25) {
      // Frown Torus
      const mouthGeo = new THREE.TorusGeometry(0.3, 0.07, 8, 24, Math.PI);
      const mouthMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
      mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
      mouthMesh.position.set(0, -0.3, 0.95);
      mouthMesh.rotation.z = Math.PI; // upside down frown
    } else if (temperature >= 25 && temperature <= 30) {
      // Smile Torus
      const mouthGeo = new THREE.TorusGeometry(0.3, 0.07, 8, 24, Math.PI);
      const mouthMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
      mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
      mouthMesh.position.set(0, -0.2, 0.95);
    } else {
      // Surprised/Angry Open Mouth (Cylinder or Ring)
      const mouthGeo = new THREE.TorusGeometry(0.18, 0.07, 8, 24);
      const mouthMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
      mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
      mouthMesh.position.set(0, -0.3, 0.95);
    }
    head.add(mouthMesh);

    // PARTICLES (Thermic heat/cold atoms floating around)
    const particleCount = 40;
    const particlesGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const speeds: number[] = [];

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.8 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      speeds.push(0.5 + Math.random() * 1.5);
    }

    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMat = new THREE.PointsMaterial({
      color: colorHex,
      size: 0.12,
      transparent: true,
      opacity: 0.8
    });
    const particleSystem = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particleSystem);

    // INTERACTIONS (Mouse hover/drag tracking)
    let targetRotationX = 0;
    let targetRotationY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -((clientY - rect.top) / rect.height) * 2 + 1;

      targetRotationY = mouseX * 0.8;
      targetRotationX = -mouseY * 0.6;
    };

    const domEl = containerRef.current;
    domEl.addEventListener('mousemove', handlePointerMove);
    domEl.addEventListener('touchmove', handlePointerMove);

    // RENDER/ANIMATION LOOP
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      const delta = clock.getDelta();

      // Shivering vibration offset
      if (shiver) {
        head.position.x = Math.sin(elapsedTime * shiverSpeed) * 0.04;
        head.position.y = Math.cos(elapsedTime * (shiverSpeed + 2)) * 0.04;
      } else {
        head.position.set(0, 0, 0);
      }

      // Continuous auto-rotation
      head.rotation.y += 0.015 * speedMult;
      
      // Merge mouse interaction rotation smoothly
      head.rotation.y += (targetRotationY - head.rotation.y) * 0.1;
      head.rotation.x += (targetRotationX - head.rotation.x) * 0.1;

      // Rotate surrounding particles
      particleSystem.rotation.y -= 0.008 * speedMult;
      particleSystem.rotation.x += 0.004 * speedMult;

      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    animate();

    // CLEANUP
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (domEl) {
        domEl.removeEventListener('mousemove', handlePointerMove);
        domEl.removeEventListener('touchmove', handlePointerMove);
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
    };
  }, [temperature]);

  return (
    <div className="relative w-full h-[220px] flex items-center justify-center bg-slate-900/40 rounded-xl overflow-hidden border border-slate-800">
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-sm border border-slate-800/80 px-2.5 py-1 rounded-md text-[10px] uppercase font-mono tracking-wider flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full animate-pulse ${
          temperature < 25 ? 'bg-blue-500' :
          temperature <= 30 ? 'bg-emerald-500' :
          temperature <= 35 ? 'bg-orange-500' : 'bg-red-500'
        }`} />
        Status 3D: {
          temperature < 25 ? 'Dingin (Shivering)' :
          temperature <= 30 ? 'Normal (Healthy)' :
          temperature <= 35 ? 'Panas (Rotating)' : 'Sangat Panas (Strobe vibration)'
        }
      </div>
    </div>
  );
}


// --- HUMIDITY VISUALIZER ---
interface HumidityVisualizerProps {
  humidity: number;
}

export function HumidityVisualizer({ humidity }: HumidityVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 200;

    // SCENE, CAMERA, RENDERER
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 5, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x06b6d4, 0.4);
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    // HUMIDITY LOGIC COLORS & SHAPES
    let colorHex = 0x10b981; // default green
    let floatingSpeed = 1;
    let particleGrowth = false;

    if (humidity < 40) {
      colorHex = 0xeab308; // dry yellow
      floatingSpeed = 0.5;
    } else if (humidity >= 40 && humidity <= 70) {
      colorHex = 0x10b981; // normal green
      floatingSpeed = 1.2;
    } else {
      colorHex = 0x06b6d4; // humid light blue
      floatingSpeed = 2.2;
      particleGrowth = true;
    }

    // MAIN WATER DROPLET GEOMETRY (Combine Cone + Sphere or Spherical warp)
    // We can simulate an elegant droplet by combining a cone and sphere inside a group
    const dropletGroup = new THREE.Group();

    // Top cone
    const topConeGeo = new THREE.ConeGeometry(0.8, 1.4, 32);
    const dropletMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
      bumpScale: 0.02
    });
    const topCone = new THREE.Mesh(topConeGeo, dropletMat);
    topCone.position.y = 0.45;
    dropletGroup.add(topCone);

    // Bottom sphere
    const bottomSphereGeo = new THREE.SphereGeometry(0.8, 32, 16);
    const bottomSphere = new THREE.Mesh(bottomSphereGeo, dropletMat);
    bottomSphere.position.y = -0.2;
    dropletGroup.add(bottomSphere);

    scene.add(dropletGroup);

    // EYES FOR DROPLET
    const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.35, -0.1, 0.7);
    dropletGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.35, -0.1, 0.7);
    dropletGroup.add(rightEye);

    // Mouth smile/concern
    const mouthGeo = new THREE.TorusGeometry(0.18, 0.05, 8, 24, Math.PI);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, -0.32, 0.7);
    if (humidity < 40) {
      mouth.rotation.z = Math.PI; // Dry - unhappy
      mouth.position.y = -0.38;
    }
    dropletGroup.add(mouth);

    // SPLASH / STEAM CLOUD PARTICLES
    const pCount = 50;
    const pPositions = new Float32Array(pCount * 3);
    const pSpeeds: number[] = [];

    for (let i = 0; i < pCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 3;
      pPositions[i * 3 + 1] = -1.2 + Math.random() * 0.5; // at the bottom
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 3;
      pSpeeds.push(0.3 + Math.random() * 0.8);
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: colorHex,
      size: 0.08,
      transparent: true,
      opacity: 0.5
    });
    const rainParticles = new THREE.Points(pGeo, pMat);
    scene.add(rainParticles);

    // INTERACTIONS
    let targetRotationY = 0;
    let mouseX = 0;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
      targetRotationY = mouseX * 1.2;
    };

    const domEl = containerRef.current;
    domEl.addEventListener('mousemove', handlePointerMove);
    domEl.addEventListener('touchmove', handlePointerMove);

    // ANIMATION LOOP
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Bobbing sine-wave floating physics
      dropletGroup.position.y = Math.sin(elapsedTime * 1.8 * floatingSpeed) * 0.35;
      
      // Slow auto rotation
      dropletGroup.rotation.y += 0.012;

      // Merge drag adjustments
      dropletGroup.rotation.y += (targetRotationY - dropletGroup.rotation.y) * 0.1;

      // Rain particles rising / falling
      const posArr = rainParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < pCount; i++) {
        const idxY = i * 3 + 1;
        
        if (particleGrowth) {
          // Humid -> rise up like steam mist
          posArr[idxY] += 0.015 * pSpeeds[i] * floatingSpeed;
          if (posArr[idxY] > 1.8) {
            posArr[idxY] = -1.5;
          }
        } else {
          // Dry -> slow falling droplets
          posArr[idxY] -= 0.01 * pSpeeds[i] * floatingSpeed;
          if (posArr[idxY] < -1.8) {
            posArr[idxY] = 1.0;
          }
        }
      }
      rainParticles.geometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    animate();

    // CLEANUP
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (domEl) {
        domEl.removeEventListener('mousemove', handlePointerMove);
        domEl.removeEventListener('touchmove', handlePointerMove);
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
    };
  }, [humidity]);

  return (
    <div className="relative w-full h-[220px] flex items-center justify-center bg-slate-900/40 rounded-xl overflow-hidden border border-slate-800">
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-sm border border-slate-800/80 px-2.5 py-1 rounded-md text-[10px] uppercase font-mono tracking-wider flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full animate-pulse ${
          humidity < 40 ? 'bg-yellow-500' :
          humidity <= 70 ? 'bg-emerald-500' : 'bg-cyan-500'
        }`} />
        Status 3D: {
          humidity < 40 ? 'Kering (Bobbing lambat)' :
          humidity <= 70 ? 'Optimal (Normal Bob)' : 'Lembap (Steam Rising)'
        }
      </div>
    </div>
  );
}


// --- VOICE SPECTRUM VISUALIZER ---
interface VoiceSpectrumVisualizerProps {
  isListening: boolean;
}

export function VoiceSpectrumVisualizer({ isListening }: VoiceSpectrumVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 240;

    // SCENE, CAMERA, RENDERER
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2.5, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x3b82f6, 1.5, 10);
    pointLight.position.set(0, 3, 2);
    scene.add(pointLight);

    // SPECTRUM OBJECTS (Circular 3D Spectrum bars)
    const barCount = 18;
    const bars: THREE.Mesh[] = [];
    const radius = 1.3;
    const barWidth = 0.12;

    const barGeo = new THREE.BoxGeometry(barWidth, 1, barWidth);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.1,
      metalness: 0.8,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.5
    });

    const spectrumGroup = new THREE.Group();

    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2;
      const barMat = baseMat.clone();
      
      // Custom shift gradient colors for high-aesthetic neon rings
      const hue = i / barCount;
      barMat.color.setHSL(0.55 + hue * 0.15, 0.9, 0.6); // Blue through Cyan/Teal gradient
      barMat.emissive.setHSL(0.55 + hue * 0.15, 0.9, 0.4);

      const bar = new THREE.Mesh(barGeo, barMat);
      
      // Radial ring positioning
      bar.position.x = Math.cos(angle) * radius;
      bar.position.z = Math.sin(angle) * radius;
      
      // Orient outer face outward
      bar.rotation.y = -angle;

      spectrumGroup.add(bar);
      bars.push(bar);
    }
    
    scene.add(spectrumGroup);

    // PARTICLE ring
    const particleCount = 60;
    const pPositions = new Float32Array(particleCount * 3);
    const pRadii: number[] = [];
    const pAngles: number[] = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.4 + Math.random() * 0.8;
      pPositions[i * 3] = Math.cos(angle) * r;
      pPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      pPositions[i * 3 + 2] = Math.sin(angle) * r;

      pAngles.push(angle);
      pRadii.push(r);
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x06b6d4,
      size: 0.05,
      transparent: true,
      opacity: 0.7
    });
    const circularParticles = new THREE.Points(pGeo, pMat);
    scene.add(circularParticles);

    // ANIMATION LOOP
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Audio spectrum frequencies simulation
      bars.forEach((bar, index) => {
        let targetScaleY = 0.15; // silent default
        if (isListening) {
          // Dynamic noisy waves with layered sine multipliers
          const p1 = Math.sin(elapsedTime * 6 + index * 1.5) * 0.8;
          const p2 = Math.cos(elapsedTime * 14 - index * 0.8) * 0.5;
          const noise = 0.9 + Math.sin(elapsedTime * 22 + (index % 3) * 10) * 0.4;
          targetScaleY = Math.max(0.18, (p1 + p2 + 1.2) * noise);
        } else {
          // Gentle silent rhythmic wave
          targetScaleY = 0.15 + Math.sin(elapsedTime * 2 + index * 0.5) * 0.08;
        }

        // Interpolate smoothly
        bar.scale.y += (targetScaleY - bar.scale.y) * 0.2;
        bar.position.y = bar.scale.y / 2 - 0.5; // anchor base at y= -0.5
      });

      // Slowly rotate spectrum circle
      spectrumGroup.rotation.y += isListening ? 0.024 : 0.005;
      spectrumGroup.rotation.x = Math.sin(elapsedTime * 0.5) * 0.08;

      // Spin surrounding particles
      const posArr = circularParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        pAngles[i] += isListening ? 0.015 : 0.003;
        const currentRadius = pRadii[i] + (isListening ? Math.sin(elapsedTime * 10 + i) * 0.04 : 0);
        posArr[i * 3] = Math.cos(pAngles[i]) * currentRadius;
        posArr[i * 3 + 2] = Math.sin(pAngles[i]) * currentRadius;
        if (isListening) {
          posArr[i * 3 + 1] = Math.sin(elapsedTime * 8 + i) * 0.25;
        } else {
          posArr[i * 3 + 1] = Math.sin(elapsedTime * 1.5 + i) * 0.05;
        }
      }
      circularParticles.geometry.attributes.position.needsUpdate = true;
      circularParticles.rotation.y -= 0.002;

      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    animate();

    // CLEANUP
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
    };
  }, [isListening]);

  return (
    <div className="relative w-full h-[220px] flex items-center justify-center rounded-xl bg-slate-950/40 border border-slate-800/80 overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      <div className={`absolute pointer-events-none inset-0 border-[2px] transition-all duration-700 rounded-xl ${
        isListening ? 'border-sky-500/30' : 'border-transparent'
      }`} />
      <div className="absolute top-3 left-4 flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${
          isListening ? 'bg-sky-400 animate-ping' : 'bg-slate-600'
        }`} />
        <span className="text-xs font-mono font-medium tracking-wide text-slate-400">
          {isListening ? 'SPEKTRUM AKTIF - MENDENGARKAN...' : 'SPEKTRUM INAKTIF'}
        </span>
      </div>
    </div>
  );
}
