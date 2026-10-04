from pathlib import Path
g = Path(r"D:\dev\LifeApp\src\pages\creator\api\generate.ts").read_text(encoding="utf-8")
print("len", len(g))
print("template count", g.count("${"))
print("backslash-HTTP", "\\HTTP" in g)
print("bad replace", "\\\\/api" in g)
shown = 0
for i, line in enumerate(g.splitlines(), 1):
    if "fetch(" in line or "replace(/" in line or "source:" in line[:20]:
        print(str(i) + ":" + line[:120])
        shown += 1
        if shown > 20:
            break
# Also check CreatorWrapper
c = Path(r"D:\dev\LifeApp\src\pages\creator\CreatorWrapper.tsx").read_text(encoding="utf-8")
print("wrapper templates", c.count("${"))
print("wrapper len", len(c))
