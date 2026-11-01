from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1000, 'height': 560})
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("""()=>{const css=[...document.styleSheets].map(s=>{try{return [...s.cssRules].map(r=>r.cssText).join('')}catch(e){return ''}}).join('');
      const one=(t,st,x,y)=>{const c=makeComp(t,0,0,0,{},'x'+x); return `<g transform="translate(${x},${y})">${COMPONENTS[t].render(c,st)}</g>`;};
      document.body.innerHTML=`<style>${css} body{background:#fafaf7}</style><svg class="circuit" style="width:980px;height:540px;position:static" viewBox="-20 -170 480 320">
        ${one('wheelL',{running:true,speed:1,dir:1},40,-20)}${one('wheelR',{running:true,speed:1,dir:-1},150,-20)}${one('relay',null,260,130)}${one('relay',{on:true},360,130)}</svg>`;}""")
    pg.wait_for_timeout(300); pg.screenshot(path='gm2.png')
