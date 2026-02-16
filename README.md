# Kati Thanda

Maree—Lake Eyre/Kati Thanda is one of the best places on Earth to showcase how flood pulses travel across vast arid landscapes. 

To “show off the change in moisture” you can tell the story with two complementary signals:

1.  **Surface water** (open water extent and inundation patterns), and
2.  **Soil/land moisture** (wetness in the floodplain and salt pan before/after water arrives).

Using Google Earth Engine and Python, and Using NASA Worldview for quick visual QA and event scoping. Using **Earth Engine** or **Python + STAC** for reproducibility.


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


## Quick Start in **Google Earth Engine** (JavaScript Code Editor)

### 1) Sentinel‑2 MNDWI → Monthly Water Area over Lake Eyre

```javascript
// ========== SETTINGS ==========
var lakeEyreAOI = /* draw/import Lake Eyre polygon */;
var start = '2020-01-01';
var end   = '2026-12-31';
var scale = 10; // S2 resolution

// Sentinel-2 collection with Cloud Probability
var s2sr = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED');
var s2cloud = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY');

function addCloudMask(img) {
  var prob = ee.Image(s2cloud.filter(ee.Filter.eq('system:index', img.get('system:index'))).first());
  var cloudy = prob.select('probability').gt(40);
  // Shadows via NIR dark + projection from clouds would be better; keep simple here
  var scl = img.select('SCL');
  var shadow = scl.eq(3); // SCL 3 = cloud shadow
  var mask = cloudy.or(shadow).not();
  return img.updateMask(mask);
}

function joinCloudProb(ic, cp) {
  // Join by 'system:index' (safe for harmonized collections)
  var joined = ee.ImageCollection(ee.Join.saveFirst('cloud_prob').apply({
    primary: ic,
    secondary: cp,
    condition: ee.Filter.equals({leftField: 'system:index', rightField: 'system:index'})
  }));
  return joined.map(function(img){
    var cloudImg = ee.Image(img.get('cloud_prob'));
    var cloudy = cloudImg.select('probability').gt(40);
    var scl = img.select('SCL');
    var shadow = scl.eq(3);
    var mask = cloudy.or(shadow).not();
    return img.updateMask(mask);
  });
}

var s2 = s2sr
  .filterDate(start, end)
  .filterBounds(lakeEyreAOI)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80));

var s2cp = s2cloud
  .filterDate(start, end)
  .filterBounds(lakeEyreAOI);

var s2cm = joinCloudProb(s2, s2cp);

// Compute MNDWI = (Green - SWIR1) / (Green + SWIR1)
function addMNDWI(img) {
  var green = img.select('B3');
  var swir1 = img.select('B11');
  var mndwi = green.subtract(swir1).divide(green.add(swir1)).rename('MNDWI');
  return img.addBands(mndwi);
}

// Monthly composites
var months = ee.List.sequence(0, ee.Date(end).difference(ee.Date(start), 'month').subtract(1));

var monthly = ee.ImageCollection.fromImages(
  months.map(function(m){
    var startM = ee.Date(start).advance(m, 'month');
    var endM   = startM.advance(1, 'month');
    var mosaic = s2cm.filterDate(startM, endM).map(addMNDWI)
      .median() // robust against outliers
      .set('system:time_start', startM.millis());
    return mosaic;
  })
);

// Classify water: MNDWI > 0 (tune with Otsu if needed)
var monthlyWater = monthly.map(function(img){
  var water = img.select('MNDWI').gt(0).selfMask().rename('water');
  return water.copyProperties(img, ['system:time_start']);
});

// Compute water area (km²) each month
var areaTS = ee.FeatureCollection(monthlyWater.map(function(w){
  var area = w.multiply(ee.Image.pixelArea())
              .reduceRegion({reducer: ee.Reducer.sum(), geometry: lakeEyreAOI, scale: scale, maxPixels: 1e13})
              .get('water');
  var km2 = ee.Number(area).divide(1e6);
  return ee.Feature(null, {'date': ee.Date(w.get('system:time_start')).format('YYYY-MM'), 'area_km2': km2});
}));

// Chart
print(ui.Chart.feature.byFeature(areaTS, 'date', 'area_km2').setOptions({
  title: 'Lake Eyre Open Water Area (km²)',
  hAxis: {title: 'Month'},
  vAxis: {title: 'Area (km²)'}
}));

// Quick visualization
Map.centerObject(lakeEyreAOI, 8);
var lastWater = ee.Image(monthlyWater.sort('system:time_start', false).first());
Map.addLayer(lastWater, {palette: ['0000FF']}, 'Latest water mask');
```

