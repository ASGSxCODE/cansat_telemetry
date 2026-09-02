// ============================================================================
// CanSat Telemetry Visualizer v2.0
// Processes entire CSV instantly, plots all graphs, detects mission states
// ============================================================================

const csvFile = document.getElementById("csvFile");
const fileName = document.getElementById("file-name");
const datasetMeta = document.getElementById("dataset-meta");
const pressureMaxEl = document.getElementById("pressure-max");
const pressureMinEl = document.getElementById("pressure-min");
const temperatureMaxEl = document.getElementById("temperature-max");
const temperatureMinEl = document.getElementById("temperature-min");
const altitudeMaxEl = document.getElementById("altitude-max");
const co2MaxEl = document.getElementById("co2-max");
const humidityMaxEl = document.getElementById("humidity-max");
const missionStatesEl = document.getElementById("mission-states");

const AXIS = {
    x: "#c45c4a",
    y: "#7a9a4a",
    z: "#5b86b5"
};

const tickColor = "#8d8676";
const gridColor = "rgba(230, 223, 208, 0.08)";
let lastParsedRows = []; // Store for exports

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
// CHART CREATION (with event marker plugin)
// ============================================================================

const eventMarkerPlugin = {
    id: 'eventMarkers',
    afterDraw(chart) {
        if (!chart.events || chart.events.length === 0) return;

        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

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

            // Label
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
const altitudeChart = createChart("altitudeChart", "m", [{
    label: "Altitude",
    data: [],
    borderColor: "#c9a227",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.12
}]);

const temperatureChart = createChart("temperatureChart", "°C", [{
    label: "Temperature",
    data: [],
    borderColor: "#c45c4a",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.12
}]);

const pressureChart = createChart("pressureChart", "hPa", [{
    label: "Pressure",
    data: [],
    borderColor: "#5b86b5",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.12
}]);

const co2Chart = createChart("co2Chart", "ppm", [{
    label: "CO2",
    data: [],
    borderColor: "#a1643a",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.12
}]);

const humidityChart = createChart("humidityChart", "%", [{
    label: "Humidity",
    data: [],
    borderColor: "#2e8b9e",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.12
}]);

const accelChart = createChart("accelChart", "g", xyzDatasets("Acc"));
const gyroChart = createChart("gyroChart", "°/s", xyzDatasets("Gyro"));
const magChart = createChart("magChart", "µT", xyzDatasets("Mag"));

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
                // Consistent descent detected
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
            // Sharp descent: altitude drop > 10m (tune as needed)
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

    // Only keep first event (avoid noise)
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

    lastParsedRows = rows; // Store for export

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
    const co2 = rows.map(function (row) { return row.co2; });
    const humidity = rows.map(function (row) { return row.humidity; });

    const pressureExtrema = extrema(pressure);
    const temperatureExtrema = extrema(temperature);
    const altitudeExtrema = extrema(altitude);
    const co2Extrema = extrema(co2);
    const humidityExtrema = extrema(humidity);

    // Update UI with extrema values
    pressureMaxEl.textContent = formatValue(pressureExtrema.max, 2, "hPa");
    pressureMinEl.textContent = formatValue(pressureExtrema.min, 2, "hPa");
    temperatureMaxEl.textContent = formatValue(temperatureExtrema.max, 2, "°C");
    temperatureMinEl.textContent = formatValue(temperatureExtrema.min, 2, "°C");
    altitudeMaxEl.textContent = formatValue(altitudeExtrema.max, 2, "m");
    co2MaxEl.textContent = formatValue(co2Extrema.max, 1, "ppm");
    humidityMaxEl.textContent = formatValue(humidityExtrema.max, 1, "%");

    datasetMeta.textContent = rows.length + " samples";

    // Detect mission states & events
    const missionStates = detectMissionStates(rows);
    const events = detectEvents(rows);

    // Display mission states
    displayMissionStates(missionStates);

    // Bind all charts with event markers
    bindChart(altitudeChart, labels, [altitude], events);
    bindChart(temperatureChart, labels, [temperature]);
    bindChart(pressureChart, labels, [pressure]);
    bindChart(co2Chart, labels, [co2]);
    bindChart(humidityChart, labels, [humidity]);
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

function displayMissionStates(states) {
    let html = "<div style='font-size: 12px; line-height: 1.6;'>";
    html += "<strong>Mission Timeline:</strong><br>";
    html += "🚀 Ascent: " + (states.ascent ? formatMissionTime(states.ascent.time) : "—") + "<br>";
    html += "📉 Descent: " + (states.descent ? formatMissionTime(states.descent.time) : "—") + "<br>";
    html += "🎯 Landing: " + (states.landed ? formatMissionTime(states.landed.time) : "—");
    html += "</div>";
    missionStatesEl.innerHTML = html;
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

// ============================================================================
// EXPORT ANALYSIS REPORT
// ============================================================================

function exportAnalysisReport(filename) {
    if (lastParsedRows.length === 0) {
        alert("No data to export. Upload a CSV first.");
        return;
    }

    const rows = lastParsedRows;
    const missionStates = detectMissionStates(rows);

    const extremaData = {
        pressure: extrema(rows.map(r => r.pressure)),
        temperature: extrema(rows.map(r => r.temperature)),
        altitude: extrema(rows.map(r => r.altitude)),
        co2: extrema(rows.map(r => r.co2)),
        humidity: extrema(rows.map(r => r.humidity))
    };

    let report = "=== CanSat Telemetry Analysis Report ===\n\n";
    report += "Dataset: " + filename + "\n";
    report += "Generated: " + new Date().toISOString() + "\n";
    report += "Samples: " + rows.length + "\n";
    report += "Duration: " + formatMissionTime(rows[rows.length - 1].timeMs || 0) + "\n\n";

    report += "--- EXTREMA VALUES ---\n";
    report += "Altitude:    " + formatValue(extremaData.altitude.max, 2, "m") + " (max) | " + formatValue(extremaData.altitude.min, 2, "m") + " (min)\n";
    report += "Temperature: " + formatValue(extremaData.temperature.max, 2, "°C") + " (max) | " + formatValue(extremaData.temperature.min, 2, "°C") + " (min)\n";
    report += "Pressure:    " + formatValue(extremaData.pressure.max, 2, "hPa") + " (max) | " + formatValue(extremaData.pressure.min, 2, "hPa") + " (min)\n";
    report += "CO2:         " + formatValue(extremaData.co2.max, 1, "ppm") + " (max) | " + formatValue(extremaData.co2.min, 1, "ppm") + " (min)\n";
    report += "Humidity:    " + formatValue(extremaData.humidity.max, 1, "%") + " (max) | " + formatValue(extremaData.humidity.min, 1, "%") + " (min)\n\n";

    report += "--- MISSION TIMELINE ---\n";
    report += "Ascent:  " + (missionStates.ascent ? formatMissionTime(missionStates.ascent.time) : "—") + "\n";
    report += "Descent: " + (missionStates.descent ? formatMissionTime(missionStates.descent.time) : "—") + "\n";
    report += "Landing: " + (missionStates.landed ? formatMissionTime(missionStates.landed.time) : "—") + "\n";

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(".csv", "") + "_analysis.txt";
    a.click();
    URL.revokeObjectURL(url);
}

// Add export button listener
if (document.getElementById("export-report")) {
    document.getElementById("export-report").addEventListener("click", function () {
        const file = csvFile.files[0];
        if (!file) {
            alert("Upload a CSV first");
            return;
        }
        exportAnalysisReport(file.name);
    });
}