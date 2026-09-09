// ============================================================================
// CanSat Telemetry Visualizer v4.0 - Complete Edition
// CSV Parser & Graphing with Flight Analysis, Formulas, Telemetry Table
// ============================================================================

const csvFile = document.getElementById("csvFile");
const fileName = document.getElementById("file-name");
const datasetMeta = document.getElementById("dataset-meta");
const pressureMaxEl = document.getElementById("pressure-max");
const pressureMinEl = document.getElementById("pressure-min");
const temperatureMaxEl = document.getElementById("temperature-max");
const temperatureMinEl = document.getElementById("temperature-min");
const altitudeMaxEl = document.getElementById("altitude-max");

const AXIS = {
    x: "#c45c4a",
    y: "#7a9a4a",
    z: "#5b86b5"
};

const tickColor = "#8d8676";
const gridColor = "rgba(230, 223, 208, 0.08)";
let lastParsedRows = [];
window.lastParsedRowsFor3D = [];

// Playback state
let playbackState = {
    isPlaying: false,
    currentIndex: 0,
    speed: 1,
    rows: []
};

// ============================================================================
// FORMULA DEFINITIONS
// ============================================================================

const FORMULAS = {
    altitude: {
        title: "Altitude",
        description: "Barometric altitude calculated from air pressure",
        formula: "h = 44330 × [1 - (P/P₀)^(1/5.255)]",
        explanation: "Uses barometric formula to derive altitude from pressure readings (P = current pressure, P₀ = sea level reference)"
    },
    temperature: {
        title: "Temperature",
        description: "Direct sensor reading from onboard thermometer",
        formula: "T = Raw ADC Value × Calibration Factor",
        explanation: "Raw temperature sensor output converted to Celsius using factory calibration coefficients"
    },
    pressure: {
        title: "Pressure",
        description: "Atmospheric pressure from barometric sensor",
        formula: "P = Raw ADC Value × Sensitivity + Offset",
        explanation: "Direct sensor measurement in hectopascals (hPa) or millibars"
    },
    vertical_velocity: {
        title: "Vertical Velocity",
        description: "Rate of altitude change",
        formula: "v_z = Δh / Δt = (h₂ - h₁) / (t₂ - t₁)",
        explanation: "Positive = ascending, Negative = descending. Calculated from altitude delta over time interval"
    },
    accel_magnitude: {
        title: "Acceleration Magnitude",
        description: "Total acceleration experienced by the CanSat (including gravity)",
        formula: "|a| = √(ax² + ay² + az²)",
        explanation: "Vector magnitude of 3-axis accelerometer. During free-fall ≈ 1g. Max at apogee deployment."
    },
    orientation: {
        title: "Orientation (Roll/Pitch/Yaw)",
        description: "CanSat attitude angles",
        formulas: [
            { name: "Roll", formula: "φ = atan2(ay, az) × (180/π)" },
            { name: "Pitch", formula: "θ = atan2(-ax, √(ay² + az²)) × (180/π)" },
            { name: "Yaw", formula: "ψ = atan2(my, mx) × (180/π)" }
        ],
        explanation: "Derived from accelerometer and magnetometer data. Roll/Pitch from accel; Yaw from compass."
    },
    accelerometer: {
        title: "Accelerometer (3-Axis)",
        description: "Direct measurements from inertial measurement unit",
        formula: "[ax, ay, az] = Raw ADC → m/s² or g",
        explanation: "X, Y, Z axis linear accelerations. Includes gravity component (1g at rest)."
    },
    gyroscope: {
        title: "Gyroscope (3-Axis)",
        description: "Angular velocity measurements",
        formula: "[ωx, ωy, ωz] = Raw ADC → °/s",
        explanation: "Rotation rates around X, Y, Z axes. Sensitive to tumbling and spinning motion."
    },
    magnetometer: {
        title: "Magnetometer (3-Axis)",
        description: "Magnetic field measurements for compass heading",
        formula: "[mx, my, mz] = Raw ADC → µT",
        explanation: "Earth's magnetic field components. Used for yaw/heading calculation and orientation determination."
    }
};

// ============================================================================
// FORMULA MODAL SYSTEM
// ============================================================================

