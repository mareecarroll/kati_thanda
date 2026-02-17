# Kati Thanda

Lake Eyre/Kati Thanda is one of the best places on Earth to showcase how flood pulses travel across vast arid landscapes. 

To “show off the change in moisture” you can tell the story with two complementary signals:

1.  **Surface water** (open water extent and inundation patterns), and
2.  **Soil/land moisture** (wetness in the floodplain and salt pan before/after water arrives).

Using Google Earth Engine and Python, and Using NASA Worldview for quick visual QA and event scoping. Using **Earth Engine** or **Python + STAC** for reproducibility.

## Significant events in recent times

### 2025 March/April to June

In 2025, a rare and significant flooding event saw massive amounts of water travel over 1,000 kilometers from Western Queensland down to Kati Thanda–Lake Eyre in South Australia, transforming the arid salt pan into a sprawling inland sea. The event, driven by record-breaking March/April rainfalls, resulted in one of the largest fillings of the lake in over 50 years. 

#### Key Aspects of the 2025 Flood Event
* **The Journey**: Floodwaters originated from heavy autumn rainfall in southwest Queensland (affecting towns like Windorah and Birdsville) and moved through the Channel Country, filling the Diamantina and Warburton river systems before reaching the lake.
Arrival and Peak: Water began entering the northern side of Lake Eyre around the start of May 2025, with major flows continuing through June and July. By July, it was estimated that up to 90% of the lake was covered in water.
* **Significance**: This is a "once-in-a-generation" event,, with some observers comparing it to the major 1974 flood.
* **Impact**: The water has brought new life to the desert, attracting millions of waterbirds to breed and triggering a massive bloom in aquatic species. 

