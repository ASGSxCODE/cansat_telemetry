// ============================================================================
// 3D ORIENTATION VISUALIZER v3.0 (Playback Sync + Real-time Rotation)
// Uses Three.js to render rotating 3D shapes based on live playback data
// ============================================================================

let scene, camera, renderer, shape;
let currentOrientation = { roll: 0, pitch: 0, yaw: 0 };
let isOrientationViewerActive = false;
let shapeMode = "cylinder";
let lastUpdateTime = 0;

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

    if (shapeMode === "cylinder") {
        createCylinder();
    } else {
        createCuboid();
    }

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
            const roll = (currentOrientation.roll || 0) * (Math.PI / 180);
            const pitch = (currentOrientation.pitch || 0) * (Math.PI / 180);
            const yaw = (currentOrientation.yaw || 0) * (Math.PI / 180);

            shape.rotation.x = roll;
            shape.rotation.y = yaw;
            shape.rotation.z = pitch;
        }

        renderer.render(scene, camera);
    }

    animate();
    isOrientationViewerActive = true;
}

function createCuboid() {
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

    const edges = new THREE.EdgesGeometry(geometry);
    const wireframe = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x45475a })
    );
    shape.add(wireframe);

    const indicatorGeometry = new THREE.PlaneGeometry(0.95, 0.2);
    const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xfab387, transparent: true, opacity: 0.4 });
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    indicator.position.z = 0.41;
    shape.add(indicator);
}

function createCylinder() {
    if (shape) {
        scene.remove(shape);
    }

    const geometry = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 32);
    const material = new THREE.MeshPhongMaterial({
        color: 0x89b4fa,
        emissive: 0x313244,
        shininess: 100,
        wireframe: false
    });
    shape = new THREE.Mesh(geometry, material);
    scene.add(shape);

    const edges = new THREE.EdgesGeometry(geometry);
    const wireframe = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x45475a })
    );
    shape.add(wireframe);

    const indicatorGeometry = new THREE.CircleGeometry(0.4, 32);
    const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xfab387, transparent: true, opacity: 0.3 });
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    indicator.position.y = 0.6;
    indicator.rotation.x = -Math.PI / 2;
    shape.add(indicator);
}

function updateOrientationFromPlayback(roll, pitch, yaw) {
    currentOrientation.roll = roll || 0;
    currentOrientation.pitch = pitch || 0;
    currentOrientation.yaw = yaw || 0;
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
                    3D Orientation Viewer (Live Playback)
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
            <div style="
                padding: 10px 14px;
                border-top: 1px solid var(--line);
                font-family: Consolas, monospace;
                font-size: 11px;
                color: var(--muted);
            ">
                Roll: <span id="orientationRoll">0.00</span>° | Pitch: <span id="orientationPitch">0.00</span>° | Yaw: <span id="orientationYaw">0.00</span>°
            </div>
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
// ADD 3D VIEWER BUTTON TO ORIENTATION CHART
// ============================================================================

function add3DViewerButton() {
    const orientationCard = document.querySelector('[id="orientationChart"]')?.closest(".graph-card");
    if (!orientationCard) return;

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
    
    orientationCard.appendChild(button);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", add3DViewerButton);
} else {
    add3DViewerButton();
}

// ============================================================================
// UPDATE FROM PLAYBACK (EXPORTED FOR USE IN script.js)
// ============================================================================

function syncOrientation(roll, pitch, yaw) {
    updateOrientationFromPlayback(roll, pitch, yaw);
    
    if (orientationModal.style.display === "flex") {
        document.getElementById("orientationRoll").textContent = (roll || 0).toFixed(2);
        document.getElementById("orientationPitch").textContent = (pitch || 0).toFixed(2);
        document.getElementById("orientationYaw").textContent = (yaw || 0).toFixed(2);
    }
}