function setupFormulaModals() {
    const modal = document.getElementById("formulaModal");
    const closeBtn = document.querySelector(".formula-close");
    const body = document.getElementById("formulaBody");

    document.querySelectorAll(".info-btn").forEach(btn => {
        btn.addEventListener("click", function(e) {
            e.stopPropagation();
            const formulaKey = this.getAttribute("data-formula");
            const formula = FORMULAS[formulaKey];
            
            if (!formula) return;

            let content = `<h3>${formula.title}</h3>`;
            content += `<p class="formula-desc">${formula.description}</p>`;
            
            if (formula.formulas) {
                content += `<div class="formula-section">`;
                formula.formulas.forEach(f => {
                    content += `<div class="formula-item"><strong>${f.name}:</strong> <code>${f.formula}</code></div>`;
                });
                content += `</div>`;
            } else {
                content += `<div class="formula-section"><code>${formula.formula}</code></div>`;
            }
            
            content += `<p class="formula-explain"><strong>Explanation:</strong> ${formula.explanation}</p>`;
            
            body.innerHTML = content;
            modal.style.display = "flex";
        });
    });

    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });

    modal.addEventListener("click", function(e) {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });

    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && modal.style.display === "flex") {
            modal.style.display = "none";
        }
    });
}

// ============================================================================
// MISSION TIME FORMATTING
// ============================================================================

function formatMissionTime(milliseconds) {
    if (milliseconds == null) return "—";
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return hours + ":" + minutes + ":" + seconds;
}

// ============================================================================
// DATASET CREATORS
// ============================================================================

function xyzDatasets(prefix) {
    return ["X", "Y", "Z"].map(function (axis) {
        const key = axis.toLowerCase();
        return {
            label: prefix + " " + axis,
            data: [],
            borderColor: AXIS[key],
            backgroundColor: "transparent",
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.12
        };
    });
}

// ============================================================================
// CHART CREATION
// ============================================================================

const eventMarkerPlugin = {
    id: 'eventMarkers',
    afterDraw(chart) {
        if (!chart.events || chart.events.length === 0) return;

        const ctx = chart.ctx;
        const xScale = chart.scales.x;

        chart.events.forEach(function (event) {
            const x = xScale.getPixelForValue(event.index);
            const yTop = chart.chartArea.top;
            const yBottom = chart.chartArea.bottom;

            ctx.save();
            ctx.strokeStyle = event.type === "parachute_ejection" ? "#ff6b6b" : "#ffd700";
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x, yTop);
            ctx.lineTo(x, yBottom);
            ctx.stroke();

            ctx.font = "10px Segoe UI";
            ctx.fillStyle = ctx.strokeStyle;
            ctx.textAlign = "center";
            ctx.fillText(event.type === "parachute_ejection" ? "Parachute" : event.type, x, yTop - 5);
            ctx.restore();
        });
    }
};

function createChart(canvasId, yTitle, datasets) {
    return new Chart(
        document.getElementById(canvasId).getContext("2d"),
        {
            type: "line",
            data: {
                labels: [],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    mode: "index",
                    intersect: false
                },
                plugins: {
                    legend: {
                        labels: {
                            color: tickColor,
                            boxWidth: 10,
                            font: {
                                size: 11,
                                family: "Segoe UI"
                            }
                        }
                    },
                    tooltip: {
                        enabled: true,
                        mode: "index",
                        intersect: false,
                        backgroundColor: "rgba(22, 20, 16, 0.95)",
                        titleColor: "#89b4fa",
                        bodyColor: "#e6dfd0",
                        borderColor: "#3a362c",
                        borderWidth: 1,
                        padding: 10,
                        titleFont: { size: 12, weight: 600 },
                        bodyFont: { size: 12, family: "Consolas, monospace" },
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y != null) {
                                    label += context.parsed.y.toFixed(2);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: tickColor,
                            maxTicksLimit: 7,
                            font: { size: 10 }
                        },
                        grid: { color: gridColor },
                        title: {
                            display: true,
                            text: "Time",
                            color: tickColor
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: tickColor,
                            font: { size: 10 }
                        },
                        grid: { color: gridColor },
                        title: {
                            display: true,
                            text: yTitle,
                            color: tickColor
                        }
                    }
                }
            },
            plugins: [eventMarkerPlugin]
        }
    );
}

