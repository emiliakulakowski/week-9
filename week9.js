// THREE.js is now loaded globally via script tag
let camera, scene, renderer;
let yaw = 0, pitch = 0;

// Hand tracking variables
let hands = [];
let lastFewHands = []; // Smoothing buffer
let handX = 0.5, handY = 0.5; // Normalized hand position (0-1)
let handDepth = 0.5; // Hand depth from z3D
let handDetected = false; // Whether a hand is currently detected

// Initialize hand tracking with MediaPipe
function initializeHandTracking() {
    const statusEl = document.getElementById('status');
    const video = document.getElementById('webcam-video');
    const overlayCanvas = document.getElementById('hand-overlay');
    
    statusEl.textContent = 'Requesting webcam access...';

    navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 } }, 
        audio: false 
    })
    .then(stream => {
        video.srcObject = stream;
        video.play();
        statusEl.textContent = 'Webcam ready. Loading hand detection model...';
        initMediaPipe(video, overlayCanvas);
    })
    .catch(err => {
        console.error('Webcam access denied:', err);
        statusEl.textContent = 'Error: Webcam access denied';
        statusEl.style.color = '#ff0000';
    });
}

function initMediaPipe(video, overlayCanvas) {
    const mediapipeHands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    mediapipeHands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
    });

    mediapipeHands.onResults((results) => onHandResults(results, overlayCanvas));

    const camera = new Camera(video, {
        onFrame: async () => {
            await mediapipeHands.send({ image: video });
        },
        width: 640,
        height: 480
    });
    
    camera.start();
    
    const statusEl = document.getElementById('status');
    statusEl.textContent = 'Ready! Show your hand to the camera.';
    statusEl.style.color = '#00ff00';
    console.log('MediaPipe hands initialized');
}

function onHandResults(results, overlayCanvas) {
    overlayCanvas.width = overlayCanvas.offsetWidth;
    overlayCanvas.height = overlayCanvas.offsetHeight;
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    hands = results.multiHandLandmarks || [];

    if (hands.length === 0) {
        handDetected = false;
        handX = 0.5;
        handY = 0.5;
        handDepth = 0.5;
        return;
    }

    // Analyze first hand for movement
    const landmarks = hands[0];
    if (landmarks) {
        drawHandOverlay(landmarks, ctx, overlayCanvas.width, overlayCanvas.height);
        analyzeHandPosition(landmarks);
    }
}

function drawHandOverlay(landmarks, ctx, w, h) {
    const connections = [
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [5,9],[9,10],[10,11],[11,12],
        [9,13],[13,14],[14,15],[15,16],
        [13,17],[17,18],[18,19],[19,20],[0,17]
    ];

    ctx.strokeStyle = 'rgba(100,200,255,0.6)';
    ctx.lineWidth = 2;
    connections.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
        ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
        ctx.stroke();
    });

    landmarks.forEach((lm, i) => {
        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, i === 0 ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? 'rgba(255,200,100,0.9)' : 'rgba(100,220,255,0.85)';
        ctx.fill();
    });
}

function analyzeHandPosition(landmarks) {
    // Get index finger tip (landmark 8)
    const indexTip = landmarks[8];
    
    // Normalize hand position to 0-1 (video is 640x480)
    let x = indexTip.x;  // Already normalized to 0-1
    let y = indexTip.y;  // Already normalized to 0-1
    
    // Use z for depth
    let z = indexTip.z || 0;
    
    // MediaPipe z uses a small range (typically -0.2 to 0.2)
    // Amplify by 5x to get meaningful movement, then shift to 0-1 range
    // where 0 = far (backward), 0.5 = neutral, 1 = close (forward)
    let depth = Math.max(0, Math.min(1, 0.5 - z * 5));
    
    console.log('Raw z:', z.toFixed(3), '| Amplified depth:', depth.toFixed(3), '| handDepth smoothed:', handDepth.toFixed(3));
    
    // Apply smoothing
    const mouseData = { x, y, z: depth };
    updateHandSmoothing(mouseData);
    
    handDetected = true;
}

