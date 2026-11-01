from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1000, 'height': 560})
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("""()=>{const css=[...document.styleSheets].map(s=>{try{return [...s.cssRules].map(r=>r.cssText).join('')}catch(e){return ''}}).join('');
      const one=(t,st,x,y)=>{const c=makeComp(t,0,0,0,{},'x'+x); return `<g transform="translate(${x},${y})">${COMPONENTS[t].render(c,st)}</g>`;};
      document.body.innerHTML=`<style>${css} body{background:#fafaf7}</style><svg class="circuit" style="width:980px;height:540px;position:static" viewBox="0 -130 400 230">
        ${one('l298n',null,200,60)}</svg>`;}""")
    pg.wait_for_timeout(300); pg.screenshot(path='l298.png')
