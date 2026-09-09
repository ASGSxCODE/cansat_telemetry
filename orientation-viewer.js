// ============================================================================
// 3D ORIENTATION VISUALIZER v3.0 (Playback Sync + Real-time Rotation)
// Uses Three.js to render rotating 3D shapes based on live playback data
// ============================================================================

let scene, camera, renderer, shape;
let currentOrientation = { roll: 0, pitch: 0, yaw: 0 };
let isOrientationViewerActive = false;
let shapeMode = "cylinder";
let lastUpdateTime = 0;

// 3D Player independent state
let viewer3DState = {
    isPlaying: false,
    currentIndex: 0,
    speed: 1,
    rows: [],
    animationFrameId: null
};

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
                    3D Orientation Viewer (Independent Player)
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
                background: rgba(0, 0, 0, 0.2);
            ">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <button id="3d-play-btn" style="
                        background: var(--accent);
                        color: var(--bg);
                        border: none;
                        padding: 4px 10px;
                        font-size: 11px;
                        font-weight: 600;
                        cursor: pointer;
                        border-radius: 3px;
                        min-width: 60px;
                    ">▶ Play</button>
                    <input type="range" id="3d-time-slider" style="
                        flex: 1;
                        height: 4px;
                        background: var(--line);
                        border-radius: 2px;
                        outline: none;
                        -webkit-appearance: none;
                        appearance: none;
                    " min="0" max="100" value="0">
                    <span id="3d-playback-time" style="min-width: 90px; text-align: right;">0:00:00 / 0:00:00</span>
                </div>
                <div style="display: flex; gap: 15px; margin-top: 8px;">
                    <span>Roll: <span id="orientationRoll" style="color: var(--accent);">0.00</span>°</span>
                    <span>Pitch: <span id="orientationPitch" style="color: var(--accent);">0.00</span>°</span>
                    <span>Yaw: <span id="orientationYaw" style="color: var(--accent);">0.00</span>°</span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

let orientationModal = createOrientationModal();

function openOrientationViewer(rows) {
    if (!rows || rows.length === 0) {
        console.error("No data rows provided to 3D viewer");
        return;
    }

    orientationModal.style.display = "flex";
    setTimeout(function() {
        init3DViewer("orientationContainer");
        setup3DPlayerControls(rows);
        update3DDisplay(rows);
    }, 100);
}

function closeOrientationViewer() {
    orientationModal.style.display = "none";
    viewer3DState.isPlaying = false;
    if (viewer3DState.animationFrameId) {
        cancelAnimationFrame(viewer3DState.animationFrameId);
    }
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

// ============================================================================
// 3D VIEWER PLAYBACK CONTROLS
// ============================================================================

function setup3DPlayerControls(rows) {
    viewer3DState.rows = rows;
    viewer3DState.currentIndex = 0;

    const playBtn = document.getElementById("3d-play-btn");
    const timeSlider = document.getElementById("3d-time-slider");
    const playbackTimeEl = document.getElementById("3d-playback-time");

    timeSlider.max = rows.length - 1;
    timeSlider.value = 0;

    playBtn.addEventListener("click", function() {
        viewer3DState.isPlaying = !viewer3DState.isPlaying;
        playBtn.textContent = viewer3DState.isPlaying ? "⏸ Pause" : "▶ Play";
        
        if (viewer3DState.isPlaying) {
            play3DAnimation();
        } else {
            if (viewer3DState.animationFrameId) {
                cancelAnimationFrame(viewer3DState.animationFrameId);
            }
        }
    });

    timeSlider.addEventListener("input", function() {
        viewer3DState.currentIndex = parseInt(this.value);
        update3DDisplay(rows);
    });
}

function update3DDisplay(rows) {
    const row = rows[viewer3DState.currentIndex];
    if (!row) return;

    const timeSlider = document.getElementById("3d-time-slider");
    
    // Format time display
    function formatTime(ms) {
        if (ms == null) return "0:00:00";
        const totalSeconds = Math.floor(ms / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
        const seconds = String(totalSeconds % 60).padStart(2, "0");
        return hours + ":" + minutes + ":" + seconds;
    }

    const currentTime = formatTime(row.timeMs || 0);
    const totalTime = formatTime(rows[rows.length - 1].timeMs || 0);
    
    document.getElementById("3d-playback-time").textContent = currentTime + " / " + totalTime;
    timeSlider.value = viewer3DState.currentIndex;

    // Update 3D model orientation
    if (row.roll != null && row.pitch != null && row.yaw != null) {
        updateOrientationFromPlayback(row.roll, row.pitch, row.yaw);
        document.getElementById("orientationRoll").textContent = (row.roll || 0).toFixed(2);
        document.getElementById("orientationPitch").textContent = (row.pitch || 0).toFixed(2);
        document.getElementById("orientationYaw").textContent = (row.yaw || 0).toFixed(2);
    }
}

function play3DAnimation() {
    if (!viewer3DState.isPlaying) return;

    viewer3DState.currentIndex++;
    if (viewer3DState.currentIndex >= viewer3DState.rows.length) {
        viewer3DState.isPlaying = false;
        document.getElementById("3d-play-btn").textContent = "▶ Play";
        return;
    }

    update3DDisplay(viewer3DState.rows);
    viewer3DState.animationFrameId = setTimeout(play3DAnimation, 50);
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
    button.addEventListener("click", function() {
        // Will be called from script.js with actual rows data
        openOrientationViewer(window.lastParsedRowsFor3D || []);
    });
    
    orientationCard.appendChild(button);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", add3DViewerButton);
} else {
    add3DViewerButton();
}

// ============================================================================
// UPDATE FROM MAIN PLAYBACK (Only when 3D modal NOT open)
// ============================================================================

function syncOrientation(roll, pitch, yaw) {
    // Only update if 3D viewer is closed or not in independent playback mode
    if (orientationModal.style.display !== "flex" || !viewer3DState.isPlaying) {
        updateOrientationFromPlayback(roll, pitch, yaw);
    }
}