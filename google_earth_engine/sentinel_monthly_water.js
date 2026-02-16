// ========== SETTINGS ==========
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
