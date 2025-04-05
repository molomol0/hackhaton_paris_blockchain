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
let clockObjects = [];
const mixers = [];
let big_mixer = null;
let mainClock = null;
let selectedClock = null;
let isDragging = false;
let clickTimeout = null;
let dragPlane = new THREE.Plane();

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
function addCircularImageTo(object, imagePath, size, depth, adjust) {
    const circleGeometry = new THREE.CircleGeometry(size, 50);
    textureLoader.load(imagePath, (texture) => {
        const circleMaterial = new THREE.MeshBasicMaterial({ 
            map: texture, 
            side: THREE.DoubleSide, 
            transparent: true 
        });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.position.set(0, 0.03 + adjust, depth);
        // Remove this line: circle.rotation.x = Math.PI;
        object.add(circle);
    });
}

function saveClockToLocalStorage(clockGroup, size, speed, adjust, depth, imagePath) {
    const clockData = {
        position: clockGroup.position.toArray(),
        scale: [size, size, size], // Save the intended size, not current scale
        imagePath: imagePath,
        size: size, // The base size parameter
        depth: depth,
        adjust: adjust,
        speed: speed
    };

    let savedClocks = JSON.parse(localStorage.getItem('clocks')) || [];
    
    // Check for duplicates based on position and image
    const isDuplicate = savedClocks.some(savedClock => {
        return Math.abs(savedClock.position[0] - clockData.position[0]) < 0.1 &&
               Math.abs(savedClock.position[1] - clockData.position[1]) < 0.1 &&
               savedClock.imagePath === clockData.imagePath;
    });

    if (!isDuplicate) {
        savedClocks.push(clockData);
        localStorage.setItem('clocks', JSON.stringify(savedClocks));
    }
}

// Create new clocks
function createNewClock(size, speed, adjust, depth, imagePath) {
loader.load('/assets/clock_low_poly/scene.gltf', (gltf) => {
        const model = gltf.scene;
        model.scale.set(size, size, size);
        model.rotation.set(0, 0, 0); 
        model.scale.set(size, size, size);
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        const clockGroup = new THREE.Group();
        clockGroup.add(model);

        const newClockRadius = size + 1.5;
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

        // Check for overlap and find a suitable position
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

            if (!anyOverlap) {
                clockGroup.position.set(x, y, 0);
                positionFound = true;
                break;
            }

            if (totalOverlap < minOverlap) {
                minOverlap = totalOverlap;
                bestPosition = { x, y };
            }
        }

        if (!positionFound && bestPosition) {
            clockGroup.position.set(bestPosition.x, bestPosition.y, 0);
            positionFound = true;
        }

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

        addCircularImageTo(clockGroup, imagePath, 0.9, depth, adjust);

        const mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
            mixer.clipAction(clip).setDuration(speed).play();
        });
        mixers.push(mixer);

        // Save the clock to localStorage
        saveClockToLocalStorage(clockGroup, size, speed, adjust, depth, imagePath);

        scene.add(clockGroup);
        clockObjects.push(clockGroup);
        resolveCollisions(clockGroup);
    });
}



// Create initial clocks
// Replace the initial clock creation code with this:
// if (clockObjects.length < 4) {  // This check isn't sufficient
//     const savedClocks = JSON.parse(localStorage.getItem('clocks')) || [];
    
//     // Check if we need to create the default clocks
//     if (savedClocks.length === 0) {
//         createNewClock(7, 4, 0, 0.1, '/assets/wwf.jpg');
//         createNewClock(5.2, 4, 0.1, 0.08, '/assets/github_logo.png');
//         createNewClock(6, 4, 0.2, 0.09,'/assets/symbiosis.png');
//     }
// }

// Mouse events
let isMouseDown = false;
let clickStartTime = 0;

document.addEventListener('mousedown', (e) => {
    if (e.target.closest('#card-overlay')) return;

    isMouseDown = true;
    clickStartTime = Date.now();
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clockObjects, true);

    if (intersects.length > 0) {
        selectedClock = findParentGroup(intersects[0].object);
        dragPlane.setFromNormalAndCoplanarPoint(
            camera.getWorldDirection(new THREE.Vector3()).negate(),
            selectedClock.position
        );
        
        clickTimeout = setTimeout(() => {
            isDragging = true;
            controls.enabled = false;
        }, 150);
    }
    
    restoringCamera = false;
});

document.addEventListener('mouseup', (e) => {
    clearTimeout(clickTimeout);
    
    const clickDuration = Date.now() - clickStartTime;
    const isQuickClick = clickDuration < 200 && !isDragging;
    
    isMouseDown = false;

    if (isDragging) {
        isDragging = false;
        controls.enabled = true;
    } else if (isQuickClick && selectedClock) {
        showCard();
    }

    selectedClock = null;
    restoringCamera = true;
});

function findParentGroup(object) {
    let current = object;
    while (current && !clockObjects.includes(current)) {
        current = current.parent;
    }
    return current;
}