// Initialize scene
function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.005);

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3.5, 0);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Create environment
    createInfiniteGround();
    createForest();
    createDoors();
    createLighting();
    createDustParticles();

    // Event listeners
    window.addEventListener('resize', onWindowResize);

    // Initialize hand tracking
    initializeHandTracking();

    // Start animation loop
    animate();
}

function gotHands(results) {
    hands = results;
    
    if (!hands || hands.length === 0) {
        handDetected = false;
        handX = 0.5;
        handY = 0.5;
        handDepth = 0.5;
        return;
    }
    
    const hand = hands[0];
    
    if (!hand.keypoints || hand.keypoints.length < 9) {
        handDetected = false;
        return;
    }
    
    // Get index finger tip (keypoint 8)
    const indexTip = hand.keypoints[8];
    
    if (!indexTip || indexTip.x === undefined || indexTip.y === undefined) {
        handDetected = false;
        return;
    }
    
    // Normalize hand position to 0-1
    let x = indexTip.x / 200;  // p5 canvas is 200px wide
    let y = indexTip.y / 150;  // p5 canvas is 150px tall
    
    // Clamp to valid range
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    
    // Use z for depth
    let z = indexTip.z || 0;
    // Normalize depth: negative z = closer, more positive = farther
    // z typically ranges from -0.5 (close) to 0.5 (far)
    let depth = Math.max(0, Math.min(1, 0.5 - z));  // invert so close = 1, far = 0
    
    console.log('Hand detected at x:', x.toFixed(2), 'y:', y.toFixed(2), 'depth:', depth.toFixed(2));
    
    // Apply smoothing
    const mouseData = { x, y, z: depth };
    updateHandSmoothing(mouseData);
    
    handDetected = true;
}

function updateHandSmoothing(mouse) {
    // Average last few hand positions for smoothness
    lastFewHands.push(mouse);
    if (lastFewHands.length > 5) {
        lastFewHands.shift(); // Remove oldest
    }
    
    let xTotal = 0, yTotal = 0, zTotal = 0;
    for (let i = 0; i < lastFewHands.length; i++) {
        xTotal += lastFewHands[i].x;
        yTotal += lastFewHands[i].y;
        zTotal += lastFewHands[i].z;
    }
    
    handX = xTotal / lastFewHands.length;
    handY = yTotal / lastFewHands.length;
    handDepth = zTotal / lastFewHands.length;
}

function updateCameraFromHand() {
    // ABSOLUTE REQUIREMENT: If no hand detected, ZERO movement
    if (!handDetected) {
        return; // Completely stop any movement
    }
    
    // Direct position-based movement and rotation
    // handX: 0 = left, 0.5 = center, 1 = right
    // handDepth: 0 = far (backward), 0.5 = neutral, 1 = close (forward)
    
    const slowMoveSpeed = 0.2; // Slow movement speed
    
    // Turning based on hand X position
    // Hand at left = turn sharp left, hand at right = turn sharp right
    const targetYaw = (handX - 0.5) * Math.PI * 2; // Range: -π to π
    yaw += (targetYaw - yaw) * 0.15; // Smooth rotation
    
    // Update camera rotation
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch; // Keep pitch at 0
    
    // Forward/backward movement based on hand depth
    // Close to camera (depth 1) = move forward
    // Far from camera (depth 0) = move backward
    // Neutral (depth 0.5) = don't move forward/backward
    
    // Calculate movement intensity: close=positive (forward), far=negative (backward)
    const depthDifference = handDepth - 0.5; // Range: -0.5 to 0.5
    const forwardIntensity = depthDifference * 2; // Scale to -1 to 1
    
    // Debug log only when there's significant movement
    if (Math.abs(forwardIntensity) > 0.01) {
        console.log('MOVING - handX:', handX.toFixed(2), 'handDepth:', handDepth.toFixed(2), 'intensity:', forwardIntensity.toFixed(2));
    }
    
    // Create movement vector (negative Z is forward in THREE.js camera coords)
    const moveDirection = new THREE.Vector3(
        0,
        0,
        -forwardIntensity * slowMoveSpeed
    );
    
    // Apply yaw rotation to movement direction so player moves in the direction they're facing
    moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    camera.position.add(moveDirection);
    
    // Keep camera above ground
    if (camera.position.y < 1) {
        camera.position.y = 1;
    }
}