#### Animations and Satellite Imagery
Various animations, created from satellite data (NASA MODIS, Landsat 8/9, and BOM imagery), show the transformation from April to June 2025: 
* [NASA Science: "Water Pours Into Australia's Lake Eyre"](https://science.nasa.gov/earth/earth-observatory/water-pours-into-australias-lake-eyre-154451/) especially the [animation link itself](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/154000/154451/lakeeyre_tmo_20250612.mp4)
* Bureau of Meteorology (BOM): Social media updates, particularly in May/June 2025. e.g. [Queensland floods: the water journey to Kati Thanda-Lake Eyre](https://www.bom.gov.au/video/queensland-floods-the-water-journey-to-kati-thanda-lake-eyre)
* Bureau of Meteorology (March - May 2025): A satellite loop showing the water travelling through the river channels, such as Cooper Creek and the Warburton River.

The floodwaters are expected to remain for several months, with the lake potentially holding water for up to a year. 

## What to Measure

### A. Surface water (open water extent):

*   **Sentinel‑2 MSI (10 m)**: Use **MNDWI** or **NDWI** with cloud masking (S2 Level‑2A + cloud probability).
*   **Landsat 5/7/8/9 (30 m)**: Long time series back to the 1980s; great for historical context (e.g., 2010–11 flood).
*   **Sentinel‑1 SAR (10 m)**: Radar sees through clouds; very robust water detection via VV/VH backscatter.

### B. Soil/land moisture:

*   **SMAP L3 (∼9 km)**: Daily soil moisture—excellent for basin‑scale anomalies and lag analysis.
*   **Sentinel‑1 SAR**: Backscatter sensitivity to wet surfaces; track wetting/drying of floodplains at 10 m.
*   **NDMI from Landsat/Sentinel‑2**: Vegetation/soil wetness proxy—but salt crust and bare soil can confound.

### C. Reference layers (quality & context):

*   **JRC Global Surface Water (30 m)** for long‑term water occurrence & seasonality (baseline).
*   **DEA Water Observations (Geoscience Australia)** if you want an “out‑of‑the‑box” water detection check against your own results.
*   **Lake Eyre Basin boundary + rivers** (Geofabric/GA) to set your AOI and compute reach‑wise lags (Diamantina, Georgina, Cooper Creek, Warburton).


## Analysis Workflow

1.  **Define AOI & periods**
    *   AOI: Lake Eyre Basin (and a sub‑AOI for the lake itself).
    *   Periods: pick 2–4 flood episodes (e.g., one historical, one recent) + a dry baseline.

2.  **Ingest data & preprocess**
    *   Use **surface reflectance** (Landsat Collection 2 SR; Sentinel‑2 L2A).
    *   **Mask clouds** (S2 Cloud Probability), shadows, and low‑quality pixels.
    *   For SAR, apply orbit/angle filters and speckle smoothing (optional).

3.  **Compute indices & classifications**
    *   **MNDWI** (Sentinel‑2: Green vs SWIR1) → threshold (e.g., > 0) or Otsu for water.
    *   **SAR water**: low VV (or VH) backscatter → adaptive threshold (Otsu) per mosaic.
    *   **Soil moisture**: SMAP daily mean within AOI; compute anomalies vs a multi‑year baseline.
    *   Optional: **NDMI** for wetness in vegetated floodplains.

4.  **Temporal compositing**
    *   Create **monthly** or **biweekly** composites to smooth clouds & noise.
    *   For SAR, create per‑month min composite (water tends to be darkest).

5.  **Metrics**
    *   **Lake water area (km²)** by month (lake AOI).
    *   **Floodplain wetness/soil moisture anomaly** by sub‑catchment.
    *   **Lag analysis**: Cross‑correlate upstream wetness/rainfall/soil moisture with Lake Eyre water area; compute time lag in days/weeks.

6.  **Visualizations**
    *   **Animated map** of water extent progression from Channel Country to Lake Eyre.
    *   **Time series charts**:
        *   Lake Eyre open water area vs. time,
        *   SMAP soil moisture anomalies (basin & sub‑catchments),
        *   Cross‑correlation/lag plot.
    *   **Distance–time (Hovmöller) diagram** along the Warburton/Cooper path to show the flood wave moving downstream.

7.  **QA & interpretation**
    *   Inspect tricky scenes (salt crusts, wet mud, shallow water) in true color (Worldview).
    *   Compare S2 vs SAR maps during cloudy periods.
    *   Sanity‑check with JRC/DEA layers.

## 1) Sentinel‑2 MNDWI → Monthly Water Area over Lake Eyre (Google Earth Engine)

see [sentinel_monthly_water.js](google_earth_engine/sentinel_monthly_water.js)

> **Notes:**  
> • Threshold `MNDWI > 0` is a common starting point; refine via **Otsu** or manual tuning with spot checks in Worldview.  
> • For salt crusts or turbid shallow water, validate with **Sentinel‑1 SAR**.


## 2) Sentinel‑1 SAR for Cloud‑Robust Water Detection (Google Earth Engine)

see [sentinel_sar_cloud_robust_water_detection.js](google_earth_engine/sentinel_sar_cloud_robust_water_detection.js)

## 3) SMAP Soil Moisture Anomalies (Basin‑scale)

see [smap_soil_moisture_anomalies_basin_scale.js](google_earth_engine/smap_soil_moisture_anomalies_basin_scale.js)

> Tip: For polished anomalies, smooth with a 7–15‑day rolling mean and use a multi‑year baseline.

## 4) Python (STAC/ODC/xarray) Option

Python and a local/cloud workflow (e.g., **Azure Planetary Computer** or AWS Open Data):

Using [kati_thanda.lock](kati_thanda.lock) conda environment.

see [compute_area_within_monthly.py](python/compute_area_within_monthly.py)

```shell
conda craete -n kati-thanda --file kati_thanda.lock
conda activate kati-thanda
cd python
python compute_area_within_monthly.py
```

> Swap in **Sentinel‑1** (via `sentinel-1-grd`) for radar water masks or compute NDMI using NIR/SWIR for wetness. For interactive maps, export to GeoTIFF/COGs and serve via a web map or build a **Kepler.gl** or **Folium** dashboard.

## Visual Storytelling & Deliverables

*   **Hero animation** (15–45s): A monthly sequence showing water advancing from the Channel Country into Kati Thanda–Lake Eyre, with labels for Diamantina, Georgina, Cooper Creek/Warburton.
*   **Charts**:
    *   Lake Eyre **open water area (km²)** over time with markers for flood arrivals.
    *   **SMAP soil moisture anomalies** by sub‑catchment (north → south), illustrating progressive wetting.
    *   **Lag chart**: cross‑correlation between upstream wetness and lake water area (quantify “how long until Lake Eyre fills?”).
*   **Static maps**: “Before vs During vs After” flood small multiples (S2 + SAR) with consistent styling.
*   **Notebook/Repo**: Reproducible pipeline (EE scripts and/or Python), clear README, parameters for AOIs, dates, thresholds.

Apply a cohesive color palette (e.g., **water: #2478FF**, **wet floodplain: #00D1B2**, **dry: greys**) across maps, charts, and the final report/deck.


## Pitfalls & How to Handle Them

*   **Clouds & shadows**: Rely on S2 Cloud Probability; backstop with **Sentinel‑1** during persistent cloud cover.
*   **Salt crust & bright sediments**: MNDWI can misclassify—validate with **SAR**; tune thresholds per month using **Otsu**.
*   **Shallow/turbid water**: May look “non‑blue” in RGB; indices are better.
*   **Geometric consistency**: Stick to one projection (e.g., EPSG:3577) for area calculations.
*   **Sampling bias**: Use **monthly** composites to stabilize and ensure comparability.
*   **SMAP resolution**: Great for anomalies and lag metrics (basin scale), not for fine mapping.

## Steps

1.  **Pick periods & AOIs**
    *   Which flood windows do you want to highlight? (e.g., one historical + recent SA floods)
    *   Exact polygons: Lake surface and Basin/sub‑catchments.

2.  **Choose platform(s)**
    *   **Earth Engine** for fast prototyping and publishing animations/charts.
    *   **Python** for fully open, versioned analysis and CI/CD (bonus: Azure/Planetary Computer).

3.  **Decide outputs**
    *   Web animation, dashboards (e.g., Streamlit), and/or a report/presentation (I can generate a styled PPTX).

## Questions

*   Do you want to track **surface water only**, or also **soil moisture** (SMAP/SAR/NDMI) for the floodplain?
*   Preferred stack: **Earth Engine**, **Python**, or **both**?
*   Final deliverables: **animated map**, **charts**, **dashboard**, **slide deck**, or all of the above?

