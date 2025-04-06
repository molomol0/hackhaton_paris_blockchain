import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const originalCameraPosition = new THREE.Vector3(0, 0, 10);
camera.position.copy(originalCameraPosition);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
cssRenderer.domElement.style.position = 'absolute';
cssRenderer.domElement.style.top = '0';
cssRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(cssRenderer.domElement);

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

// Clock metadata structure
class ClockMetadata {
    constructor(id, owner, time, size, speed, adjust, depth, imagePath) {
        this.id = id;
        this.owner = owner;
        this.time = time;
        this.click = 0;
        this.size = size;
        this.speed = speed;
        this.adjust = adjust;
        this.depth = depth;
        this.imagePath = imagePath;
        this.position = [0, 0, 0];
        this.originalSize = size; // Store original size
        this.isCritical = false; // Track critical state
    }
}

// Add these near your other global variables
let clockIds = [];
let clockMetadataMap = new Map(); // Maps clock IDs to their metadata
let nextClockId = 1; // Auto-incrementing ID counter

// Load main clock
// In the main clock loader:
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
    mainClock.userData.id = 0; // Add this line to give mainClock an ID
    mainClock.add(model);
    mainClock.scale.set(18, 18, 18);
    scene.add(mainClock);
    clockObjects.push(mainClock);
    createTimeDisplay(mainClock, 200000, 0.015);
    updateTimeDisplay(mainClock, 200000);

    // Create and store metadata for main clock
    const metadata = new ClockMetadata(0, "system", 200000, 18, 1, 0, 0.015, '/assets/bahamut.png');
    clockMetadataMap.set(0, metadata);
    clockIds.push(0);

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
        object.add(circle);
    });
}

function saveClockToLocalStorage(clockGroup, size, speed, adjust, depth, imagePath, owner, time) {
    const id = clockGroup.userData.id;
    if (id === undefined) {
        console.error("Trying to save clock with undefined ID:", clockGroup);
        return;
    }
    const clockData = {
        id: id,
        position: clockGroup.position.toArray(),
        scale: [size, size, size],
        imagePath: imagePath,
        size: size,
        depth: depth,
        adjust: adjust,
        speed: speed,
        owner: owner,
        time: time
    };

    let savedClocks = JSON.parse(localStorage.getItem('clocks')) || [];

    // Check for duplicates based on ID
    const existingIndex = savedClocks.findIndex(c => c.id === id);
    if (existingIndex >= 0) {
        savedClocks[existingIndex] = clockData;
    } else {
        savedClocks.push(clockData);
    }

    localStorage.setItem('clocks', JSON.stringify(savedClocks));
}