function createInfiniteGround() {
    const geometry = new THREE.PlaneGeometry(2000, 2000);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0x0f0f0f,
        roughness: 0.95,
        metalness: 0.0
    });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);
}

function createForest() {
    const spawnTreeCount = 20;
    const spawnRadius = 20; // close to player

   for (let i = 0; i < spawnTreeCount; i++) {
    const angle = (i / spawnTreeCount) * Math.PI * 2;
    
    // Add randomness so it feels natural
    const radius = spawnRadius + (Math.random() * 8 - 4);
    
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    // Slight gaps so player isn't trapped
    if (Math.random() > 0.15) {
        const scale = 1.2 + Math.random() * 0.6;
        createTree({ x, z }, scale);
    }
   }
    // Define door positions to avoid
    const doorPositions = [
        { x: -60, z: -150 },
        { x: 0, z: -150 },
        { x: 60, z: -150 }
    ];
    const doorExclusionRadius = 80;
    
    // Helper function to check if a position is too close to any door
    const isTooCloseToaDoor = (x, z) => {
        return doorPositions.some(door => {
            const distance = Math.sqrt((x - door.x) ** 2 + (z - door.z) ** 2);
            return distance < doorExclusionRadius;
        });
    };
    
    // Create a dense forest surrounding the scene with giant trees at multiple distances
    
    // Inner ring - close to spawn point
    const innerTreeCount = 30;
    const innerRadius = 50;
    for (let i = 0; i < innerTreeCount; i++) {
        const angle = (i / innerTreeCount) * Math.PI * 2;
        const randomRadius = innerRadius + Math.random() * 30;
        const x = Math.cos(angle) * randomRadius;
        const z = Math.sin(angle) * randomRadius;
        // Skip trees too close to doors
        if (!isTooCloseToaDoor(x, z)) {
            const treeScale = 1.2 + Math.random() * 0.8;
            createTree({ x, z }, treeScale);
        }
    }
    
    // Middle ring
    const middleTreeCount = 40;
    const middleRadius = 120;
    for (let i = 0; i < middleTreeCount; i++) {
        const angle = (i / middleTreeCount) * Math.PI * 2;
        const randomRadius = middleRadius + Math.random() * 50;
        const x = Math.cos(angle) * randomRadius;
        const z = Math.sin(angle) * randomRadius;
        // Skip trees too close to doors
        if (!isTooCloseToaDoor(x, z)) {
            const treeScale = 1.5 + Math.random() * 1.0;
            createTree({ x, z }, treeScale);
        }
    }
    
    // Outer ring - far away
    const outerTreeCount = 50;
    const outerRadius = 250;
    for (let i = 0; i < outerTreeCount; i++) {
        const angle = (i / outerTreeCount) * Math.PI * 2;
        const randomRadius = outerRadius + Math.random() * 100;
        const x = Math.cos(angle) * randomRadius;
        const z = Math.sin(angle) * randomRadius;
        // Skip trees too close to doors
        if (!isTooCloseToaDoor(x, z)) {
            const treeScale = 1.6 + Math.random() * 1.2;
            createTree({ x, z }, treeScale);
        }
    }
}