// Create all charts
const chartsRegistry = {};

const altitudeChart = createChart("altitudeChart", "m", [{
    label: "Altitude",
    data: [],
    borderColor: "#c9a227",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.12
}]);
chartsRegistry["altitudeChart"] = { chart: altitudeChart, title: "Altitude Profile" };

const temperatureChart = createChart("temperatureChart", "°C", [{
    label: "Temperature",
    data: [],
    borderColor: "#c45c4a",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.12
}]);
chartsRegistry["temperatureChart"] = { chart: temperatureChart, title: "Temperature" };

const pressureChart = createChart("pressureChart", "hPa", [{
    label: "Pressure",
    data: [],
    borderColor: "#5b86b5",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.12
}]);
chartsRegistry["pressureChart"] = { chart: pressureChart, title: "Pressure" };

// Vertical Velocity Chart
const velocityChart = createChart("velocityChart", "m/s", [{
    label: "Vertical Velocity",
    data: [],
    borderColor: "#a6e3a1",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.12
}]);
chartsRegistry["velocityChart"] = { chart: velocityChart, title: "Vertical Velocity" };

// Acceleration Magnitude Chart (SIGNED - shows direction)
const accelMagChart = createChart("accelMagChart", "g", [{
    label: "Acceleration Magnitude",
    data: [],
    borderColor: "#fab387",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.12
}]);
chartsRegistry["accelMagChart"] = { chart: accelMagChart, title: "Acceleration Magnitude (with Direction)" };

// Orientation Chart
const orientationChart = createChart("orientationChart", "°", [
    {
        label: "Roll",
        data: [],
        borderColor: "#c45c4a",
        backgroundColor: "transparent",
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.12
    },
    {
        label: "Pitch",
        data: [],
        borderColor: "#7a9a4a",
        backgroundColor: "transparent",
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.12
    },
    {
        label: "Yaw",
        data: [],
        borderColor: "#5b86b5",
        backgroundColor: "transparent",
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.12
    }
]);
chartsRegistry["orientationChart"] = { chart: orientationChart, title: "Roll / Pitch / Yaw" };

const accelChart = createChart("accelChart", "g", xyzDatasets("Acc"));
chartsRegistry["accelChart"] = { chart: accelChart, title: "Accelerometer (3-Axis)" };

const gyroChart = createChart("gyroChart", "°/s", xyzDatasets("Gyro"));
chartsRegistry["gyroChart"] = { chart: gyroChart, title: "Gyroscope (3-Axis)" };

const magChart = createChart("magChart", "µT", xyzDatasets("Mag"));
chartsRegistry["magChart"] = { chart: magChart, title: "Magnetometer (3-Axis)" };

// ============================================================================
// CSV COLUMN MAPPING & PARSING
// ============================================================================

