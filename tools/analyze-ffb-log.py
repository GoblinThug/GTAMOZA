import json
import statistics
import collections
from pathlib import Path

logs = sorted(
    Path(r"C:\Users\gobli\AppData\Roaming\gtamoza\logs").glob("ffb-effects-*.jsonl"),
    key=lambda x: x.stat().st_mtime,
    reverse=True,
)
p = logs[0]
print("FILE", p.name, "bytes", p.stat().st_size)

samples, hosts, settings = [], [], []
for line in p.read_text(encoding="utf-8").splitlines():
    try:
        o = json.loads(line)
    except Exception:
        continue
    k = o.get("kind")
    if k == "sample":
        samples.append(o)
    elif k == "host":
        hosts.append(o)
    elif k == "settings":
        settings.append(o)

print("n sample/host/settings", len(samples), len(hosts), len(settings))
if settings:
    print("first_ffb", json.dumps(settings[0].get("ffb"), ensure_ascii=False))
    print("last_ffb", json.dumps(settings[-1].get("ffb"), ensure_ascii=False))
    print("last_fx", json.dumps(settings[-1].get("effects"), ensure_ascii=False))

inv = [s for s in samples if s.get("tel", {}).get("inVehicle")]
print("inVehicle", len(inv))


def pct(xs, q):
    xs = sorted(xs)
    return xs[int(round((len(xs) - 1) * q))]


def summarize(name, xs):
    if not xs:
        print(name, "empty")
        return
    absx = [abs(x) for x in xs]
    print(
        f"{name}: meanAbs={statistics.mean(absx):.4f} p50={pct(absx,0.5):.4f} "
        f"p90={pct(absx,0.9):.4f} p99={pct(absx,0.99):.4f} max={max(absx):.4f}"
    )


by = collections.defaultdict(list)
for s in inv:
    by[s["tel"].get("surface", "?")].append(s)
print("surfaces", {k: len(v) for k, v in sorted(by.items(), key=lambda kv: -len(kv[1]))})

for key in [
    "suspensionLat",
    "surface",
    "bump",
    "wheelSlip",
    "collision",
    "engine",
    "abs",
    "rawSum",
    "diMag",
]:
    summarize(key, [s["parts"].get(key, 0) for s in inv])

acc = {
    k: 0.0
    for k in [
        "suspensionLat",
        "suspensionYaw",
        "understeer",
        "surface",
        "bump",
        "wheelSlip",
        "collision",
        "engine",
        "abs",
    ]
}
for s in inv:
    for k in acc:
        acc[k] += abs(s["parts"].get(k, 0))
tot = sum(acc.values()) or 1
print("--- share ---")
for k, v in sorted(acc.items(), key=lambda kv: -kv[1]):
    print(f"  {k}: {100*v/tot:.1f}%")

print("--- surface contrast ---")
for surf in ("asphalt", "grass", "dirt", "kerb", "sand"):
    rows = by.get(surf, [])
    if not rows:
        print(surf, "none")
        continue
    sa = statistics.mean(abs(r["parts"]["surface"]) for r in rows)
    di = statistics.mean(abs(r["parts"]["diMag"]) for r in rows)
    print(f"{surf}: n={len(rows)} surfaceAbs={sa:.4f} diAbs={di:.0f}")

# clip proxy: |diMag| > 5000 or near 7000 cap
hi = sum(1 for s in inv if abs(s["parts"]["diMag"]) > 4500)
print(f"near_clip_samples(|di|>4500)={hi}/{len(inv)}")

if hosts:
    summarize("host.springOut", [h["springOut"] for h in hosts])
    summarize("host.gameMag", [h["gameMag"] for h in hosts])
    summarize("host.output", [h["output"] for h in hosts])
    spring_dom = sum(1 for h in hosts if abs(h["springOut"]) > abs(h["gameMag"]))
    print(f"spring_dom {spring_dom}/{len(hosts)}")
    print("centerGain", statistics.mean(h["centerGain"] for h in hosts))

if inv:
    print("duration_s", (inv[-1]["ts"] - inv[0]["ts"]) / 1000)
    print("vehicles", collections.Counter(s["tel"].get("vehicle") for s in inv).most_common(3))
