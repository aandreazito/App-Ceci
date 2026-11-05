"""Crea dist/agenda-ceci.html: l'app in un unico file, da pubblicare come Artifact su claude.ai."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
css = (root / 'css/style.css').read_text()
js = ''
for f in ['config.js', 'store.js', 'app.js']:
    src = (root / 'js' / f).read_text()
    src = re.sub(r'^import .*?;\n', '', src, flags=re.M)
    src = re.sub(r'^export (const|function|async function)', r'\1', src, flags=re.M)
    js += f'// ── {f} ──\n{src}\n'
icon = (root / 'icons/icon.svg').read_text()
body = html[html.index('<body>') + 6: html.index('</body>')]
js = js.replace("if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});", '')
body = body.replace('<script type="module" src="js/app.js"></script>', f'<script type="module">\n{js}</script>')
extra = """
/* dentro claude.ai: barra fissa sotto l'area di sistema */
.topbar { top: env(safe-area-inset-top, 0px); padding-top: 10px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--accent); }
main, #login { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
"""
out = f"""<title>Agenda di Ceci</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
{css}{extra}</style>
{body}"""
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/agenda-ceci.html').write_text(out)
print('ok', len(out))
