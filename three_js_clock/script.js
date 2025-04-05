import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene, Camera, Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 10;
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls (disabled permanently)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false;  // Disable OrbitControls completely

// Clocks array
const clockObjects = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedClock = null;
let isDragging = false;
let clickTimeout;
const clockRadius = 1; // Radius of the clock spheres

const big_geometry = new THREE.SphereGeometry(3, 32, 32);
const big_material = new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff });
const big_clock = new THREE.Mesh(big_geometry, big_material);
big_clock.position.set(0, 0, 0);
scene.add(big_clock);
clockObjects.push(big_clock);

const numBalls = 10; // Total number of balls
const circleRadius = 6; // Radius of the circle where balls will be positioned

// Create balls in a circular arrangement
for (let i = 0; i < numBalls; i++) {
    // Calculate the angle for each ball
    const angle = (i / numBalls) * (2 * Math.PI); // Evenly spaced on the circle

    // Calculate the x and y position using polar coordinates
    const x = circleRadius * Math.cos(angle);
    const y = circleRadius * Math.sin(angle);

    // Create the ball
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff });
    const clock = new THREE.Mesh(geometry, material);

    // Set the ball's position on the circle
    clock.position.set(x, y, 0);

    // Add the ball to the scene and the clockObjects array
    scene.add(clock);
    clockObjects.push(clock);
}

// Handle Mouse Down for 3D object selection
document.addEventListener('mousedown', (event) => {
    // Avoid interaction with the card overlay
    if (event.target.closest('#card-overlay')) {
        return; // Ignore events if clicked on the card overlay
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clockObjects);

    if (intersects.length > 0) {
        selectedClock = intersects[0].object;

        // Check if the selected clock is behind the card
        if (isClockBehindCard(selectedClock)) {
            selectedClock = null; // Do not select the clock behind the card
            return;
        }

        clickTimeout = setTimeout(() => {
            isDragging = true;
        }, 200); // Start dragging after 200ms
    }
});

// Handle Mouse Up for 3D object
document.addEventListener('mouseup', () => {
    clearTimeout(clickTimeout);

    if (!isDragging && selectedClock) {
        showCard(); // Show the card if it's just a click (not a drag)
    }

    isDragging = false;
    selectedClock = null;
});

// Handle Mouse Move for dragging 3D object
document.addEventListener('mousemove', (event) => {
    if (isDragging && selectedClock) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // Plane at z = 0
        const targetPoint = new THREE.Vector3();

        if (raycaster.ray.intersectPlane(planeZ, targetPoint)) {
            selectedClock.position.x = targetPoint.x;
            selectedClock.position.y = targetPoint.y;
        }

        // Prevent the clock from leaving the screen
        clampPosition(selectedClock);

        // After dragging, check collisions for the selected clock
        checkCollisions();
    }
});

// Function to determine if the clock is behind the card
function isClockBehindCard(clock) {
    const cardRect = document.getElementById("card-overlay").getBoundingClientRect();
    const clockScreenPosition = clock.position.clone().project(camera);
    const x = (clockScreenPosition.x + 1) * window.innerWidth / 2;
    const y = (1 - clockScreenPosition.y) * window.innerHeight / 2;

    // Check if the clock's screen position intersects with the card
    if (x > cardRect.left && x < cardRect.right && y > cardRect.top && y < cardRect.bottom) {
        return true; // The clock is behind the card
    }

    return false;
}

// Check for collisions between clocks and apply repulsion force
function checkCollisions() {
    clockObjects.forEach((movingClock, index) => {
        for (let i = index + 1; i < clockObjects.length; i++) {
            const otherClock = clockObjects[i];

            const movingBox = new THREE.Box3().setFromObject(movingClock);
            const otherBox = new THREE.Box3().setFromObject(otherClock);

            if (movingBox.intersectsBox(otherBox)) {
                const direction = new THREE.Vector3();
                direction.subVectors(movingClock.position, otherClock.position);  // Get direction
                const distance = direction.length();

                // Calculate pushback only if clocks are overlapping
                if (distance < 2 * clockRadius) {  // This ensures clocks aren't overlapping
                    direction.normalize();
                    const pushbackAmount = (2 * clockRadius - distance) * 0.5;  // Push clocks apart

                    // Move clocks apart along the direction vector
                    movingClock.position.addScaledVector(direction, pushbackAmount);
                    otherClock.position.addScaledVector(direction, -pushbackAmount);
                }
            }
        }

        // Ensure clock is within boundaries
        clampPosition(movingClock);
    });
}

// Ensure the clocks stay within the boundaries of the screen
function clampPosition(clock) {
    const boundary = {
        left: -8 + clockRadius,   // Minimum x position
        right: 8 - clockRadius,   // Maximum x position
        top: 6 - clockRadius,     // Maximum y position
        bottom: -6 + clockRadius  // Minimum y position
    };

    // Check for boundary limits for both x and y axes
    if (clock.position.x < boundary.left) clock.position.x = boundary.left;
    if (clock.position.x > boundary.right) clock.position.x = boundary.right;
    if (clock.position.y < boundary.bottom) clock.position.y = boundary.bottom;
    if (clock.position.y > boundary.top) clock.position.y = boundary.top;
}

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    checkCollisions();  // Continuously check for collisions for all clocks
    renderer.render(scene, camera);
}
animate();

// Card drag handling (dragging the profile card)
let dragOffsetX, dragOffsetY;
const card = document.querySelector('.profile-card');

card.addEventListener('mousedown', (e) => {
    // Prevent default behavior to avoid selection and text highlighting
    e.preventDefault();

    // Ignore dragging if the mouse event is on the card overlay
    if (e.target.closest('#card-overlay')) {
        return;
    }

    dragOffsetX = e.clientX - card.offsetLeft;
    dragOffsetY = e.clientY - card.offsetTop;

    // Ensure that the card is dragged using its top-left corner
    card.style.transform = "none";

    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', dragEnd);
});

function dragMove(e) {
    card.style.left = (e.clientX - dragOffsetX) + 'px';
    card.style.top = (e.clientY - dragOffsetY) + 'px';
    card.style.position = 'absolute'; // Ensure it's positioned absolutely
}

function dragEnd() {
    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('mouseup', dragEnd);
}

// Show the profile card
window.showCard = function () {
    document.getElementById("card-overlay").style.display = "block";
};

// Hide the profile card
window.hideCard = function () {
    document.getElementById("card-overlay").style.display = "none";
};
