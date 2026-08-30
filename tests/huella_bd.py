# -*- coding: utf-8 -*-
# Huella de la base de datos: cuenta filas y suma importes de las tablas
# que mueven dinero/stock. Se ejecuta ANTES y DESPUES de una tanda de
# pruebas del robot; si las dos huellas son identicas, las pruebas no
# alteraron ningun dato.
#
#   python tests/huella_bd.py antes
#   ... (pruebas) ...
#   python tests/huella_bd.py despues     -> compara con "antes"
import io
import re
import sys
import json
import hashlib
import os
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
src = io.open(os.path.join(AQUI, '..', 'index.html'), encoding='utf-8').read()
U = re.search(r"const SUPA_URL = '([^']+)'", src).group(1)
K = re.search(r"const SUPA_KEY = '([^']+)'", src).group(1)


def get(p):
    rq = urllib.request.Request(U + '/rest/v1/' + p, headers={'apikey': K, 'Authorization': 'Bearer ' + K})
    return json.load(urllib.request.urlopen(rq))


# tabla -> (columnas que se resumen numericamente, columna de orden estable)
TABLAS = {
    'ventas': ['total_usd', 'com_usd'],
    'productos': ['qty_reservada'],
    'stock_almacen': ['cantidad', 'cantidad_inicial'],
    'stock_movimientos': ['cantidad'],
    'reservas': ['total_usd'],
    'clientes': [],
    'folios': [],
    'abonos': ['equiv_usd', 'monto'],
    'mov_cajas': ['monto_origen', 'monto_destino'],
    'movimientos_ig': ['monto', 'equiv_usd'],
    'comisiones': ['com_usd', 'base_usd'],
    'liquidaciones': [],
    'contenedores': [],
    'usuarios': [],
    'com_reglas': ['pct'],
}


def huella():
    out = {}
    for t, cols in TABLAS.items():
        try:
            rows = get(t + '?select=*&limit=20000')
        except Exception as e:
            out[t] = {'error': str(e)[:80]}
            continue
        # hash de TODO el contenido (ordenado), para detectar cualquier cambio
        blob = json.dumps(sorted((json.dumps(r, sort_keys=True, ensure_ascii=False) for r in rows)), ensure_ascii=False)
        res = {'filas': len(rows), 'hash': hashlib.sha256(blob.encode('utf-8')).hexdigest()[:16]}
        for cN in cols:
            res['sum_' + cN] = round(sum(float(r.get(cN) or 0) for r in rows), 4)
        out[t] = res
    return out


modo = (sys.argv[1] if len(sys.argv) > 1 else 'antes').lower()
ruta = os.path.join(AQUI, '_huella_antes.json')
h = huella()

if modo == 'antes':
    io.open(ruta, 'w', encoding='utf-8').write(json.dumps(h, indent=1, ensure_ascii=False))
    print('Huella ANTES guardada (%d tablas):' % len(h))
    for t, r in h.items():
        print('  %-18s %6s filas  %s' % (t, r.get('filas', '?'), r.get('hash', r.get('error', ''))))
else:
    antes = json.loads(io.open(ruta, encoding='utf-8').read())
    cambios = []
    for t in TABLAS:
        a, d = antes.get(t, {}), h.get(t, {})
        if a != d:
            cambios.append((t, a, d))
    if not cambios:
        print('OK: la base de datos es IDENTICA antes y despues (%d tablas, ninguna fila ni importe cambio).' % len(h))
    else:
        print('ATENCION: %d tabla(s) cambiaron:' % len(cambios))
        for t, a, d in cambios:
            print('  %-18s antes: %s' % (t, a))
            print('  %-18s ahora: %s' % ('', d))
        sys.exit(1)