// Create new clocks
function createNewClock(size, speed, adjust, depth, imagePath, owner = "default", initialTime = 0) {
    return new Promise((resolve) => {
        const id = nextClockId++; // Move this outside the loader callback
        console.log(`Creating clock with ID: ${id}`); // Debug log

        loader.load('/assets/clock_low_poly/scene.gltf', (gltf) => {
            const model = gltf.scene;
            model.scale.set(size, size, size);
            model.rotation.set(0, 0, 0);

            const clockGroup = new THREE.Group();
            clockGroup.userData.id = id; // Assign the ID
            console.log(`Clock group created with ID: ${clockGroup.userData.id}`); // Debug log

            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            clockGroup.add(model);

            const metadata = new ClockMetadata(id, owner, initialTime, size, speed, adjust, depth, imagePath);
            clockMetadataMap.set(id, metadata);
            clockIds.push(id);

            const newClockRadius = size + 1.5;
            const bounds = {
                minX: -10 + newClockRadius,
                maxX: 10 - newClockRadius,
                minY: -5 + newClockRadius,
                maxY: 5 - newClockRadius
            };

            let positionFound = false;
            let bestPosition = null;// After creating mainClock:
            //createTimeDisplay(mainClock, 200000, 0.015);
            updateTimeDisplay(mainClock, 200000, true); // Make it transparent
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
                switch (side) {
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
            createTimeDisplay(clockGroup, initialTime, depth);

            const mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach((clip) => {
                mixer.clipAction(clip).setDuration(speed).play();
            });
            mixers.push(mixer);

            // Update metadata with final position
            metadata.position = clockGroup.position.toArray();

            // Save the clock to localStorage
            saveClockToLocalStorage(clockGroup, size, speed, adjust, depth, imagePath, owner, initialTime);

            scene.add(clockGroup);
            clockObjects.push(clockGroup);
            resolveCollisions(clockGroup);

            resolve(id); // Return the ID through the Promise
        });
    });
}// Get all clock IDs

function getAllClockIds() {
    return clockIds;
}

// Get clock metadata by ID
function getClockMetadata(id) {
    return clockMetadataMap.get(id);
}

// Update time for a specific clock
function updateTime(id, newTime) {
    const metadata = clockMetadataMap.get(id);
    if (metadata) {
        metadata.time = newTime;

        // Update in localStorage
        let savedClocks = JSON.parse(localStorage.getItem('clocks')) || [];
        const index = savedClocks.findIndex(c => c.id === id);
        if (index >= 0) {
            savedClocks[index].time = newTime;
            localStorage.setItem('clocks', JSON.stringify(savedClocks));
        }
    }
}

// Get clock by ID
function getClockById(id) {
    return clockObjects.find(clock => clock.userData.id === id);
}
// Modified createTimeDisplay function with null checks
function createTimeDisplay(clockGroup, initialTime = 0, depth = 0) {
    // First, check if clockGroup exists
    if (!clockGroup) {
        console.error("Cannot create time display - clockGroup is null");
        return null;
    }

    // Initialize userData if it doesn't exist
    if (!clockGroup.userData) {
        clockGroup.userData = {};
    }

    const isMainClock = clockGroup.userData.id === 0;

    // Create canvas with appropriate size
    const canvas = document.createElement('canvas');
    const width = isMainClock ? 10000 : 400;
    const height = isMainClock ? 3000 : 100;
    canvas.width = width;
    canvas.height = height;

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    if (renderer.capabilities) {
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }

    // Create plane
    const planeWidth = isMainClock ? 1.5 : 2.0;
    const planeHeight = isMainClock ? 0.4 : 0.5;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.95,
        depthTest: false
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, isMainClock ? 0 : -0.1, isMainClock ? depth + 0.025 : depth + 0.2);

    // Store references safely
    clockGroup.userData.timeDisplay = {
        canvas: canvas,
        plane: plane,
        texture: texture,
        ctx: canvas.getContext('2d'),
        isMainClock: isMainClock,
        width: width,
        height: height
    };

    // Initial render
    updateTimeDisplay(clockGroup, initialTime);

    // Safely add to clock group
    if (clockGroup instanceof THREE.Object3D) {
        clockGroup.add(plane);
    } else {
        console.error("clockGroup is not a valid THREE.Object3D", clockGroup);
    }

    return plane;
}

// Modified updateTimeDisplay with null checks
function updateTimeDisplay(clockGroup, time) {
    if (!clockGroup || !clockGroup.userData || !clockGroup.userData.timeDisplay) {
        console.error("Cannot update time display - invalid clockGroup or missing timeDisplay");
        return;
    }

    const { canvas, ctx, texture, isMainClock, width, height } = clockGroup.userData.timeDisplay;
    const formattedTime = formatTime(time);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set text properties - change color if critical
    const fontSize = isMainClock ? 400 : 48;
    ctx.font = `bold ${fontSize}px 'Arial', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Change color to flashing red if time is critical
    const metadata = clockMetadataMap.get(clockGroup.userData.id);
    const isCritical = metadata && metadata.time <= 30;

    if (isCritical) {
        console.log("Critical time detected for clock ID:", clockGroup.userData.id);
        // Flashing effect
        const flashSpeed = 10;
        const flashIntensity = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * flashSpeed);
        ctx.fillStyle = `rgba(255, ${Math.floor(100 * flashIntensity)}, ${Math.floor(100 * flashIntensity)}, 0.9)`;
    } else {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
    }

    // Draw text
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 6;
    ctx.strokeText(formattedTime, width / 2, height / 2);
    ctx.fillText(formattedTime, width / 2, height / 2);

    // Make sure the texture updates
    texture.needsUpdate = true;
}

function updateCriticalAnimation(clockGroup, delta) {
    if (!clockGroup.userData?.id) return;

    const metadata = clockMetadataMap.get(clockGroup.userData.id);
    if (!metadata) return;

    // Check if time is critical (below 30 seconds)
    const isNowCritical = metadata.time <= 30;

    // Only proceed if state changed or we're in critical mode
    if (isNowCritical || metadata.isCritical) {
        metadata.isCritical = isNowCritical;

        if (isNowCritical) {
            // Calculate pulse effect (0.8-1.2 of original size)
            const clockScale = 0.3;
            
            // Create a reference to the timeDisplay object and its context
            const timeDisplay = clockGroup.userData.timeDisplay;
            if (timeDisplay) {
                const ctx = timeDisplay.ctx;
                const width = timeDisplay.width;
                const height = timeDisplay.height;
                
                // Clear the canvas completely first
                ctx.clearRect(0, 0, width + 20, height + 20);
                
                // make the timer font pulse
                const fontSize = 48 + 20 * Math.sin(clock.getElapsedTime() * 5);
                ctx.font = `bold ${fontSize}px 'Arial', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.lineWidth = 6;
                
                // Draw the time with the formatted value
                const formattedTime = formatTime(metadata.time);
                ctx.strokeText(formattedTime, width / 2, height / 2);
                ctx.fillText(formattedTime, width / 2, height / 2);
                
                timeDisplay.texture.needsUpdate = true;
            }

            // Apply pulsing effect
            clockGroup.scale.set(
                metadata.originalSize * clockScale,
                metadata.originalSize * clockScale,
                metadata.originalSize * clockScale
            );

            // Add slight random rotation for shiver effect
            clockGroup.rotation.z = (Math.random() - 0.5) * 0.1;
            clockGroup.rotation.x = (Math.random() - 0.5) * 0.1;
        } else {
            // Reset to normal when no longer critical
            clockGroup.scale.set(
                metadata.originalSize,
                metadata.originalSize,
                metadata.originalSize
            );
            clockGroup.rotation.set(0, 0, 0);
        }
    }
}

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

    // Check if the intersection is the timer canvas
    if (intersects.length > 0 && intersects[0].object.userData.isTimerCanvas) {
        return; // Don't allow drag if the intersected object is the timer canvas
    }

    // Proceed with the rest of the logic for moving clocks
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

