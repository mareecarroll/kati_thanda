import geopandas as gpd
import odc.stac
import planetary_computer
from pystac_client import Client
from shapely.geometry import mapping

# 1) Load AOI (Lake Eyre polygon)
aoi = gpd.read_file("../data/aoi_lake_eyre.geojson").to_crs(4326)
geom = mapping(aoi.unary_union)

# 2) Query Sentinel-2 Level-2A via STAC (Planetary Computer or element84)
catalog = Client.open(
    "https://planetarycomputer.microsoft.com/api/stac/v1",
    modifier=planetary_computer.sign_inplace,
)
search = catalog.search(
    collections=["sentinel-2-l2a"],
    intersects=geom,
    datetime="2025-04-01/2025-07-31",
    query={"eo:cloud_cover": {"lt": 80}},
)
items = list(search.get_all_items())

# 3) Load to xarray DataArray
dc = odc.stac.load(
    items,
    chunks={"x": 2048, "y": 2048},
    bands=["B03", "B11", "SCL"],
    crs="EPSG:3577",  # Australian Albers
    resolution=10,
)

# 4) Cloud/shadow mask (simplified)
cloud = (dc.SCL.isin([3, 8, 9, 10])).rename("cloudmask")  # 3 shadow; 8-10 clouds
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
area_series = (water_monthly.sum(dim=["x", "y"]) * px_area_km2).to_series()
print(area_series)
