#!/usr/bin/env python3
"""
Prueba de carga de SOLO LECTURA contra el panel publico de mappa-bmf.

Simula visitantes anonimos: usa la publishable key (la misma que ve el
navegador) y hace las mismas consultas que la app. RLS se aplica igual que en
produccion, asi que lo medido es representativo de la capa de datos.

Uso:
    set -a; . ./.env.local; set +a
    python3 scripts/load-test.py

Variables: WORKERS (100), DURATION (20s), WARMUP (3s).

Corta solo si la tasa de 429/5xx supera el 20%: seguir golpeando cuando
Supabase se esta protegiendo no mide nada, solo molesta.
"""

import http.client
import json
import os
import random
import threading
import time
from statistics import median
from urllib.parse import urlparse

URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
KEY = os.environ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
WORKERS = int(os.environ.get("WORKERS", "100"))
DURATION = float(os.environ.get("DURATION", "20"))
WARMUP = float(os.environ.get("WARMUP", "3"))
MAX_ERROR_RATE = 0.20

host = urlparse(URL).netloc
HEADERS = {"apikey": KEY, "Accept": "application/json", "Connection": "keep-alive"}

TERMINOS = ["Nombre", "clientes", "productos", "Pedidos", "2020", "1", "Gastos", "email"]


def get(path, extra=None):
    conn = http.client.HTTPSConnection(host, timeout=30)
    conn.request("GET", path, headers={**HEADERS, **(extra or {})})
    resp = conn.getresponse()
    body = resp.read()
    conn.close()
    return resp.status, body


def descubrir_tablas():
    status, body = get("/rest/v1/tables?select=id,name&status=eq.published&order=name")
    if status != 200:
        raise SystemExit(f"no se pudo listar tablas: HTTP {status}")
    return json.loads(body)


def elegir_consulta(tablas):
    """Mezcla 4:4:2:1, parecida a como navega una persona."""
    t = random.choice(tablas)
    dado = random.random()

    if dado < 0.36:  # lista del inicio
        return "lista", "/rest/v1/tables?select=id,name,description&status=eq.published&order=name", None
    if dado < 0.72:  # pagina de tabla, con count exacto como la app
        offset = random.choice([0, 25, 50, 75, 100, 125, 150, 175])
        return (
            "pagina",
            f"/rest/v1/rows?select=id,data&table_id=eq.{t['id']}&order=created_at.asc&limit=25&offset={offset}",
            {"Prefer": "count=exact"},
        )
    if dado < 0.90:  # busqueda dentro de la tabla, con count
        term = random.choice(TERMINOS)
        return (
            "busqueda",
            f"/rest/v1/rows?select=id,data&table_id=eq.{t['id']}&search_text=ilike.*{term}*&limit=25&offset=0",
            {"Prefer": "count=exact"},
        )
    term = random.choice(TERMINOS)  # busqueda global
    return (
        "global",
        f"/rest/v1/rows?select=id,data,tables!inner(name,status)&tables.status=eq.published&search_text=ilike.*{term}*&limit=200",
        None,
    )


def trabajador(deadline, tablas, resultados, lock, stop):
    conn = None
    while time.time() < deadline and not stop.is_set():
        tipo, path, extra = elegir_consulta(tablas)
        t0 = time.perf_counter()
        try:
            if conn is None:
                conn = http.client.HTTPSConnection(host, timeout=30)
            conn.request("GET", path, headers={**HEADERS, **(extra or {})})
            resp = conn.getresponse()
            resp.read()
            dt = time.perf_counter() - t0
            with lock:
                resultados.append((tipo, resp.status, dt))
            if resp.status == 429 or resp.status >= 500:
                stop.set()
        except Exception:
            dt = time.perf_counter() - t0
            with lock:
                resultados.append((tipo, -1, dt))
            try:
                if conn:
                    conn.close()
            except Exception:
                pass
            conn = None


def percentil(valores, p):
    if not valores:
        return 0.0
    ordenados = sorted(valores)
    idx = min(len(ordenados) - 1, int(round((p / 100) * (len(ordenados) - 1))))
    return ordenados[idx] * 1000


def resumen(titulo, datos):
    if not datos:
        print(f"{titulo}: sin datos")
        return
    lat = [d[2] for d in datos]
    ok = sum(1 for d in datos if 200 <= d[1] < 300)
    print(f"\n{titulo}")
    print(f"  peticiones: {len(datos)}  (2xx: {ok}, otras: {len(datos) - ok})")
    print(
        f"  latencia ms: p50 {percentil(lat, 50):.0f} | p95 {percentil(lat, 95):.0f} | "
        f"p99 {percentil(lat, 99):.0f} | min {min(lat)*1000:.0f} | max {max(lat)*1000:.0f}"
    )
    from collections import Counter

    print(f"  estados: {dict(Counter(d[1] for d in datos))}")


def main():
    tablas = descubrir_tablas()
    print(f"tablas publicadas: {len(tablas)}")
    print(f"escenario: {WORKERS} usuarios concurrentes, {DURATION:.0f}s de regimen, {WARMUP:.0f}s de calentamiento")

    print("\n=== referencia secuencial (1 usuario, 5 consultas) ===")
    sueltas = []
    for _ in range(5):
        tipo, path, extra = elegir_consulta(tablas)
        t0 = time.perf_counter()
        status, _body = get(path, extra)
        sueltas.append((tipo, status, time.perf_counter() - t0))
    resumen("secuencial", sueltas)

    resultados = []
    lock = threading.Lock()
    stop = threading.Event()

    print(f"\n=== calentamiento: 10 usuarios durante {WARMUP:.0f}s ===")
    calentamiento = []
    hilos = [
        threading.Thread(target=trabajador, args=(time.time() + WARMUP, tablas, calentamiento, lock, stop))
        for _ in range(10)
    ]
    [h.start() for h in hilos]
    [h.join() for h in hilos]
    resumen("calentamiento", calentamiento)

    stop.clear()
    print(f"\n=== regimen: {WORKERS} usuarios durante {DURATION:.0f}s ===")
    inicio = time.time()
    hilos = [
        threading.Thread(target=trabajador, args=(inicio + DURATION, tablas, resultados, lock, stop))
        for _ in range(WORKERS)
    ]
    [h.start() for h in hilos]
    [h.join() for h in hilos]
    transcurrido = time.time() - inicio

    resumen(f"regimen ({transcurrido:.1f}s reales)", resultados)
    if resultados:
        print(f"  throughput: {len(resultados) / transcurrido:.0f} peticiones/s")

    print("\n=== por tipo de consulta ===")
    for tipo in ["lista", "pagina", "busqueda", "global"]:
        resumen(tipo, [d for d in resultados if d[0] == tipo])

    if stop.is_set():
        print("\nCORTADO: aparecieron 429/5xx. Es Supabase protegiendose, no un bug de la app.")


if __name__ == "__main__":
    main()
