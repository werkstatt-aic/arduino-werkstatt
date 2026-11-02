from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    pg.evaluate("()=>{App.setExtensions(['motoren']); App.setMode('code');}"); pg.wait_for_timeout(500)
    pg.evaluate("()=>{const t=App.workspace.getToolbox(); t.setSelectedItem(t.getToolboxItems().find(i=>i.getName&&i.getName()==='Motoren'));}"); pg.wait_for_timeout(500)
    pg.screenshot(path='car2.png', clip={'x': 640, 'y': 90, 'width': 760, 'height': 560})
