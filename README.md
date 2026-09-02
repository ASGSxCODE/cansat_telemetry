# 🛰️ CanSat Ground Station

A web-based Ground Station dashboard for monitoring and visualizing CanSat telemetry data.

## 🚀 Project Overview

This project provides a Ground Station interface for displaying CanSat telemetry data recorded during a mission or testing session.

The current version uses a CSV telemetry file stored locally in the project and replays the recorded data through a web dashboard.

The dashboard displays:

* 🌡️ Temperature
* 💨 Atmospheric Pressure
* 📏 Altitude
* ⏱️ Mission Time
* 📦 Telemetry Packet Count
* 📈 Altitude vs Time graph
* 📈 Temperature vs Time graph
* 📋 Telemetry Log

## 🛰️ Current Telemetry Format

The current telemetry CSV contains:

```text
Sample
Time (ms)
Temperature (°C)
Pressure (hPa)
Altitude (m)
Relative Altitude (m)
```

Example:

```text
Sample,Time(ms),Temperature(C),Pressure(hPa),Altitude(m),RelativeAltitude(m)
1,2155,25.16,1007.73,46.08,-0.05
2,3155,25.16,1007.72,46.13,-0.01
3,4155,25.17,1007.73,46.09,-0.05
```

## 🧩 Hardware Planned for the CanSat

The planned CanSat hardware includes:

* ESP32
* BMP581
* BME280
* MPU9250
* INA226
* SD Card Module
* 32GB SD Card
* Lithium-Ion Battery
* Parachute

## 💻 Technologies Used

* HTML5
* CSS3
* JavaScript
* Chart.js
* CSV telemetry data
* GitHub Pages

## 📁 Project Structure

```text
CanSat-Ground-Station/
│
├── index.html
├── style.css
├── script.js
├── telemetry.csv
└── README.md
```

## ▶️ Running Locally

Clone the repository:

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

Open the project folder.

Because the browser may block local CSV requests when opening `index.html` directly, run a local web server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## 🌐 GitHub Pages

The project can be hosted using GitHub Pages.

The dashboard reads `telemetry.csv` from the repository and replays the recorded telemetry data in the browser.

## 🔮 Future Development

The current version uses recorded SD-card telemetry.

The planned final architecture is:

```text
CanSat Sensors
      ↓
ESP32 Flight Computer
      ↓
SD Card + Radio
      ↓
Ground Station Receiver
      ↓
Laptop
      ↓
Telemetry Processing
      ↓
Web Dashboard
```

Future versions can include:

* Real-time radio telemetry
* MPU9250 acceleration data
* Gyroscope data
* Magnetometer data
* BME280 humidity
* INA226 battery voltage
* INA226 current
* Battery power
* GPS/GNSS data
* RSSI
* Communication link status
* Data export
* Mission event detection
* Automatic parachute/deployment event visualization

## ⚠️ Current Limitation

The current GitHub Pages version is a telemetry replay system using recorded CSV data.

It does **not** currently receive live radio telemetry from the CanSat.

Real-time telemetry will require a communication link between the CanSat and Ground Station.

---

### Developed for CanSat Ground Station Project 🛰️