> **Notes:**  
> • Threshold `MNDWI > 0` is a common starting point; refine via **Otsu** or manual tuning with spot checks in Worldview.  
> • For salt crusts or turbid shallow water, validate with **Sentinel‑1 SAR**.


### 2) Sentinel‑1 SAR for Cloud‑Robust Water Detection

```javascript
var aoi = lakeEyreAOI;
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate(start, end)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.eq('resolution_meters', 10))
  .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING')) // choose one pass for consistency
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .select('VV');

// Monthly min to emphasize dark water
var s1Monthly = ee.ImageCollection.fromImages(
  months.map(function(m){
    var startM = ee.Date(start).advance(m, 'month');
    var endM   = startM.advance(1, 'month');
    return s1.filterDate(startM, endM).min()
      .set('system:time_start', startM.millis());
  })
);

// Otsu threshold per month
function otsuThreshold(img, region) {
  var scale = 30;
  var hist = img.reduceRegion({
    reducer: ee.Reducer.histogram({maxBuckets: 256}),
    geometry: region,
    scale: scale,
    maxPixels: 1e13,
    bestEffort: true
  }).get('VV');
  hist = ee.Dictionary(hist);
  var counts = ee.Array(hist.get('histogram'));
  var means  = ee.Array(hist.get('bucketMeans'));
  var total = counts.reduce('sum', [0]).get([0]);
  var sum = counts.multiply(means).reduce('sum',[0]).get([0]);
  var mean = ee.Number(sum).divide(total);

  var bVar = ee.List.sequence(0, counts.length().subtract(1)).map(function(i){
    i = ee.Number(i);
    var w0 = counts.slice(0, 0, i.add(1)).reduce('sum',[0]).get([0]);
    var w1 = ee.Number(total).subtract(w0);
    var m0 = counts.slice(0,0,i.add(1)).multiply(means.slice(0,0,i.add(1))).reduce('sum',[0]).get([0]);
    var m1 = ee.Number(sum).subtract(m0);
    m0 = ee.Number(m0).divide(w0);
    m1 = ee.Number(m1).divide(w1);
    return ee.Number(w0).multiply(w1).multiply(m0.subtract(m1).pow(2));
  });

  var idx = ee.Number(ee.List(bVar).indexOf(ee.List(bVar).reduce(ee.Reducer.max())));
  return ee.Number(means.get(idx));
}

var s1WaterMonthly = s1Monthly.map(function(img){
  var thr = otsuThreshold(img, aoi);
  // Water ~ low backscatter: VV <= threshold
  var water = img.lte(thr).selfMask().rename('water');
  return water.copyProperties(img, ['system:time_start']);
});

Map.addLayer(s1WaterMonthly.first(), {palette: ['00FFFF']}, 'S1 water (first month)');
```

### 3) SMAP Soil Moisture Anomalies (Basin‑scale)

```javascript
var basinAOI = /* Lake Eyre Basin polygon */;
var smap = ee.ImageCollection('NASA/SMAP/SPL3SMP_E') // Enhanced 9 km
  .filterDate('2015-04-01', end)
  .select('soil_moisture');

// Daily mean soil moisture over basin
var daily = smap.map(function(img){
  var mean = img.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: basinAOI,
    scale: 9000,
    maxPixels: 1e13
  }).get('soil_moisture');
  return ee.Feature(null, {
    'date': ee.Date(img.get('system:time_start')).format('YYYY-MM-dd'),
    'sm': mean
  });
});
var dailyFC = ee.FeatureCollection(daily);

// Build a climatology (e.g., 2016–2020)
var baseStart = '2016-01-01';
var baseEnd   = '2020-12-31';
var base = dailyFC.filter(ee.Filter.date(baseStart, baseEnd));

function doy(dateStr){
  return ee.Date(dateStr).format('D').int();
}

// Approximate anomaly: subtract DOY mean
var baseByDOY = ee.Dictionary(
  ee.List.sequence(1, 366).map(function(d){
    var subset = base.filter(ee.Filter.eq('date_doy', d));
    var mean = ee.Number(subset.aggregate_mean('sm'));
    return [ee.Number(d), mean];
  })
);

// Add DOY to collections
var dailyWithDOY = ee.FeatureCollection(
  dailyFC.map(function(f){
    var d = ee.Date.parse('YYYY-MM-dd', f.get('date'));
    return f.set('date_doy', d.getRelative('day', 'year').add(1));
  })
);

// Compute anomaly
var dailyAnom = ee.FeatureCollection(
  dailyWithDOY.map(function(f){
    var doyVal = ee.Number(f.get('date_doy'));
    var clim = ee.Number(baseByDOY.get(doyVal, null));
    return f.set('anom', ee.Number(f.get('sm')).subtract(clim));
  })
);

// Chart anomalies
print(ui.Chart.feature.byFeature(dailyAnom, 'date', 'anom').setOptions({
  title: 'SMAP Soil Moisture Anomaly (Lake Eyre Basin)',
  hAxis: {title: 'Date'},
  vAxis: {title: 'Anomaly (m³/m³)'}
}));
```