function resolveCollisions(movedClock, depth = 0) {
    if (depth > 10) return;

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

            other.position.x += Math.cos(angle) * overlap * 0.5;
            other.position.y += Math.sin(angle) * overlap * 0.5;

            enforceBounds(other);
            resolveCollisions(other, depth + 1);
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

    selectedClock.position.x = point.x;
    selectedClock.position.y = point.y;
    enforceBounds(selectedClock);
    resolveCollisions(selectedClock);

    for (const other of clockObjects) {
        if (other === selectedClock) continue;
    
        const dx = other.position.x - selectedClock.position.x;
        const dy = other.position.y - selectedClock.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
    
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

// Animation loop
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (big_mixer) big_mixer.update(delta * 0.05);
    mixers.forEach((m) => m.update(delta * 0.2));

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

// Window resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Card functions
function showCard() {
    document.getElementById("card-overlay").style.display = "block";
}

function hideCard() {
    document.getElementById("card-overlay").style.display = "none";
}

window.showCard = showCard;
window.hideCard = hideCard;

// Create clock button
// const createClockButton = document.createElement('button');
// createClockButton.innerText = 'Create Clock';
// createClockButton.style.position = 'absolute';
// createClockButton.style.top = '10px';
// createClockButton.style.right = '10px';
// createClockButton.style.zIndex = 1000;
// createClockButton.style.backgroundColor = 'white';
// createClockButton.style.border = 'none';
// createClockButton.style.padding = '10px';
// createClockButton.style.cursor = 'pointer';
// createClockButton.addEventListener('click', () => {
//     createNewClock(7, 4, 0, '/assets/wwf.jpg');
// });
// document.body.appendChild(createClockButton);

// document.getElementById('create-clock-button').addEventListener('click', () => {
//     createNewClock(7, 4, 0, '/assets/wwf.jpg');
// });

// Hide the scene on partner.html
if (window.location.pathname.includes('partner.html')) {
    renderer.domElement.style.display = 'none';
}


window.addEventListener('load', () => {
    if (window.location.pathname.includes('partner.html')) {
        // Hide the Three.js scene
        renderer.domElement.style.display = 'none';
        
        // Make createNewClock available globally
        window.createNewClock = createNewClock;
        
        // Add click handler for create button
        document.getElementById('create-clock-button')?.addEventListener('click', () => {
            console.log('Creating new clock...');
            createNewClock(7, 4, 0, 0.1, '/assets/wwf.jpg');
        });
    }
    
    // Clear existing clocks (except main clock)
    console.log(' number of clocks:', clockObjects.length);
    clockObjects.forEach(clock => {
        if (clock !== mainClock) {
            scene.remove(clock);
        }
    });
    clockObjects = mainClock ? [mainClock] : [];
    mixers.length = 0;

    const savedClocks = JSON.parse(localStorage.getItem('clocks')) || [];
    
    if (savedClocks.length === 0 && !window.location.pathname.includes('partner.html')) {
        // Create default clocks only if no saved clocks exist
        const defaultClocks = [
            { size: 7, speed: 4, adjust: 0, depth: 0.1, image: '/assets/wwf.jpg' },
            { size: 5.2, speed: 4, adjust: 0.1, depth: 0.08, image: '/assets/github_logo.png' },
            { size: 6, speed: 4, adjust: 0.2, depth: 0.09, image: '/assets/symbiosis.png' }
        ];

        defaultClocks.forEach(clock => {
            createNewClock(
                clock.size, 
                clock.speed, 
                clock.adjust, 
                clock.depth, 
                clock.image
            );
        });
    } else {
        // Load saved clocks with all correct properties
        savedClocks.forEach(clockData => {
            loader.load('/assets/clock_low_poly/scene.gltf', (gltf) => {
                const model = gltf.scene;
                
                // Fix rotation (add these lines)
                model.rotation.set(0, 0, 0); // Rotate 180 degrees around Y axis
                
                model.scale.set(clockData.size, clockData.size, clockData.size);
                // model.position.set(0, 0, 0); // Reset position relative to group
                
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                const clockGroup = new THREE.Group();
                clockGroup.add(model);
                clockGroup.position.set(...clockData.position);

                // Add image with correct parameters from storage
                addCircularImageTo(
                    clockGroup, 
                    clockData.imagePath, 
                    0.9, 
                    clockData.depth, 
                    clockData.adjust
                );
                
                const mixer = new THREE.AnimationMixer(model);
                gltf.animations.forEach((clip) => {
                    const action = mixer.clipAction(clip);
                    action.setDuration(clockData.speed).play();
                });
                mixers.push(mixer);

                scene.add(clockGroup);
                clockObjects.push(clockGroup);
                resolveCollisions(clockGroup);
            });
        });
    }
});

// Add this near the top of script.js
window.addEventListener('storage', function(event) {
    if (event.key === 'clocks') {
        // Instead of reloading, properly update the scene
        const savedClocks = JSON.parse(localStorage.getItem('clocks')) || [];
        
        // Remove all clocks except main clock
        clockObjects.forEach(clock => {
            if (clock !== mainClock) {
                scene.remove(clock);
            }
        });
        clockObjects = mainClock ? [mainClock] : [];
        mixers.length = 0;

        // Load the updated clocks
        savedClocks.forEach(clockData => {
            loader.load('/assets/clock_low_poly/scene.gltf', (gltf) => {
                const model = gltf.scene;
                model.rotation.set(0, 0, 0);
                model.scale.set(...clockData.scale);
                
                const clockGroup = new THREE.Group();
                clockGroup.add(model);
                clockGroup.position.set(...clockData.position);

                addCircularImageTo(
                    clockGroup, 
                    clockData.imagePath, 
                    0.9, 
                    clockData.depth, 
                    clockData.adjust
                );

                const mixer = new THREE.AnimationMixer(model);
                gltf.animations.forEach((clip) => {
                    mixer.clipAction(clip).setDuration(clockData.speed).play();
                });
                mixers.push(mixer);

                scene.add(clockGroup);
                clockObjects.push(clockGroup);
                resolveCollisions(clockGroup);
            });
        });
    }
});

document.getElementById('clearClocksButton').addEventListener('click', function() {
    // Clear the clocks from localStorage
    localStorage.removeItem('clocks');
    // Optionally, remove all the clocks from the scene
    clockObjects.forEach(clock => scene.remove(clock)); // Assuming clockObjects holds all the clock instances
    clockObjects = []; // Clear the array that holds clock references
    alert("Clocks have been cleared from localStorage.");
});
