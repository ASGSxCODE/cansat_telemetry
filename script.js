const REPLAY_INTERVAL = 1000;

const csvFile = document.getElementById("csvFile");
const fileName = document.getElementById("file-name");
const systemStatus = document.getElementById("system-status");
const communicationStatus = document.getElementById("communication-status");
const missionTime = document.getElementById("mission-time");
const packetCounter = document.getElementById("packet-count");
const temperatureDisplay = document.getElementById("temperature");
const pressureDisplay = document.getElementById("pressure");
const altitudeDisplay = document.getElementById("altitude");
const batteryDisplay = document.getElementById("battery");
const accelDisplay = document.getElementById("accel");
const gyroDisplay = document.getElementById("gyro");
const magDisplay = document.getElementById("mag");
const telemetryBody = document.getElementById("telemetry-body");
const liveLabel = document.getElementById("live-label");
const statusDot = document.getElementById("status-dot");

let telemetryData = [];
let currentPacketIndex = 0;
let receivedPackets = 0;
let replayTimer = null;

let timeData = [];
let altitudeData = [];
let temperatureData = [];
let pressureData = [];
let accelXData = [];
let accelYData = [];
let accelZData = [];
let gyroXData = [];
let gyroYData = [];
let gyroZData = [];
let magXData = [];
let magYData = [];
let magZData = [];

const AXIS = {
    x: "#c45c4a",
    y: "#7a9a4a",
    z: "#5b86b5"
};

const tickColor = "#8d8676";
const gridColor = "rgba(230, 223, 208, 0.08)";

function formatMissionTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return hours + ":" + minutes + ":" + seconds;
}

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
                            text: "Mission time",
                            color: tickColor
                        }
                    },
                    y: {
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
            }
        }
    );
}

