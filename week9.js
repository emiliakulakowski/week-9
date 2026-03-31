import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.1/three.module.min.js';

let camera, scene, renderer;
let mouseX = 0, mouseY = 0;
let yaw = 0, pitch = 0;
const keys = {};

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
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('click', () => {
        document.body.requestPointerLock = document.body.requestPointerLock || document.body.mozRequestPointerLock;
        document.body.requestPointerLock();
    });
    document.addEventListener('mousemove', updateCamera);
    window.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });
    window.addEventListener('resize', onWindowResize);

    // Start animation loop
    animate();
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
        metalness: 0.2
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
    const leftSpotlight = new THREE.SpotLight(spotColor, 12);
    leftSpotlight.position.set(-5, 12, 5);
    leftSpotlight.target.position.set(-2, 0, 0);
    leftSpotlight.angle = Math.PI / 1.8;
    leftSpotlight.penumbra = 0.9;
    leftSpotlight.decay = 0.3;
    leftSpotlight.castShadow = true;
    group.add(leftSpotlight);
    group.add(leftSpotlight.target);

    // Right top spotlight
    const rightSpotlight = new THREE.SpotLight(spotColor, 12);
    rightSpotlight.position.set(5, 12, 5);
    rightSpotlight.target.position.set(2, 0, 0);
    rightSpotlight.angle = Math.PI / 1.8;
    rightSpotlight.penumbra = 0.9;
    rightSpotlight.decay = 0.3;
    rightSpotlight.castShadow = true;
    group.add(rightSpotlight);
    group.add(rightSpotlight.target);

    group.position.set(position.x, 10, position.z);
    scene.add(group);
}

function createLighting() {
    // Ambient light for visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

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
        spotlight.position.set(pos.x, 100, pos.z - 80);
        spotlight.target.position.set(pos.x, 15, pos.z);
        spotlight.angle = Math.PI / 5;
        spotlight.penumbra = 0.8;
        spotlight.decay = 2;
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
        const pointLight = new THREE.PointLight(lightColors[index], 0.8, 200);
        pointLight.position.set(pos.x, 30, pos.z);
        scene.add(pointLight);
    });
}

function onMouseMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
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

    // Handle movement
    const moveSpeed = 0.3;
    const moveDirection = new THREE.Vector3();

    if (keys['w']) {
        moveDirection.z -= moveSpeed;
    }
    if (keys['s']) {
        moveDirection.z += moveSpeed;
    }
    if (keys['a']) {
        moveDirection.x -= moveSpeed;
    }
    if (keys['d']) {
        moveDirection.x += moveSpeed;
    }

    // Apply rotation to movement direction
    moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    camera.position.add(moveDirection);

    // Keep camera above ground
    if (camera.position.y < 1) {
        camera.position.y = 1;
    }

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