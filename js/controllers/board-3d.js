export function initBoard3D() {
  const container = document.getElementById('pynq-3d-container');
  const track = document.getElementById('hardware-scroll-track');
  if (!container || !track || !window.THREE) return;

  container.innerHTML = '';

  // 1. Scene & Camera Setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    38,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  
  // Camera framed with ample breathing room
  camera.position.set(0, 5.0, 11.5);
  camera.lookAt(0, -0.4, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  // 2. Studio Lighting with Subtle Rose Accent (Brings out rich magenta/pink PCB color)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 0.65);
  mainLight.position.set(3, 8, 6);
  scene.add(mainLight);

  // Warm pink/magenta fill light to enrich saturation
  const pinkFillLight = new THREE.DirectionalLight(0xff2d75, 0.45);
  pinkFillLight.position.set(-4, 4, 3);
  scene.add(pinkFillLight);

  // 3. Board Geometry & Texture
  const boardGroup = new THREE.Group();
  
  // Scaled down by ~20% so it feels sleek and well-proportioned
  boardGroup.scale.set(0.8, 0.8, 0.8);
  boardGroup.position.set(0, -0.5, 0);

  const textureLoader = new THREE.TextureLoader();
  const boardTexture = textureLoader.load('assets/pynq-board.jpg', (tex) => {
    tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
    renderer.render(scene, camera);
  });
  boardTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const boardWidth = 8.8;
  const boardHeight = 0.22;
  const boardDepth = 5.9;

  // Rich, authentic PYNQ magenta tone
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xd61c59, roughness: 0.45 });
  const topMat = new THREE.MeshStandardMaterial({
    map: boardTexture,
    roughness: 0.85,
    metalness: 0.0,
    // Subtle magenta multiplier tint over the texture to eliminate any pale/white wash
    color: 0xffe6f0
  });
  const bottomMat = new THREE.MeshStandardMaterial({ color: 0xa81140, roughness: 0.7 });

  const materials = [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat];
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(boardWidth, boardHeight, boardDepth), materials);
  boardGroup.add(pcb);

  // ── 3D PHYSICAL ON-BOARD COMPONENTS ────────────────────────────

  // Zynq-7020 Black Fin Heatsink (Centered over SoC)
  const heatsinkGroup = new THREE.Group();
  const hsBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.65, 0.16, 1.65),
    new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4, metalness: 0.8 })
  );
  hsBase.position.y = 0.08;
  heatsinkGroup.add(hsBase);

  const finGeo = new THREE.BoxGeometry(0.09, 0.28, 1.65);
  const finMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.4, metalness: 0.8 });
  for (let i = -0.68; i <= 0.68; i += 0.22) {
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(i, 0.22, 0);
    heatsinkGroup.add(fin);
  }
  heatsinkGroup.position.set(-0.62, 0.12, 0.1);
  boardGroup.add(heatsinkGroup);

  // Metal Shielded Ethernet Port
  const ethMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.85, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.35, metalness: 0.9 })
  );
  ethMesh.position.set(-3.5, 0.45, 0.2);
  boardGroup.add(ethMesh);

  // Dual Audio Jacks (3.5mm)
  const jackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
  const jackGoldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 });

  function createAudioJack(zPos) {
    const jack = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.4, 0.65), jackMat);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16), jackGoldMat);
    ring.rotation.z = Math.PI / 2;
    ring.position.x = -0.36;
    jack.add(body, ring);
    jack.position.set(-4.0, 0.25, zPos);
    return jack;
  }
  boardGroup.add(createAudioJack(1.3), createAudioJack(2.3));

  // USB Host Connector
  const usb = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.45, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.9, roughness: 0.3 })
  );
  usb.position.set(-1.5, 0.28, -2.4);
  boardGroup.add(usb);

  // ── ILLUMINATED ARCHITECTURAL BLOCKS (AUDIO, PS, PL) ──────────

  // 1. Audio Ingestion Highlight (Emerald box)
  const audioMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.45, 2.0),
    new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0
    })
  );
  audioMesh.position.set(-3.8, 0.3, 1.8);
  boardGroup.add(audioMesh);

  // 2. PS Highlight (Cyan box over ARM Cortex-A9 half of SoC)
  const psMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.35, 1.7),
    new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0
    })
  );
  psMesh.position.set(-1.02, 0.22, 0.1);
  boardGroup.add(psMesh);

  // 3. PL Highlight (Amber box over Artix-7 FPGA Fabric half of SoC)
  const plMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.35, 1.7),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0
    })
  );
  plMesh.position.set(-0.22, 0.22, 0.1);
  boardGroup.add(plMesh);

  scene.add(boardGroup);

  // Initial Rest Angles
  boardGroup.rotation.x = 0.82;
  boardGroup.rotation.y = -0.32;
  boardGroup.rotation.z = 0.08;

  // 4. Scroll Tracking & 360 Revolve Logic
  const calloutIntro = document.getElementById('callout-intro');
  const calloutAudio = document.getElementById('callout-audio');
  const calloutPs    = document.getElementById('callout-ps');
  const calloutPl    = document.getElementById('callout-pl');

  function updateOnScroll() {
    const rect = track.getBoundingClientRect();
    const maxScroll = rect.height - window.innerHeight;
    if (maxScroll <= 0) return;

    let progress = Math.max(0, Math.min(1, -rect.top / maxScroll));

    // Smooth 360 rotation path
    boardGroup.rotation.x = 0.82 - Math.sin(progress * Math.PI) * 0.32;
    boardGroup.rotation.y = -0.32 + progress * Math.PI * 2;
    boardGroup.rotation.z = Math.sin(progress * Math.PI * 2) * 0.1;

    // Camera zoom synced with board scale
    camera.position.z = 11.5 - Math.sin(progress * Math.PI) * 3.2;
    camera.position.y = 5.0 - progress * 1.4;
    camera.lookAt(0, -0.5, 0);

    // Callout Transitions
    if (calloutIntro) {
      calloutIntro.style.opacity = progress < 0.20 ? '1' : '0';
      calloutIntro.style.transform = `translateY(${progress * -24}px)`;
    }

    const audioActive = progress >= 0.20 && progress < 0.45;
    audioMesh.material.opacity = audioActive ? 0.45 : 0;
    if (calloutAudio) {
      calloutAudio.style.opacity = audioActive ? '1' : '0';
      calloutAudio.style.transform = audioActive ? 'translateY(0px)' : 'translateY(16px)';
    }

    const psActive = progress >= 0.45 && progress < 0.70;
    psMesh.material.opacity = psActive ? 0.45 : 0;
    if (calloutPs) {
      calloutPs.style.opacity = psActive ? '1' : '0';
      calloutPs.style.transform = psActive ? 'translateY(0px)' : 'translateY(16px)';
    }

    const plActive = progress >= 0.70 && progress <= 0.98;
    plMesh.material.opacity = plActive ? 0.45 : 0;
    if (calloutPl) {
      calloutPl.style.opacity = plActive ? '1' : '0';
      calloutPl.style.transform = plActive ? 'translateY(0px)' : 'translateY(16px)';
    }

    renderer.render(scene, camera);
  }

  let reqId;
  function animate() {
    reqId = requestAnimationFrame(animate);
    boardGroup.rotation.y += 0.001;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('scroll', updateOnScroll, { passive: true });

  function handleResize() {
    if (!container.clientWidth || !container.clientHeight) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.lookAt(0, -0.5, 0);
  }
  window.addEventListener('resize', handleResize);
}