> Tip: For polished anomalies, smooth with a 7–15‑day rolling mean and use a multi‑year baseline.


## Python (STAC/ODC/xarray) Option

If you prefer Python and a local/cloud workflow (e.g., **Azure Planetary Computer** or AWS Open Data):

```python
# Environment: geopandas, odc-stac, pystac-client, xarray, rioxarray
from pystac_client import Client
import odc.stac
import geopandas as gpd
import pandas as pd
import numpy as np
import xarray as xr
from shapely.geometry import mapping

# 1) Load AOI (Lake Eyre polygon)
aoi = gpd.read_file("aoi_lake_eyre.geojson").to_crs(4326)
geom = mapping(aoi.unary_union)

# 2) Query Sentinel-2 Level-2A via STAC (Planetary Computer or element84)
catalog = Client.open("https://planetarycomputer.microsoft.com/api/stac/v1")
search = catalog.search(
    collections=["sentinel-2-l2a"],
    intersects=geom,
    datetime="2020-01-01/2026-12-31",
    query={"eo:cloud_cover": {"lt": 80}}
)
items = list(search.get_all_items())

# 3) Load to xarray DataArray
dc = odc.stac.load(
    items,
    chunks={"x": 2048, "y": 2048},
    bands=["B03","B11","SCL"],
    stac_cfg=odc.stac.DefaultODCCfg,
    crs="EPSG:3577",  # Australian Albers
    resolution=10
)

# 4) Cloud/shadow mask (simplified)
cloud = (dc.SCL.isin([3,8,9,10])).rename("cloudmask")  # 3 shadow; 8-10 clouds
dc = dc.where(~cloud)

# 5) MNDWI
mndwi = (dc.B03 - dc.B11) / (dc.B03 + dc.B11)
mndwi = mndwi.rename("MNDWI")

# 6) Monthly composites
mndwi_monthly = mndwi.groupby("time.month").median(dim="time")

# 7) Classify water
water_monthly = (mndwi_monthly > 0).astype("uint8")

# 8) Compute area within Lake Eyre AOI
# Reproject AOI to grid CRS and rasterize mask if needed, or clip
# Approximate area per pixel (10 m)
px_area_km2 = (10 * 10) / 1e6
area_series = (water_monthly.sum(dim=["x","y"]) * px_area_km2).to_series()
print(area_series)
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

## Next Steps

1.  **Pick periods & AOIs**
    *   Which flood windows do you want to highlight? (e.g., one historical + recent SA floods)
    *   Exact polygons: Lake surface and Basin/sub‑catchments.

2.  **Choose platform(s)**
    *   **Earth Engine** for fast prototyping and publishing animations/charts.
    *   **Python** for fully open, versioned analysis and CI/CD (bonus: Azure/Planetary Computer).

3.  **Decide outputs**
    *   Web animation, dashboards (e.g., Streamlit), and/or a report/presentation (I can generate a styled PPTX).

## A few quick questions to tailor this to you

*   Do you want to track **surface water only**, or also **soil moisture** (SMAP/SAR/NDMI) for the floodplain?
*   What **date ranges** (or specific events) should we focus on?
*   Preferred stack: **Earth Engine**, **Python**, or **both**?
*   Final deliverables: **animated map**, **charts**, **dashboard**, **slide deck**, or all of the above?

