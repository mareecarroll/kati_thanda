var lakeEyreAOI = ee.Geometry.Polygon(
  [
    [136.74335937499998,-28.09237505565586],
    [136.88618164062498,-28.227977535979104],
    [136.80927734374998,-28.382741075729506],
    [136.78730468749998,-28.69159074212909],
    [136.83124999999998,-29.009140392892075],
    [137.16083984374998,-29.076374558071787],
    [137.01801757812498,-29.325717112252402],
    [137.10590820312498,-29.60311243929047],
    [137.74311523437498,-29.373597989058965],
    [138.13862304687498,-29.047565280530485],
    [137.89692382812498,-28.913015660085264],
    [137.76508789062498,-28.52762707342042],
    [137.53437499999998,-28.01481087863716],
    [137.11689453124998,-27.76234173358644],
    [136.71040039062498,-27.87893910675135],
    [136.74335937499998,-28.09237505565586],
  ]
);
var start = '2025-04-29';
var end   = '2025-06-12';
var smap = ee.ImageCollection('NASA/SMAP/SPL3SMP_E/006') // Enhanced 9 km
  .filterDate('2015-04-01', end)
  .select('soil_moisture');

// Daily mean soil moisture over basin
var daily = smap.map(function(img){
  var mean = img.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: lakeEyreAOI,
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
    var mean = subset.aggregate_mean('sm');
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