function normalizeHeader(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

const COLUMN_ALIASES = {
    sample: ["sample", "packet", "index", "id", "n"],
    timeMs: ["time", "timems", "timestamp", "millis", "t", "timemillis"],
    temperature: ["temperature", "temperaturec", "temp", "tempc"],
    pressure: ["pressure", "pressurehpa", "press", "pres"],
    altitude: ["altitude", "altitudem", "alt"],
    co2: ["co2", "co2ppm", "ppm", "carbondioxide"],
    humidity: ["humidity", "rh", "humidityp", "humidityrelative", "rh%"],
    accX: ["accx", "accelx", "accelerometerx", "ax", "accxms2", "accxg", "accelerationx"],
    accY: ["accy", "accely", "accelerometery", "ay", "accyms2", "accyg", "accelerationy"],
    accZ: ["accz", "accelz", "accelerometerz", "az", "acczms2", "acczg", "accelerationz"],
    gyroX: ["gyrox", "gx", "gyroxdps", "gyroratex", "gyroscopex"],
    gyroY: ["gyroy", "gy", "gyroydps", "gyroratey", "gyroscopey"],
    gyroZ: ["gyroz", "gz", "gyrozdps", "gyroratez", "gyroscopez"],
    magX: ["magx", "mx", "magxut", "magnetometerx", "compassx", "magneticx"],
    magY: ["magy", "my", "magyut", "magnetometery", "compassy", "magneticy"],
    magZ: ["magz", "mz", "magzut", "magnetometerz", "compassz", "magneticz"]
};

function buildColumnMap(headerLine) {
    const headers = headerLine.split(",").map(function (cell) {
        return normalizeHeader(cell.trim());
    });

    const map = {};

    Object.keys(COLUMN_ALIASES).forEach(function (field) {
        const aliases = COLUMN_ALIASES[field];
        const index = headers.findIndex(function (header) {
            return aliases.indexOf(header) !== -1;
        });
        if (index !== -1) {
            map[field] = index;
        }
    });

    if (map.sample == null) map.sample = 0;
    if (map.timeMs == null && headers.length > 1) map.timeMs = 1;
    if (map.temperature == null && headers.length > 2) map.temperature = 2;
    if (map.pressure == null && headers.length > 3) map.pressure = 3;
    if (map.altitude == null && headers.length > 4) map.altitude = 4;

    return map;
}

function readNumber(columns, index) {
    if (index == null || index >= columns.length) {
        return null;
    }
    const value = Number(String(columns[index]).trim());
    return Number.isFinite(value) ? value : null;
}

function extrema(values) {
    const numbers = values.filter(function (value) {
        return value != null;
    });

    if (numbers.length === 0) {
        return { max: null, min: null };
    }

    return {
        max: Math.max.apply(null, numbers),
        min: Math.min.apply(null, numbers)
    };
}

function formatValue(value, digits, unit) {
    if (value == null) {
        return "—";
    }
    return value.toFixed(digits) + " " + unit;
}

// ============================================================================
// DERIVED CALCULATIONS
// ============================================================================

function calculateVerticalVelocity(rows) {
    const velocity = [];
    let previousAltitude = null;
    let previousTime = null;

    rows.forEach(function (row) {
        if (row.altitude != null && previousAltitude != null && previousTime != null && row.timeMs != null) {
            const altDelta = row.altitude - previousAltitude;
            const timeDelta = (row.timeMs - previousTime) / 1000;
            if (timeDelta > 0) {
                velocity.push(altDelta / timeDelta);
            } else {
                velocity.push(null);
            }
        } else {
            velocity.push(null);
        }
        previousAltitude = row.altitude;
        previousTime = row.timeMs;
    });

    return velocity;
}

// Calculate signed acceleration magnitude (shows direction based on velocity)
function calculateSignedAccelerationMagnitude(rows, velocities) {
    return rows.map(function (row, index) {
        if (row.accX != null && row.accY != null && row.accZ != null) {
            const magnitude = Math.sqrt(row.accX * row.accX + row.accY * row.accY + row.accZ * row.accZ);
            
            // Sign based on vertical velocity trend
            if (index > 0 && velocities[index] != null && velocities[index - 1] != null) {
                const accelTrend = velocities[index] - velocities[index - 1];
                return accelTrend < 0 ? -magnitude : magnitude;
            }
            return magnitude;
        }
        return null;
    });
}

function calculateOrientation(rows) {
    return rows.map(function (row) {
        if (row.accX == null || row.accY == null || row.accZ == null) {
            return { roll: null, pitch: null, yaw: null };
        }

        const roll = Math.atan2(row.accY, row.accZ) * (180 / Math.PI);
        const pitch = Math.atan2(-row.accX, Math.sqrt(row.accY * row.accY + row.accZ * row.accZ)) * (180 / Math.PI);
        
        let yaw = null;
        if (row.magX != null && row.magY != null) {
            yaw = Math.atan2(row.magY, row.magX) * (180 / Math.PI);
        }

        return { roll: roll, pitch: pitch, yaw: yaw };
    });
}

// ============================================================================
// FLIGHT PHASE DETECTION
// ============================================================================

function detectFlightPhases(rows) {
    const phases = {
        ascent: { start: null, end: null, duration: 0 },
        descent: { start: null, end: null, duration: 0 },
        apogee: { time: null, altitude: null },
        landing: { time: null }
    };

    let phase = "ground";
    let maxAltitude = -Infinity;
    let maxAltitudeIndex = -1;

    rows.forEach(function (row, index) {
        if (row.altitude == null) return;

        if (phase === "ground" && row.altitude > 10) {
            phases.ascent.start = row.timeMs;
            phase = "ascent";
        } else if (phase === "ascent" && row.altitude > maxAltitude) {
            maxAltitude = row.altitude;
            maxAltitudeIndex = index;
        } else if (phase === "ascent" && row.altitude < maxAltitude - 5) {
            phases.ascent.end = row.timeMs;
            phases.apogee.time = rows[maxAltitudeIndex].timeMs;
            phases.apogee.altitude = maxAltitude;
            phases.descent.start = row.timeMs;
            phase = "descent";
        } else if (phase === "descent" && row.altitude < 5) {
            phases.descent.end = row.timeMs;
            phases.landing.time = row.timeMs;
            phase = "landed";
        }
    });

    if (phases.ascent.start && phases.ascent.end) {
        phases.ascent.duration = (phases.ascent.end - phases.ascent.start) / 1000;
    }
    if (phases.descent.start && phases.descent.end) {
        phases.descent.duration = (phases.descent.end - phases.descent.start) / 1000;
    }

    return phases;
}

// ============================================================================
// MISSION STATISTICS DISPLAY
// ============================================================================

function displayMissionStatistics(rows, phases, velocities, accelMags) {
    const altitudeVals = rows.map(r => r.altitude).filter(v => v != null);
    const velocityVals = velocities.filter(v => v != null);
    const accelVals = accelMags.filter(v => v != null && v > 0);

    const flightTime = rows[rows.length - 1].timeMs || 0;
    const maxAlt = Math.max.apply(null, altitudeVals) || 0;
    const maxVelocity = Math.max.apply(null, velocityVals.map(v => Math.abs(v))) || 0;
    const peakAccel = Math.max.apply(null, accelVals) || 0;

    document.getElementById("stat-flightTime").textContent = formatMissionTime(flightTime);
    document.getElementById("stat-maxAlt").textContent = formatValue(maxAlt, 2, "m");
    document.getElementById("stat-ascentTime").textContent = formatValue(phases.ascent.duration, 1, "s");
    document.getElementById("stat-descentTime").textContent = formatValue(phases.descent.duration, 1, "s");
    document.getElementById("stat-maxVelocity").textContent = formatValue(maxVelocity, 2, "m/s");
    document.getElementById("stat-peakAccel").textContent = formatValue(peakAccel, 2, "g");
}

// ============================================================================
// PLAYBACK SYSTEM
// ============================================================================

function setupPlaybackControls(rows) {
    playbackState.rows = rows;
    playbackState.currentIndex = 0;

    const playBtn = document.getElementById("playBtn");
    const timeSlider = document.getElementById("timeSlider");
    const speedSlider = document.getElementById("speedSlider");

    timeSlider.max = rows.length - 1;
    timeSlider.value = 0;

    playBtn.addEventListener("click", function () {
        playbackState.isPlaying = !playbackState.isPlaying;
        playBtn.textContent = playbackState.isPlaying ? "⏸ Pause" : "▶ Play";
        if (playbackState.isPlaying) {
            playbackAnimation();
        }
    });

    timeSlider.addEventListener("input", function () {
        playbackState.currentIndex = parseInt(this.value);
        updatePlaybackDisplay();
    });

    speedSlider.addEventListener("input", function () {
        playbackState.speed = parseFloat(this.value);
        document.getElementById("speedLabel").textContent = playbackState.speed + "x";
    });
}

function updatePlaybackDisplay() {
    const row = playbackState.rows[playbackState.currentIndex];
    if (!row) return;

    const timeSlider = document.getElementById("timeSlider");
    const currentTime = formatMissionTime(row.timeMs || 0);
    const totalTime = formatMissionTime(playbackState.rows[playbackState.rows.length - 1].timeMs || 0);

    document.getElementById("playbackTime").textContent = currentTime + " / " + totalTime;
    document.getElementById("currentValues").textContent =
        "Altitude: " + formatValue(row.altitude, 1, "m") + 
        " | Temp: " + formatValue(row.temperature, 1, "°C") + 
        " | Pressure: " + formatValue(row.pressure, 1, "hPa");

    timeSlider.value = playbackState.currentIndex;

    // SYNC 3D ORIENTATION VIEWER
    if (row.roll != null && row.pitch != null && row.yaw != null) {
        syncOrientation(row.roll, row.pitch, row.yaw);
    }
}

function playbackAnimation() {
    if (!playbackState.isPlaying) return;

    playbackState.currentIndex++;
    if (playbackState.currentIndex >= playbackState.rows.length) {
        playbackState.isPlaying = false;
        document.getElementById("playBtn").textContent = "▶ Play";
        return;
    }

    updatePlaybackDisplay();

    setTimeout(playbackAnimation, 50 / playbackState.speed);
}

// ============================================================================
// CHART BINDING & DISPLAY
// ============================================================================

function bindChart(chart, labels, seriesList, events) {
    chart.data.labels = labels;
    seriesList.forEach(function (series, index) {
        chart.data.datasets[index].data = series;
    });
    chart.events = events || [];
    chart.update();
}

function detectEvents(rows) {
    const events = [];
    let previousAltitude = null;

    rows.forEach(function (row, index) {
        if (row.altitude != null && previousAltitude != null) {
            const altitudeDelta = row.altitude - previousAltitude;
            if (altitudeDelta < -10) {
                events.push({
                    index: index,
                    type: "parachute_ejection",
                    time: row.timeMs,
                    altitude: row.altitude
                });
            }
        }
        if (row.altitude != null) {
            previousAltitude = row.altitude;
        }
    });

    return events.length > 0 ? [events[0]] : [];
}

// ============================================================================
// TELEMETRY TABLE GENERATION
// ============================================================================

function generateTelemetryTable(rows) {
    const headerRow = document.getElementById("telemetryHeader");
    const bodyRows = document.getElementById("telemetryBody");
    
    bodyRows.innerHTML = "";
    headerRow.innerHTML = "";

    if (rows.length === 0) return;

    // Build header from all available fields
    const fieldsInOrder = [
        'sample', 'timeMs', 'altitude', 'temperature', 'pressure', 'humidity', 'co2',
        'accX', 'accY', 'accZ', 'gyroX', 'gyroY', 'gyroZ', 'magX', 'magY', 'magZ'
    ];

    const availableFields = fieldsInOrder.filter(field => {
        return rows.some(row => row[field] != null);
    });

    availableFields.forEach(field => {
        const th = document.createElement("th");
        const labels = {
            sample: "Sample",
            timeMs: "Time (ms)",
            altitude: "Alt (m)",
            temperature: "Temp (°C)",
            pressure: "Press (hPa)",
            humidity: "Humidity (%)",
            co2: "CO₂ (ppm)",
            accX: "Ax (g)", accY: "Ay (g)", accZ: "Az (g)",
            gyroX: "Gx (°/s)", gyroY: "Gy (°/s)", gyroZ: "Gz (°/s)",
            magX: "Mx (µT)", magY: "My (µT)", magZ: "Mz (µT)"
        };
        th.textContent = labels[field] || field;
        headerRow.appendChild(th);
    });

    // Add rows
    rows.forEach((row, idx) => {
        const tr = document.createElement("tr");
        if (idx % 2 === 0) tr.style.backgroundColor = "rgba(137, 180, 250, 0.02)";
        
        availableFields.forEach(field => {
            const td = document.createElement("td");
            const val = row[field];
            if (val == null) {
                td.textContent = "—";
            } else if (typeof val === 'number') {
                td.textContent = val.toFixed(3);
            } else {
                td.textContent = String(val);
            }
            tr.appendChild(td);
        });
        bodyRows.appendChild(tr);
    });

    document.getElementById("telemetry-meta").textContent = `${rows.length} packets, ${availableFields.length} parameters`;

    // Setup toggle button
    const toggleBtn = document.getElementById("toggleTelemetryView");
    let isCompact = true;
    toggleBtn.addEventListener("click", function() {
        const table = document.getElementById("telemetryTable");
        if (isCompact) {
            table.style.fontSize = "10px";
            toggleBtn.textContent = "Detailed";
            isCompact = false;
        } else {
            table.style.fontSize = "13px";
            toggleBtn.textContent = "Compact";
            isCompact = true;
        }
    });
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

function analyzeDataset(rows) {
    if (rows.length === 0) {
        alert("No valid telemetry rows were found in the CSV.");
        return;
    }

    lastParsedRows = rows;
    window.lastParsedRowsFor3D = rows;

    const labels = rows.map(function (row, index) {
        if (row.timeMs != null) {
            return formatMissionTime(row.timeMs);
        }
        if (row.sample != null) {
            return String(row.sample);
        }
        return String(index + 1);
    });

    const altitude = rows.map(function (row) { return row.altitude; });
    const temperature = rows.map(function (row) { return row.temperature; });
    const pressure = rows.map(function (row) { return row.pressure; });

    // Calculate derived data
    const velocity = calculateVerticalVelocity(rows);
    const accelMag = calculateSignedAccelerationMagnitude(rows, velocity);
    const orientation = calculateOrientation(rows);
    const roll = orientation.map(o => o.roll);
    const pitch = orientation.map(o => o.pitch);
    const yaw = orientation.map(o => o.yaw);

    // Store orientation in rows for playback
    rows.forEach((row, idx) => {
        row.roll = roll[idx];
        row.pitch = pitch[idx];
        row.yaw = yaw[idx];
    });

    const pressureExtrema = extrema(pressure);
    const temperatureExtrema = extrema(temperature);
    const altitudeExtrema = extrema(altitude);

    pressureMaxEl.textContent = formatValue(pressureExtrema.max, 2, "hPa");
    pressureMinEl.textContent = formatValue(pressureExtrema.min, 2, "hPa");
    temperatureMaxEl.textContent = formatValue(temperatureExtrema.max, 2, "°C");
    temperatureMinEl.textContent = formatValue(temperatureExtrema.min, 2, "°C");
    altitudeMaxEl.textContent = formatValue(altitudeExtrema.max, 2, "m");

    datasetMeta.textContent = rows.length + " samples";

    const phases = detectFlightPhases(rows);
    displayMissionStatistics(rows, phases, velocity, accelMag);

    const events = detectEvents(rows);

    bindChart(altitudeChart, labels, [altitude], events);
    bindChart(temperatureChart, labels, [temperature]);
    bindChart(pressureChart, labels, [pressure]);
    bindChart(velocityChart, labels, [velocity]);
    bindChart(accelMagChart, labels, [accelMag]);
    bindChart(orientationChart, labels, [roll, pitch, yaw]);
    bindChart(accelChart, labels, [
        rows.map(function (row) { return row.accX; }),
        rows.map(function (row) { return row.accY; }),
        rows.map(function (row) { return row.accZ; })
    ]);
    bindChart(gyroChart, labels, [
        rows.map(function (row) { return row.gyroX; }),
        rows.map(function (row) { return row.gyroY; }),
        rows.map(function (row) { return row.gyroZ; })
    ]);
    bindChart(magChart, labels, [
        rows.map(function (row) { return row.magX; }),
        rows.map(function (row) { return row.magY; }),
        rows.map(function (row) { return row.magZ; })
    ]);

    setupPlaybackControls(rows);
    generateTelemetryTable(rows);
    setupFormulaModals();

    Object.keys(chartsRegistry).forEach(function (chartId) {
        const canvas = document.getElementById(chartId);
        if (canvas && canvas.parentElement) {
            const wrapper = canvas.parentElement;
            wrapper.style.cursor = "pointer";
            wrapper.setAttribute("data-chart", chartId);
            wrapper.addEventListener("click", function () {
                openChartModal(chartsRegistry[chartId].title, chartsRegistry[chartId].chart);
            });
        }
    });
}

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);

    if (lines.length < 2) {
        return [];
    }

    const columnMap = buildColumnMap(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            continue;
        }

        const columns = line.split(",");
        const sample = readNumber(columns, columnMap.sample);
        const timeMs = readNumber(columns, columnMap.timeMs);

        if (sample == null && timeMs == null) {
            continue;
        }

        rows.push({
            sample: sample,
            timeMs: timeMs,
            temperature: readNumber(columns, columnMap.temperature),
            pressure: readNumber(columns, columnMap.pressure),
            altitude: readNumber(columns, columnMap.altitude),
            co2: readNumber(columns, columnMap.co2),
            humidity: readNumber(columns, columnMap.humidity),
            accX: readNumber(columns, columnMap.accX),
            accY: readNumber(columns, columnMap.accY),
            accZ: readNumber(columns, columnMap.accZ),
            gyroX: readNumber(columns, columnMap.gyroX),
            gyroY: readNumber(columns, columnMap.gyroY),
            gyroZ: readNumber(columns, columnMap.gyroZ),
            magX: readNumber(columns, columnMap.magX),
            magY: readNumber(columns, columnMap.magY),
            magZ: readNumber(columns, columnMap.magZ),
            roll: null,
            pitch: null,
            yaw: null
        });
    }

    return rows;
}

