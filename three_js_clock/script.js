import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const originalCameraPosition = new THREE.Vector3(0, 0, 10);
camera.position.copy(originalCameraPosition);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 7);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.rotateSpeed = 0.3;
controls.zoomSpeed = 0.8;
controls.minDistance = 5;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI / 2;
controls.minPolarAngle = Math.PI / 4;
controls.maxAzimuthAngle = Math.PI / 4;
controls.minAzimuthAngle = -Math.PI / 4;

let restoringCamera = false;

// Raycasting & interactions
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clockObjects = [];
const mixers = [];
let big_mixer = null;
let mainClock = null;
let selectedClock = null;
let isDragging = false;
let clickTimeout = null;
let dragPlane = new THREE.Plane(); // Create a plane for dragging

// GLTF loader
const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

// Load main clock
loader.load('/assets/clock_low_poly/scene.gltf', (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    if (gltf.animations.length > 0) {
        big_mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
            big_mixer.clipAction(clip).play();
        });
    }

    mainClock = new THREE.Group();
    mainClock.add(model);
    mainClock.scale.set(18, 18, 18);
    scene.add(mainClock);
    clockObjects.push(mainClock);
    addCircularImageTo(mainClock, '/assets/bahamut.png', 0.15, 0.015, 0);
});

// Add circular image
function addCircularImageTo(object, imagePath, size ,depth, adjust) {
    const circleGeometry = new THREE.CircleGeometry(size, 50);
    textureLoader.load(imagePath, (texture) => {
        const circleMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.position.set(0, 0.03 + adjust, depth);
        object.add(circle);
    });
}

// Create new clocks
function createNewClock(size, speed, adjust, imagePath) {
    loader.load('/assets/clock_low_poly/scene.gltf', (gltf) => {
        const model = gltf.scene;
        model.scale.set(size, size, size);
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        const clockGroup = new THREE.Group();
        clockGroup.add(model);

        // Calculate the radius of the new clock (including some padding)
        const newClockRadius = size + 1.5;
        
        // Define placement boundaries (smaller than the enforceBounds area)
        const bounds = {
            minX: -10 + newClockRadius,
            maxX: 10 - newClockRadius,
            minY: -5 + newClockRadius,
            maxY: 5 - newClockRadius
        };

        let positionFound = false;
        let bestPosition = null;
        let minOverlap = Infinity;
        const maxAttempts = 100;

        // Try to find a position with minimal overlap
        for (let attempts = 0; attempts < maxAttempts; attempts++) {
            const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
            const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
            
            let totalOverlap = 0;
            let anyOverlap = false;
            
            for (const obj of clockObjects) {
                const objRadius = obj === mainClock ? 3 : obj.scale.x;
                const dist = Math.sqrt(
                    Math.pow(obj.position.x - x, 2) + 
                    Math.pow(obj.position.y - y, 2)
                );
                const minDist = newClockRadius + objRadius;
                
                if (dist < minDist) {
                    anyOverlap = true;
                    totalOverlap += minDist - dist;
                }
            }
            
            // If no overlap, use this position immediately
            if (!anyOverlap) {
                clockGroup.position.set(x, y, 0);
                positionFound = true;
                break;
            }
            
            // Otherwise track the position with least overlap
            if (totalOverlap < minOverlap) {
                minOverlap = totalOverlap;
                bestPosition = { x, y };
            }
        }

        // If no perfect position found, use the best one we found
        if (!positionFound && bestPosition) {
            clockGroup.position.set(bestPosition.x, bestPosition.y, 0);
            positionFound = true;
        }

        // If still no position (unlikely), place at a random edge
        if (!positionFound) {
            const side = Math.floor(Math.random() * 4);
            switch(side) {
                case 0: // top
                    clockGroup.position.set(
                        bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
                        bounds.maxY,
                        0
                    );
                    break;
                case 1: // right
                    clockGroup.position.set(
                        bounds.maxX,
                        bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
                        0
                    );
                    break;
                case 2: // bottom
                    clockGroup.position.set(
                        bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
                        bounds.minY,
                        0
                    );
                    break;
                case 3: // left
                    clockGroup.position.set(
                        bounds.minX,
                        bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
                        0
                    );
                    break;
            }
        }

        addCircularImageTo(clockGroup, imagePath, 0.9, 0.10, adjust);

        const mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
            mixer.clipAction(clip).setDuration(speed).play();
        });
        mixers.push(mixer);

        scene.add(clockGroup);
        clockObjects.push(clockGroup);
        
        // Resolve any remaining overlaps
        resolveCollisions(clockGroup);
    });
}

// Create some clocks
createNewClock(7, 4, 0, '/assets/wwf.jpg');
createNewClock(5.2, 4, 0.1, '/assets/github_logo.png');
createNewClock(6, 4, 0.2, '/assets/symbiosis.png');

// Mouse events
// Add a flag to track if the mouse button is currently down
let isMouseDown = false;

