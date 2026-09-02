# CanSat Ground Station

Ground station dashboard for our CanSat project. Right now it's offline-only — you upload the CSV that comes off the SD card after a flight and it parses everything and gives you charts, stats, a 3D orientation viewer, etc.

Live telemetry (getting data straight from the CanSat during the actual flight, not just after) is the next phase. Not done yet.

## What it does

- Parses the flight CSV and figures out basic mission stats — flight time, max altitude, descent time, avg temp, pressure swing, peak acceleration
- Auto-detects flight phases (ground / ascent / descent / landed) from the altitude data and marks them on the graphs
- Works out vertical velocity, total acceleration magnitude, and turn rate from the raw sensor columns since the CanSat itself doesn't log these directly
- Roll/pitch/yaw from the gyro (with the accelerometer used to correct roll/pitch drift a bit — yaw will still wander since there's no magnetometer fusion yet)
- Normal charts for altitude, temp, pressure, accel XYZ, gyro XYZ, mag XYZ
- A dual-axis chart overlaying altitude and temperature so you can eyeball the correlation
- 3D viewer that rotates a model using the gyro data — has both a box and a cylinder mode since the actual CanSat is cylindrical, so cylinder is more realistic
- Data table you can sort and filter, in case you need to actually look at raw rows
- Playback slider + play button to scrub through the flight and watch the 3D model / charts move with it

## Files

- `index.html` — layout
- `script.js` — all the CSV parsing, chart setup, stats, table, playback logic
- `orientation-viewer.js` — the Three.js 3D viewer
- `style.css` — Catppuccin Mocha theme

## Running it

No build step, just open `index.html` in a browser. Click "Upload CSV" or drag a file onto the page.

## CSV columns

The parser tries to match column headers automatically (it's not case sensitive and ignores spaces/underscores etc), so most reasonable header names should just work. Roughly what it looks for:

- sample / packet / index
- time / timestamp / millis
- temperature, pressure, altitude
- accX, accY, accZ (also accepts ax/ay/az etc.)
- gyroX, gyroY, gyroZ
- magX, magY, magZ
- co2, humidity (optional)

If it can't match a header it just falls back to assuming column order is sample, time, temp, pressure, altitude — so ideally keep that order if your headers are weird.

## Built with

- Plain JS, no frameworks
- Chart.js for the 2D graphs
- Three.js (r128) for the 3D cube/cylinder viewer

## Still TODO

- Live data from the CanSat during flight instead of just post-flight CSV
- Big-number live display for altitude/temp/pressure while it's actually flying
- Signal/connection indicator
- Alarm thresholds if a value goes out of range
- Export mission summary as PDF
- Manual event log (mark stuff like "parachute deployed" by hand)
- Compare multiple flights side by side
- Calibration screen for sensors

## License

MIT License