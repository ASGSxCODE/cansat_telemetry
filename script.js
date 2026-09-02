// ============================================================================
// CanSat Telemetry Visualizer - CSV Parser & Graphing
// Processes entire CSV instantly, plots all graphs
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
let lastParsedRows = []; // Store for future use

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
// CHART CREATION (with event marker plugin & tooltips)
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
                        titleColor: "#c9a227",
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

// ============================================================================
// MODAL SYSTEM FOR EXPANDED GRAPHS
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
            border-radius: 4px;
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
                    color: #1a160c;
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
    
    // Destroy existing expanded chart if any
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

// Close modal on Esc or close button
document.getElementById("closeModal").addEventListener("click", closeChartModal);
document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && chartModal.style.display === "flex") {
        closeChartModal();
    }
});

// Close on background click
chartModal.addEventListener("click", function(e) {
    if (e.target === chartModal) {
        closeChartModal();
    }
});

// ============================================================================
// CREATE ALL CHARTS (with click handlers)
// ============================================================================

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

const accelChart = createChart("accelChart", "g", xyzDatasets("Acc"));
chartsRegistry["accelChart"] = { chart: accelChart, title: "Accelerometer (3-Axis)" };

const gyroChart = createChart("gyroChart", "°/s", xyzDatasets("Gyro"));
chartsRegistry["gyroChart"] = { chart: gyroChart, title: "Gyroscope (3-Axis)" };

const magChart = createChart("magChart", "µT", xyzDatasets("Mag"));
chartsRegistry["magChart"] = { chart: magChart, title: "Magnetometer (3-Axis)" };

// Add click handlers to graph cards
Object.keys(chartsRegistry).forEach(function(chartId) {
    const card = document.querySelector(`[data-chart="${chartId}"]`);
    if (!card) {
        // Create wrapper if not exists
        const canvas = document.getElementById(chartId);
        if (canvas && canvas.parentElement) {
            const wrapper = canvas.parentElement;
            wrapper.style.cursor = "pointer";
            wrapper.setAttribute("data-chart", chartId);
            wrapper.addEventListener("click", function() {
                openChartModal(chartsRegistry[chartId].title, chartsRegistry[chartId].chart);
            });
        }
    } else {
        card.style.cursor = "pointer";
        card.addEventListener("click", function() {
            openChartModal(chartsRegistry[chartId].title, chartsRegistry[chartId].chart);
        });
    }
});

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

    // Fallback: auto-assign columns if not found
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
// MISSION STATE DETECTION
// ============================================================================

function detectMissionStates(rows) {
    const states = {
        groundIdle: null,
        ascent: null,
        descent: null,
        landed: null
    };

    let phase = "groundIdle";
    let previousAltitude = null;
    let descendingCount = 0;

    rows.forEach(function (row, index) {
        if (row.altitude == null) return;

        if (phase === "groundIdle" && row.altitude > 10) {
            states.ascent = { index: index, time: row.timeMs, altitude: row.altitude };
            phase = "ascent";
        } else if (phase === "ascent" && previousAltitude != null && row.altitude < previousAltitude - 5) {
            descendingCount++;
            if (descendingCount > 3) {
                states.descent = { index: index, time: row.timeMs, altitude: row.altitude };
                phase = "descent";
                descendingCount = 0;
            }
        } else if (phase === "descent" && row.altitude < 5) {
            states.landed = { index: index, time: row.timeMs, altitude: row.altitude };
            phase = "landed";
        } else if (phase !== "ascent") {
            descendingCount = 0;
        }

        previousAltitude = row.altitude;
    });

    return states;
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
// CSV PARSING & ANALYSIS
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
            magZ: readNumber(columns, columnMap.magZ)
        });
    }

    return rows;
}

function bindChart(chart, labels, seriesList, events) {
    chart.data.labels = labels;
    seriesList.forEach(function (series, index) {
        chart.data.datasets[index].data = series;
    });
    chart.events = events || [];
    chart.update();
}

function analyzeDataset(rows) {
    if (rows.length === 0) {
        alert("No valid telemetry rows were found in the CSV.");
        return;
    }

    lastParsedRows = rows;

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

    const pressureExtrema = extrema(pressure);
    const temperatureExtrema = extrema(temperature);
    const altitudeExtrema = extrema(altitude);

    pressureMaxEl.textContent = formatValue(pressureExtrema.max, 2, "hPa");
    pressureMinEl.textContent = formatValue(pressureExtrema.min, 2, "hPa");
    temperatureMaxEl.textContent = formatValue(temperatureExtrema.max, 2, "°C");
    temperatureMinEl.textContent = formatValue(temperatureExtrema.min, 2, "°C");
    altitudeMaxEl.textContent = formatValue(altitudeExtrema.max, 2, "m");

    datasetMeta.textContent = rows.length + " samples";

    const events = detectEvents(rows);
    detectMissionStates(rows); // For logging/debugging

    bindChart(altitudeChart, labels, [altitude], events);
    bindChart(temperatureChart, labels, [temperature]);
    bindChart(pressureChart, labels, [pressure]);
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
}

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

// Inject styles on load
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