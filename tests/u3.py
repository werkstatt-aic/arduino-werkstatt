from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900}, device_scale_factor=2)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("""()=>{ App.loadProject(App.blankProject('Galerie')); const C=App.circuit;
      const L=[['led',0,0],['rgbled',40,0],['resistor',100,0],['button',170,-20],['button2',220,-20],['pushbutton',280,0],['ldr',330,0],['ntc',370,0],['poti',410,0],['tmp36',460,0],
               ['touch',0,90],['pir',70,90],['moisture',140,90],['ultrasonic',220,90],['piezo',320,90],['source',380,90],['motor',440,90],
               ['servo',0,180],['strip',150,180],['ring',300,180],['ads1115',380,180]];
      for (const [t,x,y] of L){ const c=C.addComponent(t,0,0); c.x=x; c.y=y; }
      const k=C.addComponent('keypad4',0,0); k.x=520; k.y=180;
      const ina=C.addComponent('ina219',520,0); ina.x=520; ina.y=0;
      C.renderAll(); C.select(null); C.fitView(); }""")
    pg.wait_for_timeout(300)
    pg.locator('#stage').screenshot(path='u3.png')
    print(errs or 'ok'); b.close()
