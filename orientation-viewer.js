// ============================================================================
// 3D ORIENTATION VISUALIZER v2.0 (Cylinder + Cuboid Modes)
// Uses Three.js to render rotating 3D shapes based on gyroscope data
// ============================================================================

let scene, camera, renderer, shape;
let gyroData = { x: 0, y: 0, z: 0 };
let isOrientationViewerActive = false;
let shapeMode = "cylinder"; // "cylinder" or "cuboid"

function init3DViewer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error("Container not found:", containerId);
        return;
    }

    if (renderer) {
        renderer.dispose();
        container.innerHTML = "";
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e2e);

    const width = container.clientWidth;
    const height = container.clientHeight;
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 2.5;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Create shape based on mode
    if (shapeMode === "cylinder") {
        createCylinder();
    } else {
        createCuboid();
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    window.addEventListener("resize", function() {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
    });

    function animate() {
        requestAnimationFrame(animate);

        if (shape) {
            shape.rotation.x += gyroData.x * 0.01;
            shape.rotation.y += gyroData.y * 0.01;
            shape.rotation.z += gyroData.z * 0.01;
        }

        renderer.render(scene, camera);
    }

    animate();
    isOrientationViewerActive = true;
}

function createCuboid() {
    // Remove existing shape
    if (shape) {
        scene.remove(shape);
    }

    const geometry = new THREE.BoxGeometry(1, 1.5, 0.8);
    const material = new THREE.MeshPhongMaterial({
        color: 0x89b4fa,
        emissive: 0x313244,
        shininess: 100,
        wireframe: false
    });
    shape = new THREE.Mesh(geometry, material);
    scene.add(shape);

    // Add edges
    const edges = new THREE.EdgesGeometry(geometry);
    const wireframe = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x45475a })
    );
    shape.add(wireframe);
}

function createCylinder() {
    // Remove existing shape
    if (shape) {
        scene.remove(shape);
    }

    // Create CanSat-like cylinder
    // Radius: 0.4, Height: 1.2 (typical CanSat proportions)
    const geometry = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 32);
    const material = new THREE.MeshPhongMaterial({
        color: 0x89b4fa,
        emissive: 0x313244,
        shininess: 100,
        wireframe: false
    });
    shape = new THREE.Mesh(geometry, material);
    scene.add(shape);

    // Add edges
    const edges = new THREE.EdgesGeometry(geometry);
    const wireframe = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x45475a })
    );
    shape.add(wireframe);

    // Add directional indicator (top cap highlight)
    const indicatorGeometry = new THREE.CircleGeometry(0.4, 32);
    const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xfab387, transparent: true, opacity: 0.3 });
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    indicator.position.y = 0.6;
    indicator.rotation.x = -Math.PI / 2;
    shape.add(indicator);
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
        shape = null;
        scene = null;
        camera = null;
        isOrientationViewerActive = false;
    }
}

// ============================================================================
// ORIENTATION MODAL WITH SHAPE TOGGLE
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
                <div style="display: flex; gap: 8px;">
                    <button id="toggleShapeBtn" style="
                        background: var(--accent);
                        border: none;
                        padding: 6px 12px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: 600;
                        color: var(--bg);
                        border-radius: 4px;
                    ">Cylinder</button>
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

function toggleShapeMode() {
    shapeMode = shapeMode === "cylinder" ? "cuboid" : "cylinder";
    const btn = document.getElementById("toggleShapeBtn");
    btn.textContent = shapeMode === "cylinder" ? "Cylinder" : "Cuboid";
    
    // Recreate the shape
    if (scene && isOrientationViewerActive) {
        if (shapeMode === "cylinder") {
            createCylinder();
        } else {
            createCuboid();
        }
    }
}

document.getElementById("toggleShapeBtn").addEventListener("click", toggleShapeMode);
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

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", add3DViewerButton);
} else {
    add3DViewerButton();
}

// ============================================================================
// UPDATE FROM PLAYBACK
// ============================================================================

function updateOrientationViewer(row) {
    if (row && row.gyroX != null && row.gyroY != null && row.gyroZ != null) {
        updateCubeRotation(row.gyroX, row.gyroY, row.gyroZ);
    }
}