function createTree(position, scale) {
    const group = new THREE.Group();
    
    // Tree trunk (tall cylinder)
    const trunkGeometry = new THREE.CylinderGeometry(6 * scale, 8 * scale, 80 * scale, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
        color: 0x3d2817,
        roughness: 0.9,
        metalness: 0.0
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 40 * scale;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);
    
    // Tree foliage (multiple cones stacked)
    const foliageMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a3d1a,
        roughness: 0.8,
        metalness: 0.0
    });
    
    // Large main foliage cone
    const foliageGeometry1 = new THREE.ConeGeometry(50 * scale, 60 * scale, 16);
    const foliage1 = new THREE.Mesh(foliageGeometry1, foliageMaterial);
    foliage1.position.y = 90 * scale;
    foliage1.castShadow = true;
    foliage1.receiveShadow = true;
    group.add(foliage1);
    
    // Middle foliage cone
    const foliageGeometry2 = new THREE.ConeGeometry(40 * scale, 50 * scale, 16);
    const foliage2 = new THREE.Mesh(foliageGeometry2, foliageMaterial);
    foliage2.position.y = 115 * scale;
    foliage2.castShadow = true;
    foliage2.receiveShadow = true;
    group.add(foliage2);
    
    // Top foliage cone
    const foliageGeometry3 = new THREE.ConeGeometry(30 * scale, 40 * scale, 16);
    const foliage3 = new THREE.Mesh(foliageGeometry3, foliageMaterial);
    foliage3.position.y = 135 * scale;
    foliage3.castShadow = true;
    foliage3.receiveShadow = true;
    group.add(foliage3);
    
    group.position.set(position.x, 0, position.z);
    scene.add(group);
}

function createDoors() {
    const doorPositions = [
        { x: -60, z: -150 },
        { x: 0, z: -150 },
        { x: 60, z: -150 }
    ];

    const doorColors = [
        { r: 0.6, g: 0.1, b: 0.1 },   // Red
        { r: 0.7, g: 0.5, b: 0.1 },   // Yellow/Brown
        { r: 0.5, g: 0.3, b: 0.1 }    // Brown
    ];

    doorPositions.forEach((pos, index) => {
        createDoor(pos, doorColors[index]);
    });
}

function createDoor(position, color) {
    const group = new THREE.Group();
    
    // Door frame material
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.7,
        metalness: 0.2,
        emissive: new THREE.Color(color.r, color.g, color.b),
        emissiveIntensity: 1
    });

    // Door body
    const doorGeometry = new THREE.BoxGeometry(7, 20, 2);
    const doorMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color.r, color.g, color.b),
        roughness: 0.5,
        metalness: 0.1
    });

    const doorBody = new THREE.Mesh(doorGeometry, doorMaterial);
    doorBody.castShadow = true;
    doorBody.receiveShadow = true;
    group.add(doorBody);

    // Door frame outline
    const frameThickness = 1;
    const frameWidth = 7 + frameThickness * 2;
    const frameHeight = 20 + frameThickness * 2;

    // Vertical frame pieces
    const vertFrameGeom = new THREE.BoxGeometry(frameThickness, frameHeight, 2);
    const leftFrame = new THREE.Mesh(vertFrameGeom, frameMaterial);
    leftFrame.position.x = -frameWidth / 2;
    leftFrame.castShadow = true;
    group.add(leftFrame);

    const rightFrame = new THREE.Mesh(vertFrameGeom, frameMaterial);
    rightFrame.position.x = frameWidth / 2;
    rightFrame.castShadow = true;
    group.add(rightFrame);

    // Horizontal frame piece
    const horzFrameGeom = new THREE.BoxGeometry(frameWidth, frameThickness, 2);
    const topFrame = new THREE.Mesh(horzFrameGeom, frameMaterial);
    topFrame.position.y = frameHeight / 2;
    topFrame.castShadow = true;
    group.add(topFrame);

    // Add vertical stripe details
    const stripeGeometry = new THREE.BoxGeometry(0.5, 15, 0.3);
    const stripeMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color.r * 0.5, color.g * 0.5, color.b * 0.5),
        roughness: 0.7
    });

    for (let i = -1; i <= 1; i++) {
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe.position.x = i * 2;
        stripe.position.z = 1.2;
        stripe.castShadow = true;
        group.add(stripe);
    }

    // Door handle
    const handleGeometry = new THREE.CylinderGeometry(1, 1, 1);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a3a3a,
        roughness: 0.4,
        metalness: 0.5
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(2.5, -3, 2.5);
    handle.castShadow = true;
    group.add(handle);

    // Add spotlights on the door frame (top corners)
    const spotColor = new THREE.Color(color.r, color.g, color.b);
    
    // Left top spotlight
    const leftSpotlight = new THREE.SpotLight(spotColor, 3);
    leftSpotlight.position.set(-5, 12, 5);
    leftSpotlight.target.position.set(-2, 0, 0);
    leftSpotlight.angle = Math.PI / 8;
    leftSpotlight.penumbra = 0.5;
    leftSpotlight.decay = 2.5;
    leftSpotlight.castShadow = true;
    group.add(leftSpotlight);
    group.add(leftSpotlight.target);

    // Right top spotlight
    const rightSpotlight = new THREE.SpotLight(spotColor, 3);
    rightSpotlight.position.set(5, 12, 5);
    rightSpotlight.target.position.set(2, 0, 0);
    rightSpotlight.angle = Math.PI / 8;
    rightSpotlight.penumbra = 0.5;
    rightSpotlight.decay = 2.5;
    rightSpotlight.castShadow = true;
    group.add(rightSpotlight);
    group.add(rightSpotlight.target);

    group.position.set(position.x, 10, position.z);
    scene.add(group);
}

