// ============================================================================
// 3D ORIENTATION VISUALIZER (Cuboid Rotation via Gyroscope)
// Uses Three.js to render and rotate a 3D box based on IMU data
// ============================================================================

let scene, camera, renderer, cube;
let gyroData = { x: 0, y: 0, z: 0 };
let isOrientationViewerActive = false;

function init3DViewer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error("Container not found:", containerId);
        return;
    }

    // Clear any existing renderer
    if (renderer) {
        renderer.dispose();
        container.innerHTML = "";
    }

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e2e); // Catppuccin mocha bg

    // Camera setup
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 2;

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Create cuboid (box geometry)
    const geometry = new THREE.BoxGeometry(1, 1.5, 0.8);
    const material = new THREE.MeshPhongMaterial({
        color: 0x89b4fa, // Catppuccin blue
        emissive: 0x313244,
        shininess: 100,
        wireframe: false
    });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Add edges to make the cube clearer
    const edges = new THREE.EdgesGeometry(geometry);
    const wireframe = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x45475a }) // Catppuccin surface1
    );
    cube.add(wireframe);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Handle window resize
    window.addEventListener("resize", function() {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
    });

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        // Rotate cube based on gyroscope data (convert degrees to radians)
        // Gyroscope typically gives angular velocity, we apply it directly as rotation
        cube.rotation.x += gyroData.x * 0.01; // Scale factor for smooth rotation
        cube.rotation.y += gyroData.y * 0.01;
        cube.rotation.z += gyroData.z * 0.01;

        renderer.render(scene, camera);
    }

    animate();
    isOrientationViewerActive = true;
}

function updateCubeRotation(gyroX, gyroY, gyroZ) {
    gyroData.x = gyroX || 0;
    gyroData.y = gyroY || 0;
    gyroData.z = gyroZ || 0;
}

function destroyOrientationViewer() {
    if (renderer) {
        renderer.dispose();
        renderer = null;
        cube = null;
        scene = null;
        camera = null;
        isOrientationViewerActive = false;
    }
}

// ============================================================================
// CREATE ORIENTATION MODAL
// ============================================================================

function createOrientationModal() {
    const modal = document.createElement("div");
    modal.id = "orientationModal";
    modal.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 9999;
        align-items: center;
        justify-content: center;
    `;
    modal.innerHTML = `
        <div style="
            background: var(--panel);
            border: 1px solid var(--line);
            width: 90%;
            max-width: 900px;
            height: 80vh;
            display: flex;
            flex-direction: column;
            border-radius: 6px;
        ">
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 14px;
                border-bottom: 1px solid var(--line);
            ">
                <h2 style="margin: 0; font-size: 16px; color: var(--ink);">
                    3D Orientation Viewer
                </h2>
                <button id="closeOrientationModal" style="
                    background: var(--accent);
                    border: none;
                    padding: 6px 12px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--bg);
                    border-radius: 4px;
                ">Close (Esc)</button>
            </div>
            <div id="orientationContainer" style="
                flex: 1;
                padding: 14px;
                overflow: hidden;
            "></div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

let orientationModal = createOrientationModal();

function openOrientationViewer() {
    orientationModal.style.display = "flex";
    setTimeout(function() {
        init3DViewer("orientationContainer");
    }, 100);
}

function closeOrientationViewer() {
    orientationModal.style.display = "none";
    destroyOrientationViewer();
}

document.getElementById("closeOrientationModal").addEventListener("click", closeOrientationViewer);
document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && orientationModal.style.display === "flex") {
        closeOrientationViewer();
    }
});

orientationModal.addEventListener("click", function(e) {
    if (e.target === orientationModal) {
        closeOrientationViewer();
    }
});

// ============================================================================
// ADD 3D VIEWER BUTTON TO GYRO CHART CARD
// ============================================================================

function add3DViewerButton() {
    const gyroCard = document.querySelector('[id="gyroChart"]')?.closest(".graph-card");
    if (!gyroCard) return;

    const button = document.createElement("button");
    button.textContent = "🔷 View 3D";
    button.style.cssText = `
        display: block;
        margin-top: 8px;
        width: 100%;
        background: var(--accent);
        color: var(--bg);
        border: none;
        padding: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s ease;
    `;
    button.addEventListener("mouseenter", function() {
        this.style.filter = "brightness(1.1)";
    });
    button.addEventListener("mouseleave", function() {
        this.style.filter = "brightness(1)";
    });
    button.addEventListener("click", openOrientationViewer);
    
    gyroCard.appendChild(button);
}

// Add button when page loads
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", add3DViewerButton);
} else {
    add3DViewerButton();
}

// ============================================================================
// UPDATE CUBOID ROTATION DURING CSV PLAYBACK
// ============================================================================

// This function gets called when you want to animate the cuboid through the flight
function animateCuboidThroughFlight(rows, speed = 1) {
    if (!isOrientationViewerActive) {
        console.warn("Orientation viewer not active. Open it first.");
        return;
    }

    openOrientationViewer();

    let index = 0;
    const interval = setInterval(function() {
        if (index >= rows.length) {
            clearInterval(interval);
            return;
        }

        const row = rows[index];
        updateCubeRotation(row.gyroX, row.gyroY, row.gyroZ);
        index++;
    }, 50 / speed); // Adjust timing based on speed factor
}