// ============================================================================
// MODAL SYSTEM
// ============================================================================

function createModalHTML() {
    const modal = document.createElement("div");
    modal.id = "chartModal";
    modal.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        align-items: center;
        justify-content: center;
    `;
    modal.innerHTML = `
        <div style="
            background: var(--panel);
            border: 1px solid var(--line);
            width: 90%;
            max-width: 1000px;
            height: 90vh;
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
                <h2 id="modalTitle" style="margin: 0; font-size: 16px; color: var(--ink);">Chart</h2>
                <button id="closeModal" style="
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
            <div style="
                flex: 1;
                padding: 14px;
                overflow: auto;
            ">
                <canvas id="expandedChart"></canvas>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

let expandedChartInstance = null;
const chartModal = createModalHTML();

function openChartModal(title, chartInstance) {
    document.getElementById("modalTitle").textContent = title;
    
    if (expandedChartInstance) {
        expandedChartInstance.destroy();
    }

    const expandedCanvas = document.getElementById("expandedChart");
    expandedChartInstance = new Chart(
        expandedCanvas.getContext("2d"),
        {
            type: chartInstance.config.type,
            data: JSON.parse(JSON.stringify(chartInstance.data)),
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: "index",
                    intersect: false
                },
                plugins: chartInstance.config.options.plugins,
                scales: chartInstance.config.options.scales
            },
            plugins: [eventMarkerPlugin]
        }
    );

    chartModal.style.display = "flex";
}

