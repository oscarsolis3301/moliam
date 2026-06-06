// 3D Water Bottle — high-quality sport bottle (HydroFlask-inspired)
function BottleDemo({ accent, theme, paused }) {
  const mountRef = React.useRef(null);
  const [fillLevel, setFillLevel] = React.useState(0.65);
  const [rotating, setRotating] = React.useState(true);
  const [capColor, setCapColor] = React.useState('#1a1814');
  const pausedRef = React.useRef(paused);
  React.useEffect(() => { pausedRef.current = paused; }, [paused]);
  const stateRef = React.useRef({});

  const bodyColors = [
    { name: 'Ember', hex: '#ff6b35' },
    { name: 'Graphite', hex: '#2a2824' },
    { name: 'Bone', hex: '#e8e2d4' },
    { name: 'Cobalt', hex: '#2a4b7c' },
    { name: 'Olive', hex: '#5a6b3a' },
  ];
  const [bodyColor, setBodyColor] = React.useState(bodyColors[0].hex);

  React.useEffect(() => {
    if (!window.THREE) return;
    const THREE = window.THREE;
    const mount = mountRef.current;
    const W = mount.clientWidth, H = 380;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
    camera.position.set(2.6, 0.8, 4.2);
    camera.lookAt(0, 0.2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    // ── Environment (procedural gradient as envMap for reflections) ──
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envGeom = new THREE.SphereGeometry(50, 32, 32);
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 512; envCanvas.height = 256;
    const ectx = envCanvas.getContext('2d');
    const envG = ectx.createLinearGradient(0, 0, 0, 256);
    const lightBg = theme === 'dark' ? '#3a3530' : '#ffffff';
    const darkBg = theme === 'dark' ? '#0a0907' : '#c8ccd2';
    envG.addColorStop(0, lightBg);
    envG.addColorStop(0.5, theme === 'dark' ? '#1a1814' : '#e4e6ea');
    envG.addColorStop(1, darkBg);
    ectx.fillStyle = envG;
    ectx.fillRect(0, 0, 512, 256);
    // bright highlight streak
    ectx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.95)';
    ectx.fillRect(120, 40, 80, 180);
    ectx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)';
    ectx.fillRect(340, 80, 40, 120);
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    const envMap = pmrem.fromEquirectangular(envTex).texture;
    scene.environment = envMap;

    // ── Lights ──
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 4, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xaabbff, 0.4);
    fill.position.set(-3, 2, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(new THREE.Color(accent), 0.8);
    rim.position.set(-2, 1, -3);
    scene.add(rim);

    // ── Bottle group ──
    const bottleGroup = new THREE.Group();
    scene.add(bottleGroup);

    // Sport bottle profile (Hydro Flask-inspired): wide base, slight taper, rounded shoulder, narrow neck
    const profile = [];
    profile.push(new THREE.Vector2(0.0001, -1.35));
    profile.push(new THREE.Vector2(0.55, -1.35));
    profile.push(new THREE.Vector2(0.58, -1.30));
    // straight body
    profile.push(new THREE.Vector2(0.58, 0.45));
    // shoulder curve
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const a = t * Math.PI / 2;
      const r = 0.58 - (0.58 - 0.22) * Math.sin(a);
      const y = 0.45 + (0.38) * Math.sin(a);
      profile.push(new THREE.Vector2(r, y));
    }
    // neck
    profile.push(new THREE.Vector2(0.22, 0.92));
    profile.push(new THREE.Vector2(0.22, 1.02));
    // top lip
    profile.push(new THREE.Vector2(0.24, 1.04));
    profile.push(new THREE.Vector2(0.24, 1.06));
    profile.push(new THREE.Vector2(0.21, 1.06));

    const bodyGeom = new THREE.LatheGeometry(profile, 96);
    bodyGeom.computeVertexNormals();

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: bodyColor,
      roughness: 0.35,
      metalness: 0.85,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.2,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    bottleGroup.add(body);

    // Bottom detail — slight bevel
    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.015, 16, 96),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8 })
    );
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = -1.35;
    bottleGroup.add(baseRing);

    // ── Cap — sport-style with carrying loop ──
    const capGroup = new THREE.Group();
    capGroup.position.y = 1.12;
    bottleGroup.add(capGroup);

    const capMat = new THREE.MeshPhysicalMaterial({
      color: capColor, roughness: 0.4, metalness: 0.3,
      envMapIntensity: 0.8,
    });

    const capMain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.24, 0.18, 48),
      capMat
    );
    capMain.position.y = 0.04;
    capGroup.add(capMain);

    // cap top ridge
    const capTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 0.04, 48),
      capMat
    );
    capTop.position.y = 0.15;
    capGroup.add(capTop);

    // cap grip ridges
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const ridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.14, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 })
      );
      ridge.position.set(Math.cos(a) * 0.265, 0.04, Math.sin(a) * 0.265);
      ridge.rotation.y = a;
      capGroup.add(ridge);
    }

    // carrying loop
    const loop = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.018, 12, 32, Math.PI),
      new THREE.MeshStandardMaterial({ color: '#e8e2d4', roughness: 0.5 })
    );
    loop.position.y = 0.18;
    loop.rotation.x = Math.PI / 2;
    loop.rotation.z = Math.PI;
    capGroup.add(loop);
    const loopAnchor1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.03, 16),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    loopAnchor1.position.set(-0.08, 0.16, 0);
    capGroup.add(loopAnchor1);
    const loopAnchor2 = loopAnchor1.clone();
    loopAnchor2.position.x = 0.08;
    capGroup.add(loopAnchor2);

    // ── Label (debossed/printed branding) ──
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 1024; labelCanvas.height = 512;
    const lctx = labelCanvas.getContext('2d');
    // transparent - only draw logo area
    lctx.clearRect(0, 0, 1024, 512);
    // subtle darker band
    lctx.fillStyle = 'rgba(0,0,0,0.12)';
    lctx.fillRect(0, 180, 1024, 180);
    // main wordmark
    lctx.fillStyle = '#ffffff';
    lctx.font = '700 110px "Instrument Serif", serif';
    lctx.fillStyle = 'rgba(255,255,255,0.92)';
    lctx.textAlign = 'center';
    lctx.fillText('SOLIS', 512, 290);
    // underline accent
    lctx.fillStyle = accent;
    lctx.fillRect(380, 310, 264, 4);
    // sub
    lctx.font = '500 26px "JetBrains Mono", monospace';
    lctx.fillStyle = 'rgba(255,255,255,0.75)';
    lctx.fillText('750 ML · INSULATED', 512, 348);

    const labelTex = new THREE.CanvasTexture(labelCanvas);
    labelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const labelGeom = new THREE.CylinderGeometry(0.582, 0.582, 0.7, 96, 1, true);
    const labelMat = new THREE.MeshPhysicalMaterial({
      map: labelTex,
      transparent: true,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const label = new THREE.Mesh(labelGeom, labelMat);
    label.position.y = -0.2;
    bottleGroup.add(label);

    // ── Shadow/ground ──
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256; shadowCanvas.height = 256;
    const sctx = shadowCanvas.getContext('2d');
    const sg = sctx.createRadialGradient(128, 128, 20, 128, 128, 120);
    sg.addColorStop(0, 'rgba(0,0,0,0.55)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 256, 256);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 1.2),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.36;
    scene.add(shadow);

    stateRef.current = { bottleGroup, body, bodyMat, capMat, renderer, scene, camera, mount, pmrem };

    let dragging = false, lastX = 0, lastY = 0;
    let targetRotY = 0, targetRotX = 0;
    let rotX = 0, rotY = 0;
    const onDown = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onUp = () => { dragging = false; };
    const onMove = (e) => {
      if (!dragging) return;
      targetRotY += (e.clientX - lastX) * 0.008;
      targetRotX += (e.clientY - lastY) * 0.008;
      targetRotX = Math.max(-0.4, Math.min(0.4, targetRotX));
      lastX = e.clientX; lastY = e.clientY;
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove);

    let raf;
    const animate = () => {
      if (pausedRef.current) {
        raf = requestAnimationFrame(animate);
        return;
      }
      if (stateRef.current.rotating) targetRotY += 0.004;
      // ease to target for smoothness
      rotY += (targetRotY - rotY) * 0.1;
      rotX += (targetRotX - rotX) * 0.1;
      bottleGroup.rotation.y = rotY;
      bottleGroup.rotation.x = rotX;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth;
      renderer.setSize(w, H);
      camera.aspect = w / H;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      pmrem.dispose();
      renderer.dispose();
    };
  }, [theme, accent, bodyColor, capColor]);

  React.useEffect(() => { stateRef.current.rotating = rotating; }, [rotating]);

  return (
    <div className="demo-body bottle">
      <div className="demo-hud">
        <div className="hud-group">
          <span className="mono tiny dim">BODY</span>
          <div className="swatches">
            {bodyColors.map(c => (
              <button key={c.hex} className={`sw ${bodyColor === c.hex ? 'on' : ''}`}
                style={{background: c.hex}} onClick={() => setBodyColor(c.hex)}
                title={c.name} />
            ))}
          </div>
        </div>
        <div className="hud-group right">
          <button className="hud-btn" onClick={() => setRotating(r => !r)}>
            {rotating ? 'PAUSE' : 'SPIN'}
          </button>
          <span className="mono tiny dim">DRAG TO ROTATE</span>
        </div>
      </div>
      <div ref={mountRef} style={{width: '100%', height: 380}} />
      <div className="demo-foot mono tiny dim">
        INSULATED · 750ML · ANODIZED STEEL · PRESS + DRAG
      </div>
    </div>
  );
}

window.BottleDemo = BottleDemo;
