from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    print(pg.evaluate("""()=>{const u=makeComp('uno',0,0,0,{},'u'); const o={bbox:COMPONENTS.uno.bbox}; for(const p of ['GND_T','D13','D11','D6','D5','D3','5V','GND_1']) o[p]=worldPin(u,u.def.pins.find(q=>q.id===p)); return JSON.stringify(o);}"""))
