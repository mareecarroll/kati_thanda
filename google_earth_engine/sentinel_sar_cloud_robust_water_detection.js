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

// Compute a list of month offsets between start and end
var nMonths = ee.Date(end).difference(ee.Date(start), 'month').int();
var months = ee.List.sequence(0, nMonths.subtract(1));

// Sentinel-1 VV collection (one pass for consistency)
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(lakeEyreAOI)
  .filterDate(start, end)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.eq('resolution_meters', 10))
  .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .select('VV');

// Helper: create an empty masked image with band 'VV' and set properties
function emptyMonthlyImage(aoi, timeStart) {
  return ee.Image(0).rename('VV')
    .clip(aoi)
    .updateMask(ee.Image(0)) // fully masked
    .setMulti({
      'system:time_start': timeStart,
      'empty': true
    });
}

// Monthly min composite (emphasize dark water)
// Guard against months with no S1 images for the AOI/time window
var s1Monthly = ee.ImageCollection.fromImages(
  months.map(function(m) {
    var startM = ee.Date(start).advance(m, 'month');
    var endM   = startM.advance(1, 'month');
    var monthly = s1.filterDate(startM, endM);

    return ee.Algorithms.If(
      monthly.size().gt(0),
      ee.ImageCollection(monthly).min().set({'system:time_start': startM.millis()}),
      emptyMonthlyImage(lakeEyreAOI, startM.millis())
    );
  })
);

// Otsu threshold per month (fixed)
function otsuThreshold(img, region) {
  var hist = img.reduceRegion({
    reducer: ee.Reducer.histogram({maxBuckets: 256}),
    geometry: region,
    scale: 30,
    maxPixels: 1e13,
    bestEffort: true
  }).get('VV');

  var histDict = ee.Dictionary(hist);
  // If no histogram (e.g., image fully masked), return fallback
  var counts = ee.Array(histDict.get('histogram', []));
  var means  = ee.Array(histDict.get('bucketMeans', []));

  var isEmpty = counts.length().get([0]).eq(0);
  var fallback = ee.Number(0.05); // for linear sigma0; if using dB, use e.g. -15

  return ee.Algorithms.If(isEmpty, fallback, ee.Number((function() {
    var total = counts.reduce('sum', [0]).get([0]);
    var sum   = counts.multiply(means).reduce('sum', [0]).get([0]);

    // IMPORTANT: extract scalar length
    var n = ee.Number(counts.length().get([0]));
    var indices = ee.List.sequence(0, n.subtract(1));

    var bVar = indices.map(function(i) {
      i = ee.Number(i);

      var c0 = counts.slice(0, 0, i.add(1));
      var c1 = counts.slice(0, i.add(1), n);

      var w0 = ee.Number(c0.reduce('sum', [0]).get([0])).max(1e-12);
      var w1 = ee.Number(c1.reduce('sum', [0]).get([0])).max(1e-12);

      var m0 = c0.multiply(means.slice(0, 0, i.add(1))).reduce('sum', [0]).get([0]);
      var m1 = ee.Number(sum).subtract(m0);

      m0 = ee.Number(m0).divide(w0);
      m1 = ee.Number(m1).divide(w1);

      return w0.multiply(w1).multiply(m0.subtract(m1).pow(2));
    });

    var maxVal = ee.Number(ee.List(bVar).reduce(ee.Reducer.max()));
    var idx = ee.Number(ee.List(bVar).indexOf(maxVal));
    // Convert bucket means array to list to index safely
    return ee.Number(means.toList().get(idx));
  })()));
}

// Classify water masks per month
var s1WaterMonthly = ee.ImageCollection(
  s1Monthly.map(function(img) {
    img = ee.Image(img);
    var thr = ee.Number(otsuThreshold(img, lakeEyreAOI));
    var water = img.lte(thr).selfMask().rename('water');
    return water.copyProperties(img, ['system:time_start']);
  })
);

// Visualize the first month (that exists in the collection)
Map.centerObject(lakeEyreAOI, 7);
var firstImg = s1WaterMonthly.first(); // Will be masked if month was empty
Map.addLayer(firstImg, {palette: ['00FFFF']}, 'S1 water (first month)');:1

