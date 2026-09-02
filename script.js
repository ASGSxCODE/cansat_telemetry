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
            }
        }
    );
}

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

const accelChart = createChart("accelChart", "g", xyzDatasets("Acc"));
const gyroChart = createChart("gyroChart", "°/s", xyzDatasets("Gyro"));
const magChart = createChart("magChart", "µT", xyzDatasets("Mag"));

function normalizeHeader(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

const COLUMN_ALIASES = {
    sample: ["sample", "packet", "index", "id", "n"],
    timeMs: ["time", "timems", "timestamp", "millis", "t", "timemillis"],
    temperature: ["temperature", "temperaturec", "temp", "tempc"],
    pressure: ["pressure", "pressurehpa", "press", "pres"],
    altitude: ["altitude", "altitudem", "alt"],
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

function bindChart(chart, labels, seriesList) {
    chart.data.labels = labels;
    seriesList.forEach(function (series, index) {
        chart.data.datasets[index].data = series;
    });
    chart.update();
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
    const reader = new FileReader();

    reader.onload = function (event) {
        analyzeDataset(parseCSV(event.target.result));
    };

    reader.onerror = function () {
        alert("Could not read the CSV file.");
    };

    reader.readAsText(file);
}

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

function analyzeDataset(rows) {
    if (rows.length === 0) {
        alert("No valid telemetry rows were found in the CSV.");
        return;
    }

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

    bindChart(altitudeChart, labels, [altitude]);
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
