from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1000, 'height': 700})
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("""()=>{const c=makeComp('relay',0,0,0,{},'x1'); const css=[...document.styleSheets].map(s=>{try{return [...s.cssRules].map(r=>r.cssText).join('')}catch(e){return ''}}).join('');
      const one=(st,y)=>`<g transform="translate(30,${y})">${COMPONENTS.relay.render(c,st)}</g>`;
      document.body.innerHTML=`<style>${css} body{background:#fafaf7}</style><svg class="circuit" style="width:980px;height:680px;position:static" width="980" height="680" viewBox="-10 -80 330 230">${one(null,10)}${one({on:true},120)}</svg>`;}""")
    pg.wait_for_timeout(300); pg.screenshot(path='rel2.png')
