"""Netcad NCZ (8.x) okuyucu.

    import netcad_ncz
    r = netcad_ncz.read('dosya.ncz')
    print(netcad_ncz.summary(r))
    gj = netcad_ncz.to_geojson(r)
"""
from .ncz_reader import blocks, layer_names, main, read, summary, to_geojson

__all__ = ['blocks', 'layer_names', 'main', 'read', 'summary', 'to_geojson']
__version__ = '1.0.0'