function createLighting() {
    // Ambient light for visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.03);
   scene.add(ambientLight);

//    const fillLight = new THREE.PointLight(lightColors[index], 0.6, 30);
//    fillLight.position.set(pos.x, 10, pos.z + 5);
//    scene.add(fillLight);

    // Ominous spotlights on doors
    const spotlightPositions = [
        { x: -60, z: -150 },
        { x: 0, z: -150 },
        { x: 60, z: -150 }
    ];

    const lightColors = [
        0xff3333,  // Red
        0xffaa33,  // Orange/Yellow
        0xaa6633   // Brown
    ];

    spotlightPositions.forEach((pos, index) => {
        const spotlight = new THREE.SpotLight(lightColors[index], 2);
        spotlight.position.set(pos.x, 40, pos.z - 20);
        spotlight.target.position.set(pos.x, 15, pos.z);
        spotlight.angle = Math.PI / 12;
        spotlight.penumbra = 0.2;
       spotlight.distance = 100;         // shorter reach
       spotlight.decay = 2;              // realistic falloff
       spotlight.intensity = 2.5;        // brighter, but controlled
        spotlight.castShadow = true;
        spotlight.shadow.mapSize.width = 2048;
        spotlight.shadow.mapSize.height = 2048;
        scene.add(spotlight);
        scene.add(spotlight.target);
    });

    // Add some eerie point lights near the doors
    const pointLightPositions = [
        { x: -60, z: -150 },
        { x: 0, z: -150 },
        { x: 60, z: -150 }
    ];

    pointLightPositions.forEach((pos, index) => {
        const pointLight = new THREE.PointLight(lightColors[index], 0.3, 60);
        pointLight.position.set(pos.x, 30, pos.z);
        scene.add(pointLight);
    });
}

function createDustParticles() {
    // Create dust particle geometry
    const dustGeometry = new THREE.BufferGeometry();
    const particleCount = 2000;
    const positions = new Float32Array(particleCount * 3);
    
    // Generate random positions for dust particles
    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 400;      // x
        positions[i + 1] = Math.random() * 80;             // y
        positions[i + 2] = (Math.random() - 0.5) * 400;   // z
    }
    
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Create particle material
    const dustMaterial = new THREE.PointsMaterial({
        color: 0xcccccc,
        size: 0.3,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.3
    });
    
    // Create dust particle system
    const dustParticles = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dustParticles);
}

function updateCamera(event) {
    if (document.pointerLockElement === document.body) {
        yaw -= event.movementX * 0.003;
        pitch -= event.movementY * 0.003;

        // Clamp pitch to prevent camera flipping
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

        // Update camera rotation using Euler angles
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
    }
}

function animate() {
    requestAnimationFrame(animate);

    // Update camera from hand tracking (includes movement)
    updateCameraFromHand();

    renderer.render(scene, camera);
}

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
}

// Start the application
init();