const altitudeChart = createChart("altitudeChart", "m", [{
    label: "Altitude",
    data: [],
    borderColor: varAccent(),
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

const accelChart = createChart("accelChart", "g", xyzDatasets("Acc"));
const gyroChart = createChart("gyroChart", "°/s", xyzDatasets("Gyro"));
const magChart = createChart("magChart", "µT", xyzDatasets("Mag"));

function varAccent() {
    return "#c9a227";
}

function normalizeHeader(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

const COLUMN_ALIASES = {
    sample: ["sample", "packet", "index", "id", "n"],
    timeMs: ["time", "timems", "timestamp", "millis", "t", "timemillis"],
    temperature: ["temperature", "temperaturec", "temp", "tempc"],
    pressure: ["pressure", "pressurehpa", "press", "pres"],
    altitude: ["altitude", "altitudem", "alt"],
    relativeAltitude: ["relativealtitude", "relativealtitudem", "relalt", "relaltitude"],
    battery: ["battery", "batteryv", "voltage", "busvoltage", "vbat"],
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

    if (map.sample == null) {
        map.sample = 0;
    }
    if (map.timeMs == null && headers.length > 1) {
        map.timeMs = 1;
    }
    if (map.temperature == null && headers.length > 2) {
        map.temperature = 2;
    }
    if (map.pressure == null && headers.length > 3) {
        map.pressure = 3;
    }
    if (map.altitude == null && headers.length > 4) {
        map.altitude = 4;
    }
    if (map.relativeAltitude == null && headers.length > 5) {
        map.relativeAltitude = 5;
    }

    return map;
}

function readNumber(columns, index) {
    if (index == null || index >= columns.length) {
        return null;
    }
    const value = Number(String(columns[index]).trim());
    return Number.isFinite(value) ? value : null;
}

function formatTriple(x, y, z, digits) {
    if (x == null && y == null && z == null) {
        return "—";
    }
    function part(value) {
        return value == null ? "—" : value.toFixed(digits);
    }
    return part(x) + " / " + part(y) + " / " + part(z);
}

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

    fileName.textContent = "Uploaded: " + name;
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
    if (replayTimer) {
        clearTimeout(replayTimer);
        replayTimer = null;
    }

    systemStatus.textContent = "LOADING";
    communicationStatus.textContent = "READING";
    liveLabel.textContent = "LOADING";
    statusDot.style.background = "var(--accent)";

    const reader = new FileReader();

    reader.onload = function (event) {
        parseCSV(event.target.result);
    };

    reader.onerror = function () {
        systemStatus.textContent = "ERROR";
        communicationStatus.textContent = "ERROR";
        liveLabel.textContent = "ERROR";
        statusDot.style.background = "var(--warn)";
        alert("Could not read the CSV file.");
    };

    reader.readAsText(file);
}

function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    telemetryData = [];

    if (lines.length < 2) {
        alert("The CSV file does not contain telemetry data.");
        return;
    }

    const columnMap = buildColumnMap(lines[0]);

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

        telemetryData.push({
            sample: sample,
            timeMs: timeMs,
            temperature: readNumber(columns, columnMap.temperature),
            pressure: readNumber(columns, columnMap.pressure),
            altitude: readNumber(columns, columnMap.altitude),
            relativeAltitude: readNumber(columns, columnMap.relativeAltitude),
            battery: readNumber(columns, columnMap.battery),
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

    if (telemetryData.length === 0) {
        systemStatus.textContent = "NO DATA";
        communicationStatus.textContent = "NO FILE";
        liveLabel.textContent = "NO DATA";
        statusDot.style.background = "var(--warn)";
        alert("No valid telemetry rows were found in the CSV.");
        return;
    }

    systemStatus.textContent = "ACTIVE";
    communicationStatus.textContent = "REPLAY";
    liveLabel.textContent = "LIVE";
    statusDot.style.background = "var(--ok)";
    startReplay();
}

function bindChart(chart, labels, seriesList) {
    chart.data.labels = labels;
    seriesList.forEach(function (series, index) {
        chart.data.datasets[index].data = series;
    });
    chart.update();
}

function startReplay() {
    currentPacketIndex = 0;
    receivedPackets = 0;

    timeData = [];
    altitudeData = [];
    temperatureData = [];
    pressureData = [];
    accelXData = [];
    accelYData = [];
    accelZData = [];
    gyroXData = [];
    gyroYData = [];
    gyroZData = [];
    magXData = [];
    magYData = [];
    magZData = [];

    telemetryBody.innerHTML = "";

    bindChart(altitudeChart, timeData, [altitudeData]);
    bindChart(temperatureChart, timeData, [temperatureData]);
    bindChart(pressureChart, timeData, [pressureData]);
    bindChart(accelChart, timeData, [accelXData, accelYData, accelZData]);
    bindChart(gyroChart, timeData, [gyroXData, gyroYData, gyroZData]);
    bindChart(magChart, timeData, [magXData, magYData, magZData]);

    sendNextPacket();
}

function sendNextPacket() {
    if (currentPacketIndex >= telemetryData.length) {
        systemStatus.textContent = "COMPLETE";
        communicationStatus.textContent = "IDLE";
        liveLabel.textContent = "COMPLETE";
        statusDot.style.background = "var(--ok)";
        return;
    }

    const data = telemetryData[currentPacketIndex];
    receivedPackets++;

    temperatureDisplay.textContent = data.temperature == null
        ? "—"
        : data.temperature.toFixed(2) + " °C";
    pressureDisplay.textContent = data.pressure == null
        ? "—"
        : data.pressure.toFixed(2) + " hPa";
    altitudeDisplay.textContent = data.altitude == null
        ? "—"
        : data.altitude.toFixed(2) + " m";
    batteryDisplay.textContent = data.battery == null
        ? "—"
        : data.battery.toFixed(2) + " V";
    accelDisplay.textContent = formatTriple(data.accX, data.accY, data.accZ, 3);
    gyroDisplay.textContent = formatTriple(data.gyroX, data.gyroY, data.gyroZ, 2);
    magDisplay.textContent = formatTriple(data.magX, data.magY, data.magZ, 2);

    packetCounter.textContent = receivedPackets;

    const displayTime = data.timeMs == null
        ? String(data.sample == null ? receivedPackets : data.sample)
        : formatMissionTime(data.timeMs);

    missionTime.textContent = displayTime;
    timeData.push(displayTime);
    altitudeData.push(data.altitude);
    temperatureData.push(data.temperature);
    pressureData.push(data.pressure);
    accelXData.push(data.accX);
    accelYData.push(data.accY);
    accelZData.push(data.accZ);
    gyroXData.push(data.gyroX);
    gyroYData.push(data.gyroY);
    gyroZData.push(data.gyroZ);
    magXData.push(data.magX);
    magYData.push(data.magY);
    magZData.push(data.magZ);

    bindChart(altitudeChart, timeData, [altitudeData]);
    bindChart(temperatureChart, timeData, [temperatureData]);
    bindChart(pressureChart, timeData, [pressureData]);
    bindChart(accelChart, timeData, [accelXData, accelYData, accelZData]);
    bindChart(gyroChart, timeData, [gyroXData, gyroYData, gyroZData]);
    bindChart(magChart, timeData, [magXData, magYData, magZData]);

    const row = document.createElement("tr");
    row.innerHTML =
        "<td>" + (data.sample == null ? receivedPackets : data.sample) + "</td>" +
        "<td>" + displayTime + "</td>" +
        "<td>" + (data.temperature == null ? "—" : data.temperature.toFixed(2)) + "</td>" +
        "<td>" + (data.pressure == null ? "—" : data.pressure.toFixed(2)) + "</td>" +
        "<td>" + (data.altitude == null ? "—" : data.altitude.toFixed(2)) + "</td>" +
        "<td>" + (data.relativeAltitude == null ? "—" : data.relativeAltitude.toFixed(2)) + "</td>" +
        "<td>" + formatTriple(data.accX, data.accY, data.accZ, 3) + "</td>" +
        "<td>" + formatTriple(data.gyroX, data.gyroY, data.gyroZ, 2) + "</td>" +
        "<td>" + formatTriple(data.magX, data.magY, data.magZ, 2) + "</td>";

    telemetryBody.prepend(row);

    if (telemetryBody.children.length > 30) {
        telemetryBody.removeChild(telemetryBody.lastChild);
    }

    currentPacketIndex++;
    replayTimer = setTimeout(sendNextPacket, REPLAY_INTERVAL);
}