const clock = new THREE.Clock();
// Animation loop
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // Update all clocks' critical animations
    clockObjects.forEach(clock => {
        updateCriticalAnimation(clock, delta);

    });

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
    cssRenderer.render(scene, camera);
}

animate();

// Window resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    cssRenderer.setSize(window.innerWidth, window.innerHeight);
});

// Card functions
function showCard() {
    // Show the card overlay
    const cardOverlay = document.getElementById("card-overlay");
    cardOverlay.style.display = "block";

    // Only proceed if we have a selected clock
    if (!selectedClock) return;

    // Get the clock's metadata
    const clockId = selectedClock.userData?.id;
    const metadata = getClockMetadata(clockId);

    // If no metadata found, return
    if (!metadata) return;

    // Update the card elements
    const card = document.querySelector('.profile-card');

    // Get the use ticket button
    const useTicketButton = document.getElementById('use-ticket-button');

    // Si c'est l'horloge principale (ID 0), configurer le gestionnaire du bouton Use Ticket
    if (clockId === 0) {
        useTicketButton.style.display = 'block'; // Afficher le bouton

        // Supprimer les gestionnaires d'événements existants
        const newUseTicketButton = useTicketButton.cloneNode(true);
        useTicketButton.parentNode.replaceChild(newUseTicketButton, useTicketButton);

        // Mettre à jour le texte du bouton pour afficher le prix
        async function updateButtonText() {
            try {
                if (window.contract) {
                    // Récupérer le prix du ticket depuis le smart contract
                    const ticketPrice = await window.contract.ticketPrice();
                    const formattedPrice = window.ethers ? window.ethers.utils.formatEther(ticketPrice) : ticketPrice.toString();
                    // Mettre à jour le texte du bouton avec le prix
                    newUseTicketButton.textContent = `Utiliser un ticket (${formattedPrice} FTN)`;
                } else {
                    console.warn('Contrat non disponible, utilisation du texte par défaut');
                    newUseTicketButton.textContent = 'Utiliser un ticket';
                }
            } catch (error) {
                console.error('Erreur lors de la récupération du prix du ticket:', error);
                newUseTicketButton.textContent = 'Utiliser un ticket';
            }
        }
        
        // Appeler la fonction pour mettre à jour le texte
        updateButtonText();

        // Ajouter un nouveau gestionnaire d'événements
        newUseTicketButton.addEventListener('click', function () {
            // Participer à l'horloge 1
            if (typeof window.recordParticipation === 'function') {
                window.recordParticipation(1);
            } else {
                console.error("La fonction recordParticipation n'est pas disponible");
                alert("Erreur: Connexion au portefeuille non établie");
            }
        });
    } else {
        // Pour les autres horloges, on cache le bouton Use Ticket
        useTicketButton.style.display = 'none';
    }

    // Update owner name
    const nameElement = card.querySelector('.name');
    nameElement.textContent = metadata.owner || "Unknown Owner";

    // Update time in HH:MM:SS format
    const jobElement = card.querySelector('.job');
    jobElement.textContent = formatTime(metadata.time);

    // Update profile image if available
    const imgElement = card.querySelector('.profile-img');
    if (metadata.imagePath) {
        imgElement.src = metadata.imagePath;
    }

    // Créer ou récupérer l'élément pour afficher le nombre de tickets
    let ticketCountElement = document.getElementById('ticket-count');
    if (!ticketCountElement) {
        ticketCountElement = document.createElement('div');
        ticketCountElement.id = 'ticket-count';
        ticketCountElement.className = 'ticket-count';
        ticketCountElement.style.margin = '10px 0';
        ticketCountElement.style.fontWeight = 'bold';
        ticketCountElement.style.textAlign = 'center';
        card.appendChild(ticketCountElement);
    }

    // Mettre à jour le nombre de tickets
    async function updateTicketCount() {
        try {
            if (window.contract) {
                // Récupérer les infos de l'horloge 1 depuis le smart contract
                const clockInfo = await window.contract.clocks(1);
                
                // Convertir la valeur en divisant par 10^18 (wei -> ether)
                const ticketCount = window.ethers 
                    ? parseFloat(window.ethers.utils.formatEther(clockInfo.prize)).toFixed(1)
                    : (Number(clockInfo.prize.toString()) / 1e18).toFixed(1);
                
                // Afficher le nombre de tickets
                ticketCountElement.textContent = `Cash prize: ${ticketCount} FTN`;
            } else {
                console.warn('Contrat non disponible, impossible d\'afficher le nombre de tickets');
                ticketCountElement.textContent = 'Cash prize: Non disponible';
            }
        } catch (error) {
            console.error('Erreur lors de la récupération du nombre de tickets:', error);
            ticketCountElement.textContent = 'Cash prize: Erreur';
        }
    }
    
    // Appeler la fonction pour mettre à jour le nombre de tickets
    updateTicketCount();
}