document.addEventListener('mousedown', (e) => {
    if (e.target.closest('#card-overlay')) return;

    // Set mouse down flag
    isMouseDown = true;
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clockObjects, true);

    if (intersects.length > 0) {
        selectedClock = findParentGroup(intersects[0].object);
        
        // Create a drag plane aligned with the camera view
        dragPlane.setFromNormalAndCoplanarPoint(
            camera.getWorldDirection(new THREE.Vector3()).negate(),
            selectedClock.position
        );
        
        clickTimeout = setTimeout(() => {
            isDragging = true;
            controls.enabled = false;
        }, 150);
    }
    
    // Ensure restoringCamera is false while mouse is down
    restoringCamera = false;
});

// Helper function to find the parent group that's in clockObjects
function findParentGroup(object) {
    let current = object;
    while (current && !clockObjects.includes(current)) {
        current = current.parent;
    }
    return current;
}

document.addEventListener('mouseup', () => {
    clearTimeout(clickTimeout);
    
    // Update mouse down flag
    isMouseDown = false;

    if (isDragging) {
        isDragging = false;
        controls.enabled = true;
    }

    selectedClock = null;

    // Only now, trigger the camera reset
    restoringCamera = true;
});

function resolveCollisions(movedClock, depth = 0) {
    if (depth > 10) return; // prevent infinite recursion

    const movedRadius = movedClock === mainClock ? 3 : movedClock.scale.x;

    for (const other of clockObjects) {
        if (other === movedClock) continue;

        const otherRadius = other === mainClock ? 3 : other.scale.x;
        const dx = other.position.x - movedClock.position.x;
        const dy = other.position.y - movedClock.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = movedRadius + otherRadius + 0.5;

        if (distance < minDistance) {
            const angle = Math.atan2(dy, dx);
            const overlap = minDistance - distance;

            // Push the other clock outward
            other.position.x += Math.cos(angle) * overlap * 0.5;
            other.position.y += Math.sin(angle) * overlap * 0.5;

            enforceBounds(other); // ensure the clock stays within bounds
            resolveCollisions(other, depth + 1); // recursive chain push to handle nested collisions
        }
    }
}


function enforceBounds(clock) {
    const bounds = {
        minX: -12,
        maxX: 12,
        minY: -6,
        maxY: 6,
    };
    clock.position.x = Math.max(bounds.minX, Math.min(bounds.maxX, clock.position.x));
    clock.position.y = Math.max(bounds.minY, Math.min(bounds.maxY, clock.position.y));
}


document.addEventListener('mousemove', (e) => {
    if (!isDragging || !selectedClock) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, point);

    // Move selectedClock to the point
    selectedClock.position.x = point.x;
    selectedClock.position.y = point.y;
    enforceBounds(selectedClock);
    resolveCollisions(selectedClock);


    // Push other clocks if they collide
    for (const other of clockObjects) {
        if (other === selectedClock) continue;
    
        const dx = other.position.x - selectedClock.position.x;
        const dy = other.position.y - selectedClock.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
    
        // Use custom radii
        const selectedRadius = selectedClock === mainClock ? 3 : selectedClock.scale.x;
        const otherRadius = other === mainClock ? 3 : other.scale.x;
    
        const minDistance = selectedRadius + otherRadius + 0.5;
    
        if (distance < minDistance) {
            const angle = Math.atan2(dy, dx);
            const targetX = selectedClock.position.x + Math.cos(angle) * minDistance;
            const targetY = selectedClock.position.y + Math.sin(angle) * minDistance;
    
            other.position.x += (targetX - other.position.x) * 0.3;
            other.position.y += (targetY - other.position.y) * 0.3;
        }
    }
});

// Animate
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (big_mixer) big_mixer.update(delta * 0.05);
    mixers.forEach((m) => m.update(delta * 0.2));

    // Smooth camera reset ONLY when mouse is up and restoration is triggered
    if (restoringCamera && !isMouseDown) {
        camera.position.lerp(originalCameraPosition, 0.05);
        controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.05);
        if (camera.position.distanceTo(originalCameraPosition) < 0.01) {
            camera.position.copy(originalCameraPosition);
            controls.target.set(0, 0, 0);
            restoringCamera = false;
        }
    }

    controls.update();
    renderer.render(scene, camera);
}

animate();

// Optional: Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

//add a button to create new clocks
const createClockButton = document.createElement('button');
createClockButton.innerText = 'Create Clock';
createClockButton.style.position = 'absolute';
createClockButton.style.top = '10px';
createClockButton.style.right = '10px';
createClockButton.style.zIndex = 1000;
createClockButton.style.backgroundColor = 'white';
createClockButton.style.border = 'none';
createClockButton.style.padding = '10px';
createClockButton.style.cursor = 'pointer';
createClockButton.addEventListener('click', () => {
    createNewClock(7, 4, 0, '/assets/wwf.jpg');
});
document.body.appendChild(createClockButton);