function closeChartModal() {
    chartModal.style.display = "none";
    if (expandedChartInstance) {
        expandedChartInstance.destroy();
        expandedChartInstance = null;
    }
}

document.getElementById("closeModal").addEventListener("click", closeChartModal);
document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && chartModal.style.display === "flex") {
        closeChartModal();
    }
});

chartModal.addEventListener("click", function(e) {
    if (e.target === chartModal) {
        closeChartModal();
    }
});

// ============================================================================
// INJECT MODAL STYLES
// ============================================================================

function injectModalStyles() {
    const style = document.createElement("style");
    style.textContent = `
        #chartModal {
            animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }

        #chartModal div {
            animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
            from {
                transform: translateY(20px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }

        .graph-card,
        .chart-wrap {
            cursor: pointer;
            transition: filter 0.2s ease;
        }

        .graph-card:hover,
        .chart-wrap:hover {
            filter: brightness(1.05);
        }

        @media (max-width: 768px) {
            #chartModal div {
                width: 95%;
                max-width: none;
                height: 80vh;
            }
        }
    `;
    document.head.appendChild(style);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectModalStyles);
} else {
    injectModalStyles();
}

// ============================================================================
// FILE UPLOAD & DRAG-DROP
// ============================================================================

function useUploadedCsv(file) {
    if (!file) {
        return;
    }

    const name = file.name || "";
    const isCsv = name.toLowerCase().endsWith(".csv") || file.type === "text/csv";

    if (!isCsv) {
        alert("Please upload a CSV file.");
        return;
    }

    fileName.textContent = "Processing: " + name;
    readCSVFile(file);
}

csvFile.addEventListener("change", function () {
    if (csvFile.files.length === 0) {
        return;
    }

    useUploadedCsv(csvFile.files[0]);
    csvFile.value = "";
});

document.addEventListener("dragover", function (event) {
    event.preventDefault();
});

document.addEventListener("drop", function (event) {
    event.preventDefault();

    const files = event.dataTransfer && event.dataTransfer.files;
    if (!files || files.length === 0) {
        return;
    }

    useUploadedCsv(files[0]);
});

function readCSVFile(file) {
    const reader = new FileReader();

    reader.onload = function (event) {
        analyzeDataset(parseCSV(event.target.result));
        fileName.textContent = "Uploaded: " + file.name;
    };

    reader.onerror = function () {
        alert("Could not read the CSV file.");
        fileName.textContent = "Upload failed";
    };

    reader.readAsText(file);
}