function hideCard() {
    document.getElementById("card-overlay").style.display = "none";
}

window.showCard = showCard;
window.hideCard = hideCard;

function cleanupInvalidClocks() {
    const validClocks = [];

    clockObjects.forEach(clock => {
        const id = clock.userData?.id;
        if (id === undefined) {
            console.warn("Removing clock with undefined ID:", clock);
            scene.remove(clock);
        } else if (!clockMetadataMap.has(id)) {
            console.warn("Removing clock with no metadata (ID:", id, "):", clock);
            scene.remove(clock);
        } else {
            validClocks.push(clock);
        }
    });

    clockObjects = validClocks;
}

// Call this after loading or when you detect issues
cleanupInvalidClocks();

// Hide the scene on partner.html
if (window.location.pathname.includes('partner.html')) {
    renderer.domElement.style.display = 'none';
}

function convertSize(input) {
    const minInput = 1;     // Input range starts from 1
    const maxInput = 10000; // Input range ends at 10000
    const minOutput = 5;    // Output range starts at 5
    const maxOutput = 18;   // Output range ends at 18

    // Calculate the proportional value between minOutput and maxOutput
    const result = minOutput + (maxOutput - minOutput) * ((input - minInput) / (maxInput - minInput));

    // Clamp the result to make sure it's within the range [5, 18]
    return Math.max(minOutput, Math.min(maxOutput, result));
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
            // get cashprize
            const cashprize = document.getElementById('cashprize').value;
            const size = convertSize(cashprize);

            const owner = prompt("Enter owner name:", "default");
            createNewClock(size, 4, 0, 0.1, '/assets/wwf.jpg', owner, 300000);
        });
    }

    // Clear existing clocks (except main clock)
    console.log('Number of clocks:', clockObjects.length);
    clockObjects.forEach(clock => {
        if (clock !== mainClock) {
            scene.remove(clock);
        }
    });
    clockObjects = mainClock ? [mainClock] : [];
    mixers.length = 0;
    clockIds = [];
    clockMetadataMap.clear();
    nextClockId = 1;

    const savedClocks = JSON.parse(localStorage.getItem('clocks')) || [];

    if (savedClocks.length <= 7 && !window.location.pathname.includes('partner.html')) {
        // Create default clocks only if no saved clocks exist
        const defaultClocks = [
            { size: 7, speed: 4, adjust: 0, depth: 0.1, image: '/assets/wwf.jpg', owner: 'wwf', time: 1800 },
            { size: 5.2, speed: 4, adjust: 0.1, depth: 0.08, image: '/assets/github_logo.png', owner: 'github', time: 9600 },
            { size: 6, speed: 4, adjust: 0.2, depth: 0.09, image: '/assets/symbiosis.png', owner: 'symbiosis', time: 30 },
            { size: 7, speed: 4, adjust: 0.3, depth: 0.1, image: '/assets/resto.png', owner: 'resto', time: 1800 },
            { size: 6, speed: 4, adjust: 0.1, depth: 0.1, image: '/assets/bmw.png', owner: 'bmw', time: 1800 },
            { size: 6.5, speed: 4, adjust: 0.1, depth: 0.1, image: '/assets/1009656-Drapeau_de_la_Croix-Rouge.jpg', owner: 'croixrouge', time: 1800 },
            { size: 6.5, speed: 4, adjust: 0.17, depth: 0.1, image: '/assets/spotify.jpg', owner: 'spotify', time: 1800 }
        ];

        // Use Promise.all to wait for all clocks to be created
        Promise.all(
            defaultClocks.map(clock =>
                createNewClock(
                    clock.size,
                    clock.speed,
                    clock.adjust,
                    clock.depth,
                    clock.image,
                    clock.owner,
                    clock.time
                )
            )
        ).then(() => {
            console.log("All default clocks created");
            cleanupInvalidClocks();
        }).catch(error => {
            console.error("Error creating default clocks:", error);
        });
    } else {
        // Load saved clocks with all correct properties
        savedClocks.forEach(clockData => {
            // Skip if no ID (shouldn't happen, but just in case)
            if (clockData.id === undefined) {
                console.warn("Found clock with undefined ID in localStorage:", clockData);
                return;
            }

            loader.load('/assets/clock_low_poly/scene.gltf', (gltf) => {
                const model = gltf.scene;
                model.rotation.set(0, 0, 0);
                model.scale.set(...clockData.scale);

                const clockGroup = new THREE.Group();
                clockGroup.userData.id = clockData.id; // Make sure to set the ID
                console.log(`Loading clock with ID: ${clockData.id}`); // Debug log

                clockGroup.add(model);
                clockGroup.position.set(...clockData.position);

                // Create and store metadata
                const metadata = new ClockMetadata(
                    clockData.id,
                    clockData.owner || "default",
                    clockData.time || Date.now(),
                    clockData.size,
                    clockData.speed,
                    clockData.adjust,
                    clockData.depth,
                    clockData.imagePath
                );
                metadata.position = clockData.position;
                clockMetadataMap.set(clockData.id, metadata);
                clockIds.push(clockData.id);

                // Update nextClockId to be higher than any existing ID
                if (clockData.id >= nextClockId) {
                    nextClockId = clockData.id + 1;
                }

                // Add image with correct parameters from storage
                addCircularImageTo(
                    clockGroup,
                    clockData.imagePath,
                    0.9,
                    clockData.depth,
                    clockData.adjust
                );

                createTimeDisplay(clockGroup, clockData.time | 0, clockData.depth);

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

    // Make utility functions available globally
    window.getAllClockIds = getAllClockIds;
    window.getClockMetadata = getClockMetadata;
    window.updateTime = updateTime;
    window.getClockById = getClockById;
});

// Add this near the top of script.js
window.addEventListener('storage', function (event) {
    if (event.key === 'clocks') {
        const savedClocks = JSON.parse(localStorage.getItem('clocks')) || [];

        // Clear existing clocks except main clock
        clockObjects.forEach(clock => {
            if (clock !== mainClock) {
                scene.remove(clock);
            }
        });
        clockObjects = mainClock ? [mainClock] : [];
        mixers.length = 0;
        clockIds = mainClock ? [0] : [];
        clockMetadataMap.clear();
        if (mainClock) {
            const metadata = new ClockMetadata(0, "system", Date.now(), 18, 1, 0, 0.015, '/assets/bahamut.png');
            clockMetadataMap.set(0, metadata);
        }

        // Load the updated clocks
        savedClocks.forEach(clockData => {
            loader.load('/assets/clock_low_poly/scene.gltf', (gltf) => {
                const model = gltf.scene;
                model.rotation.set(0, 0, 0);
                model.scale.set(...clockData.scale);

                const clockGroup = new THREE.Group();
                clockGroup.userData.id = clockData.id; // Make sure ID is set
                console.log(`Loading clock with ID: ${clockData.id}`); // Debug log

                clockGroup.add(model);
                clockGroup.position.set(...clockData.position);

                // Create and store metadata
                const metadata = new ClockMetadata(
                    clockData.id,
                    clockData.owner || "default",
                    clockData.time || Date.now(),
                    clockData.size,
                    clockData.speed,
                    clockData.adjust,
                    clockData.depth,
                    clockData.imagePath
                );
                clockMetadataMap.set(clockData.id, metadata);
                clockIds.push(clockData.id);

                // Update nextClockId
                if (clockData.id >= nextClockId) {
                    nextClockId = clockData.id + 1;
                }

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

// call create clock when the c keytouch is pressed
document.addEventListener('keydown', (event) => {
    if (event.key === 'c') {
        createNewClock(7, 4, 0, 0.1, '/assets/wwf.jpg', "default", 30000);
    }
    if (event.key === 'r') {
        createNewClock(7, 4, 0.3, 0.1, '/assets/resto.png', "default", 1800);
    }
    if (event.key === 'b') {
        createNewClock(6, 4, 0.1, 0.1, '/assets/bmw.png', "default", 1800);
    }
    if (event.key === 'g') {
        createNewClock(5.2, 4, 0.1, 0.08, '/assets/github_logo.png', "default", 30000);
    }
    if (event.key === 's') {
        createNewClock(6, 4, 0.2, 0.09, '/assets/symbiosis.png', "default", 30000);
    }
    if (event.key === 'w') {
        createNewClock(6.5, 4, 0.1, 0.1, '/assets/1009656-Drapeau_de_la_Croix-Rouge.jpg', "default", 1800);
    }
    if (event.key === 'p') {
        createNewClock(6.5, 4, 0.17, 0.1, '/assets/spotify.jpg', "default", 1800);
    }
});

document.getElementById('clearClocksButton').addEventListener('click', function () {
    // Clear the clocks from localStorage
    localStorage.removeItem('clocks');
    // Optionally, remove all the clocks from the scene
    clockObjects.forEach(clock => scene.remove(clock)); // Assuming clockObjects holds all the clock instances
    clockObjects = []; // Clear the array that holds clock references
    alert("Clocks have been cleared from localStorage.");
});

function formatTime(seconds) {
    if (seconds === undefined || seconds === null) return "00:00:00";

    // Ensure seconds is a number
    seconds = Number(seconds);

    // Calculate hours, minutes, and remaining seconds
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    // Format each component to 2 digits
    const pad = (num) => num.toString().padStart(2, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

// Function to update the main clock time from WebSocket data
window.updateClockTimeUI = function(seconds) {
    console.log("updateClockTimeUI called with seconds:", seconds);
    
    // Only proceed if we have a valid number
    if (seconds === undefined || seconds === null || isNaN(seconds)) {
        console.warn("Invalid time value received:", seconds);
        return;
    }
    
    seconds = Number(seconds); // Ensure it's a number
    
    // Find the main clock
    const mainClock = getClockById(0);
    if (!mainClock) {
        console.error("Main clock not found!");
        return;
    }
    
    // Get the metadata for the clock
    const metadata = clockMetadataMap.get(0);
    if (!metadata) {
        console.error("Main clock metadata not found!");
        return;
    }
    
    // Update the metadata time
    metadata.time = seconds;
    console.log("Updated main clock time to", seconds, "seconds");
    
    // Simple update approach - just update the text in the existing display
    if (mainClock.userData && mainClock.userData.timeDisplay) {
        const display = mainClock.userData.timeDisplay;
        
        if (display.ctx && display.canvas) {
            // Clear canvas
            display.ctx.clearRect(0, 0, display.width, display.height);
            
            // Set text properties
            const fontSize = display.isMainClock ? 400 : 48;
            display.ctx.font = `bold ${fontSize}px 'Arial', sans-serif`;
            display.ctx.textAlign = 'center';
            display.ctx.textBaseline = 'middle';
            display.ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
            display.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            display.ctx.lineWidth = 6;
            
            // Format and draw the time
            const formattedTime = formatTime(seconds);
            display.ctx.strokeText(formattedTime, display.width / 2, display.height / 2);
            display.ctx.fillText(formattedTime, display.width / 2, display.height / 2);
            
            // Update the texture
            display.texture.needsUpdate = true;
            console.log("Clock display updated successfully");
        } else {
            console.error("Invalid display context or canvas");
        }
    } else {
        console.error("Main clock has no timeDisplay object");
        // Create a new display as fallback
        createTimeDisplay(mainClock, seconds, 0.015);
    }
};
