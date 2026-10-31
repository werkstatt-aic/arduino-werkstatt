/* Beispielprojekte (erzeugt mit tests/ex_build.py) */
'use strict';
const EXAMPLES = [
{
"id": "blinken",
"title": "Blinken",
"board": "uno",
"desc": "Die eingebaute LED „L“ blinkt im Sekundentakt.",
"circuit": {
"components": [
{
"id": "c1",
"type": "breadboard",
"x": 200,
"y": 200,
"rot": 0,
"props": {}
},
{
"id": "c2",
"type": "uno",
"x": 210,
"y": 460,
"rot": 0,
"props": {}
}
],
"wires": [
{
"id": "w3",
"a": {
"c": "c2",
"p": "5V"
},
"b": {
"c": "c1",
"p": "bp-1"
},
"pts": [
[
370,
690
],
[
180,
690
],
[
180,
390
]
],
"color": "rot"
},
{
"id": "w4",
"a": {
"c": "c2",
"p": "GND_1"
},
"b": {
"c": "c1",
"p": "bm-2"
},
"pts": [
[
380,
700
],
[
170,
700
],
[
170,
380
]
],
"color": "schwarz"
},
{
"id": "w5",
"a": {
"c": "c1",
"p": "bp-29"
},
"b": {
"c": "c1",
"p": "tp-29"
},
"pts": [
[
550,
390
],
[
550,
220
]
],
"color": "rot"
},
{
"id": "w6",
"a": {
"c": "c1",
"p": "bm-28"
},
"b": {
"c": "c1",
"p": "tm-28"
},
"pts": [
[
540,
380
],
[
540,
210
]
],
"color": "schwarz"
}
]
},
"blocks": "<xml xmlns=\"https://developers.google.com/blockly/xml\"><block type=\"ard_setup\" x=\"30\" y=\"30\"><statement name=\"DO\"></statement></block><block type=\"ard_loop\" x=\"30\" y=\"120\"><statement name=\"DO\"><block type=\"ard_builtin_led\"><field name=\"V\">HIGH</field><next><block type=\"ard_wait\"><field name=\"UNIT\">S</field><value name=\"N\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value><next><block type=\"ard_builtin_led\"><field name=\"V\">LOW</field><next><block type=\"ard_wait\"><field name=\"UNIT\">S</field><value name=\"N\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value></block></next></block></next></block></next></block></statement></block></xml>"
},
{
"id": "ampel",
"title": "Ampelschaltung",
"board": "uno",
"desc": "Drei LEDs mit Vorwiderstand schalten wie eine Verkehrsampel.",
"circuit": {
"components": [
{
"id": "c1",
"type": "breadboard",
"x": 200,
"y": 200,
"rot": 0,
"props": {}
},
{
"id": "c2",
"type": "uno",
"x": 210,
"y": 460,
"rot": 0,
"props": {}
},
{
"id": "c7",
"type": "led",
"x": 240,
"y": 310,
"rot": 0,
"props": {
"color": "rot"
}
},
{
"id": "c8",
"type": "resistor",
"x": 250,
"y": 330,
"rot": 0,
"props": {
"ohm": 220
}
},
{
"id": "c10",
"type": "led",
"x": 320,
"y": 310,
"rot": 0,
"props": {
"color": "gelb"
}
},
{
"id": "c11",
"type": "resistor",
"x": 330,
"y": 330,
"rot": 0,
"props": {
"ohm": 220
}
},
{
"id": "c13",
"type": "led",
"x": 410,
"y": 310,
"rot": 0,
"props": {
"color": "gruen"
}
},
{
"id": "c14",
"type": "resistor",
"x": 420,
"y": 330,
"rot": 0,
"props": {
"ohm": 220
}
}
],
"wires": [
{
"id": "w3",
"a": {
"c": "c2",
"p": "5V"
},
"b": {
"c": "c1",
"p": "bp-1"
},
"pts": [
[
370,
690
],
[
180,
690
],
[
180,
390
]
],
"color": "rot"
},
{
"id": "w4",
"a": {
"c": "c2",
"p": "GND_1"
},
"b": {
"c": "c1",
"p": "bm-2"
},
"pts": [
[
380,
700
],
[
170,
700
],
[
170,
380
]
],
"color": "schwarz"
},
{
"id": "w5",
"a": {
"c": "c1",
"p": "bp-29"
},
"b": {
"c": "c1",
"p": "tp-29"
},
"pts": [
[
550,
390
],
[
550,
220
]
],
"color": "rot"
},
{
"id": "w6",
"a": {
"c": "c1",
"p": "bm-28"
},
"b": {
"c": "c1",
"p": "tm-28"
},
"pts": [
[
540,
380
],
[
540,
210
]
],
"color": "schwarz"
},
{
"id": "w9",
"a": {
"c": "c1",
"p": "8j"
},
"b": {
"c": "c1",
"p": "bm-8"
},
"pts": [],
"color": "schwarz"
},
{
"id": "w12",
"a": {
"c": "c1",
"p": "16j"
},
"b": {
"c": "c1",
"p": "bm-16"
},
"pts": [],
"color": "schwarz"
},
{
"id": "w15",
"a": {
"c": "c1",
"p": "25j"
},
"b": {
"c": "c1",
"p": "bm-25"
},
"pts": [],
"color": "schwarz"
},
{
"id": "w16",
"a": {
"c": "c2",
"p": "D12"
},
"b": {
"c": "c1",
"p": "3j"
},
"pts": [
[
360,
445
],
[
240,
445
]
],
"color": "blau"
},
{
"id": "w17",
"a": {
"c": "c2",
"p": "D11"
},
"b": {
"c": "c1",
"p": "11j"
},
"pts": [
[
370,
430
],
[
320,
430
]
],
"color": "blau"
},
{
"id": "w18",
"a": {
"c": "c2",
"p": "D10"
},
"b": {
"c": "c1",
"p": "20j"
},
"pts": [
[
380,
425
],
[
410,
425
]
],
"color": "blau"
}
]
},
"blocks": "<xml xmlns=\"https://developers.google.com/blockly/xml\"><block type=\"ard_setup\" x=\"30\" y=\"30\"><statement name=\"DO\"></statement></block><block type=\"ard_loop\" x=\"30\" y=\"120\"><statement name=\"DO\"><block type=\"ard_digital_write\"><field name=\"PIN\">12</field><field name=\"V\">HIGH</field><next><block type=\"ard_wait\"><field name=\"UNIT\">S</field><value name=\"N\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value><next><block type=\"ard_digital_write\"><field name=\"PIN\">11</field><field name=\"V\">HIGH</field><next><block type=\"ard_wait\"><field name=\"UNIT\">S</field><value name=\"N\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value><next><block type=\"ard_digital_write\"><field name=\"PIN\">12</field><field name=\"V\">LOW</field><next><block type=\"ard_digital_write\"><field name=\"PIN\">11</field><field name=\"V\">LOW</field><next><block type=\"ard_digital_write\"><field name=\"PIN\">10</field><field name=\"V\">HIGH</field><next><block type=\"ard_wait\"><field name=\"UNIT\">S</field><value name=\"N\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value><next><block type=\"ard_digital_write\"><field name=\"PIN\">10</field><field name=\"V\">LOW</field><next><block type=\"ard_digital_write\"><field name=\"PIN\">11</field><field name=\"V\">HIGH</field><next><block type=\"ard_wait\"><field name=\"UNIT\">S</field><value name=\"N\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value><next><block type=\"ard_digital_write\"><field name=\"PIN\">11</field><field name=\"V\">LOW</field></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></statement></block></xml>"
},
{
"id": "taster",
"title": "Taster schaltet LED",
"board": "uno",
"desc": "Solange der Taster gedrückt ist, leuchtet die eingebaute LED. Der 10-kΩ-Widerstand zieht den Eingang sonst auf 0.",
"circuit": {
"components": [
{
"id": "c1",
"type": "breadboard",
"x": 200,
"y": 200,
"rot": 0,
"props": {}
},
{
"id": "c2",
"type": "uno",
"x": 210,
"y": 460,
"rot": 0,
"props": {}
},
{
"id": "c7",
"type": "button",
"x": 290,
"y": 280,
"rot": 0,
"props": {}
},
{
"id": "c9",
"type": "resistor",
"x": 310,
"y": 330,
"rot": 0,
"props": {
"ohm": 10000
}
}
],
"wires": [
{
"id": "w3",
"a": {
"c": "c2",
"p": "5V"
},
"b": {
"c": "c1",
"p": "bp-1"
},
"pts": [
[
370,
690
],
[
180,
690
],
[
180,
390
]
],
"color": "rot"
},
{
"id": "w4",
"a": {
"c": "c2",
"p": "GND_1"
},
"b": {
"c": "c1",
"p": "bm-2"
},
"pts": [
[
380,
700
],
[
170,
700
],
[
170,
380
]
],
"color": "schwarz"
},
{
"id": "w5",
"a": {
"c": "c1",
"p": "bp-29"
},
"b": {
"c": "c1",
"p": "tp-29"
},
"pts": [
[
550,
390
],
[
550,
220
]
],
"color": "rot"
},
{
"id": "w6",
"a": {
"c": "c1",
"p": "bm-28"
},
"b": {
"c": "c1",
"p": "tm-28"
},
"pts": [
[
540,
380
],
[
540,
210
]
],
"color": "schwarz"
},
{
"id": "w8",
"a": {
"c": "c1",
"p": "8a"
},
"b": {
"c": "c1",
"p": "tp-8"
},
"pts": [],
"color": "rot"
},
{
"id": "w10",
"a": {
"c": "c1",
"p": "14j"
},
"b": {
"c": "c1",
"p": "bm-14"
},
"pts": [],
"color": "schwarz"
},
{
"id": "w11",
"a": {
"c": "c2",
"p": "D2"
},
"b": {
"c": "c1",
"p": "10j"
},
"pts": [
[
470,
430
],
[
310,
430
]
],
"color": "blau"
}
]
},
"blocks": "<xml xmlns=\"https://developers.google.com/blockly/xml\"><block type=\"ard_setup\" x=\"30\" y=\"30\"><statement name=\"DO\"></statement></block><block type=\"ard_loop\" x=\"30\" y=\"120\"><statement name=\"DO\"><block type=\"controls_if\"><mutation else=\"1\"></mutation><value name=\"IF0\"><block type=\"logic_compare\"><field name=\"OP\">EQ</field><value name=\"A\"><block type=\"ard_digital_read\"><field name=\"PIN\">2</field></block></value><value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value></block></value><statement name=\"DO0\"><block type=\"ard_builtin_led\"><field name=\"V\">HIGH</field></block></statement><statement name=\"ELSE\"><block type=\"ard_builtin_led\"><field name=\"V\">LOW</field></block></statement></block></statement></block></xml>"
},
{
"id": "dimmer",
"title": "Dimmer mit Potentiometer",
"board": "uno",
"desc": "Das Potentiometer stellt über PWM die Helligkeit einer LED ein.",
"circuit": {
"components": [
{
"id": "c1",
"type": "breadboard",
"x": 200,
"y": 200,
"rot": 0,
"props": {}
},
{
"id": "c2",
"type": "uno",
"x": 210,
"y": 460,
"rot": 0,
"props": {}
},
{
"id": "c7",
"type": "poti",
"x": 240,
"y": 330,
"rot": 0,
"props": {
"position": 80,
"ohm": 10000
}
},
{
"id": "c11",
"type": "led",
"x": 350,
"y": 310,
"rot": 0,
"props": {
"color": "rot"
}
},
{
"id": "c12",
"type": "resistor",
"x": 360,
"y": 330,
"rot": 0,
"props": {
"ohm": 220
}
}
],
"wires": [
{
"id": "w3",
"a": {
"c": "c2",
"p": "5V"
},
"b": {
"c": "c1",
"p": "bp-1"
},
"pts": [
[
370,
690
],
[
180,
690
],
[
180,
390
]
],
"color": "rot"
},
{
"id": "w4",
"a": {
"c": "c2",
"p": "GND_1"
},
"b": {
"c": "c1",
"p": "bm-2"
},
"pts": [
[
380,
700
],
[
170,
700
],
[
170,
380
]
],
"color": "schwarz"
},
{
"id": "w5",
"a": {
"c": "c1",
"p": "bp-29"
},
"b": {
"c": "c1",
"p": "tp-29"
},
"pts": [
[
550,
390
],
[
550,
220
]
],
"color": "rot"
},
{
"id": "w6",
"a": {
"c": "c1",
"p": "bm-28"
},
"b": {
"c": "c1",
"p": "tm-28"
},
"pts": [
[
540,
380
],
[
540,
210
]
],
"color": "schwarz"
},
{
"id": "w8",
"a": {
"c": "c1",
"p": "3j"
},
"b": {
"c": "c1",
"p": "bp-3"
},
"pts": [],
"color": "rot"
},
{
"id": "w9",
"a": {
"c": "c1",
"p": "5j"
},
"b": {
"c": "c1",
"p": "bm-5"
},
"pts": [],
"color": "schwarz"
},
{
"id": "w10",
"a": {
"c": "c1",
"p": "4j"
},
"b": {
"c": "c2",
"p": "A0"
},
"pts": [
[
250,
415
],
[
160,
415
],
[
160,
715
],
[
420,
715
]
],
"color": "orange"
},
{
"id": "w13",
"a": {
"c": "c1",
"p": "19j"
},
"b": {
"c": "c1",
"p": "bm-19"
},
"pts": [],
"color": "schwarz"
},
{
"id": "w14",
"a": {
"c": "c2",
"p": "D9"
},
"b": {
"c": "c1",
"p": "14j"
},
"pts": [
[
390,
430
],
[
350,
430
]
],
"color": "blau"
}
]
},
"blocks": "<xml xmlns=\"https://developers.google.com/blockly/xml\"><block type=\"ard_setup\" x=\"30\" y=\"30\"><statement name=\"DO\"></statement></block><block type=\"ard_loop\" x=\"30\" y=\"120\"><statement name=\"DO\"><block type=\"ard_analog_write\"><field name=\"PIN\">9</field><value name=\"V\"><block type=\"ard_map\"><value name=\"V\"><block type=\"ard_analog_read\"><field name=\"PIN\">A0</field></block></value><value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">0</field></shadow></value><value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">1023</field></shadow></value><value name=\"C\"><shadow type=\"math_number\"><field name=\"NUM\">0</field></shadow></value><value name=\"D\"><shadow type=\"math_number\"><field name=\"NUM\">255</field></shadow></value></block></value></block></statement></block></xml>"
},
{
"id": "thermometer",
"title": "Thermometer mit LCD",
"board": "uno",
"desc": "Der Temperatursensor TMP36 misst, das LCD zeigt die Temperatur an.",
"circuit": {
"components": [
{
"id": "c1",
"type": "breadboard",
"x": 200,
"y": 200,
"rot": 0,
"props": {}
},
{
"id": "c2",
"type": "uno",
"x": 210,
"y": 460,
"rot": 0,
"props": {}
},
{
"id": "c7",
"type": "lcd",
"x": 300,
"y": 90,
"rot": 0,
"props": {}
},
{
"id": "c12",
"type": "tmp36",
"x": 410,
"y": 330,
"rot": 0,
"props": {
"temp": 20
}
}
],
"wires": [
{
"id": "w3",
"a": {
"c": "c2",
"p": "5V"
},
"b": {
"c": "c1",
"p": "bp-1"
},
"pts": [
[
370,
690
],
[
180,
690
],
[
180,
390
]
],
"color": "rot"
},
{
"id": "w4",
"a": {
"c": "c2",
"p": "GND_1"
},
"b": {
"c": "c1",
"p": "bm-2"
},
"pts": [
[
380,
700
],
[
170,
700
],
[
170,
380
]
],
"color": "schwarz"
},
{
"id": "w5",
"a": {
"c": "c1",
"p": "bp-29"
},
"b": {
"c": "c1",
"p": "tp-29"
},
"pts": [
[
550,
390
],
[
550,
220
]
],
"color": "rot"
},
{
"id": "w6",
"a": {
"c": "c1",
"p": "bm-28"
},
"b": {
"c": "c1",
"p": "tm-28"
},
"pts": [
[
540,
380
],
[
540,
210
]
],
"color": "schwarz"
},
{
"id": "w8",
"a": {
"c": "c7",
"p": "GND"
},
"b": {
"c": "c1",
"p": "tm-2"
},
"pts": [
[
230,
90
]
],
"color": "schwarz"
},
{
"id": "w9",
"a": {
"c": "c7",
"p": "VCC"
},
"b": {
"c": "c1",
"p": "tp-3"
},
"pts": [
[
240,
100
]
],
"color": "rot"
},
{
"id": "w10",
"a": {
"c": "c7",
"p": "SDA"
},
"b": {
"c": "c2",
"p": "SDA"
},
"pts": [
[
140,
110
],
[
140,
445
],
[
320,
445
]
],
"color": "gruen"
},
{
"id": "w11",
"a": {
"c": "c7",
"p": "SCL"
},
"b": {
"c": "c2",
"p": "SCL"
},
"pts": [
[
150,
120
],
[
150,
435
],
[
310,
435
]
],
"color": "gelb"
},
{
"id": "w13",
"a": {
"c": "c1",
"p": "20j"
},
"b": {
"c": "c1",
"p": "bp-20"
},
"pts": [],
"color": "rot"
},
{
"id": "w14",
"a": {
"c": "c1",
"p": "22j"
},
"b": {
"c": "c1",
"p": "bm-22"
},
"pts": [],
"color": "schwarz"
},
{
"id": "w15",
"a": {
"c": "c1",
"p": "21j"
},
"b": {
"c": "c2",
"p": "A0"
},
"pts": [
[
420,
415
],
[
160,
415
],
[
160,
715
],
[
420,
715
]
],
"color": "orange"
}
]
},
"blocks": "<xml xmlns=\"https://developers.google.com/blockly/xml\"><block type=\"ard_setup\" x=\"30\" y=\"30\"><statement name=\"DO\"><block type=\"ard_lcd_init\"><next><block type=\"ard_lcd_backlight\"><field name=\"ON\">1</field></block></next></block></statement></block><block type=\"ard_loop\" x=\"30\" y=\"220\"><statement name=\"DO\"><block type=\"ard_lcd_clear\"><next><block type=\"ard_lcd_print\"><value name=\"V\"><block type=\"ard_join\"><value name=\"A\"><shadow type=\"text\"><field name=\"TEXT\">Temp: </field></shadow></value><value name=\"B\"><block type=\"ard_round\"><field name=\"OP\">ROUND</field><value name=\"V\"><block type=\"ard_tmp36\"><field name=\"PIN\">A0</field><field name=\"UNIT\">C</field></block></value></block></value></block></value><next><block type=\"ard_lcd_print\"><value name=\"V\"><shadow type=\"text\"><field name=\"TEXT\"> °C</field></shadow></value><next><block type=\"ard_wait\"><field name=\"UNIT\">S</field><value name=\"N\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value></block></next></block></next></block></next></block></statement></block></xml>"
},
{
"id": "servo",
"title": "Servo mit Potentiometer",
"board": "uno",
"desc": "Der Servo folgt der Stellung des Potentiometers (0 bis 180 Grad).",
"circuit": {
"components": [
{
"id": "c1",
"type": "breadboard",
"x": 200,
"y": 200,
"rot": 0,
"props": {}
},
{
"id": "c2",
"type": "uno",
"x": 210,
"y": 460,
"rot": 0,
"props": {}
},
{
"id": "c7",
"type": "poti",
"x": 240,
"y": 330,
"rot": 0,
"props": {
"position": 80,
"ohm": 10000
}
},
{
"id": "c11",
"type": "servo",
"x": 580,
"y": 290,
"rot": 0,
"props": {}
}
],
"wires": [
{
"id": "w3",
"a": {
"c": "c2",
"p": "5V"
},
"b": {
"c": "c1",
"p": "bp-1"
},
"pts": [
[
370,
690
],
[
180,
690
],
[
180,
390
]
],
"color": "rot"
},
{
"id": "w4",
"a": {
"c": "c2",
"p": "GND_1"
},
"b": {
"c": "c1",
"p": "bm-2"
},
"pts": [
[
380,
700
],
[
170,
700
],
[
170,
380
]
],
"color": "schwarz"
},
{
"id": "w5",
"a": {
"c": "c1",
"p": "bp-29"
},
"b": {
"c": "c1",
"p": "tp-29"
},
"pts": [
[
550,
390
],
[
550,
220
]
],
"color": "rot"
},
{
"id": "w6",
"a": {
"c": "c1",
"p": "bm-28"
},
"b": {
"c": "c1",
"p": "tm-28"
},
"pts": [
[
540,
380
],
[
540,
210
]
],
"color": "schwarz"
},
{
"id": "w8",
"a": {
"c": "c1",
"p": "3j"
},
"b": {
"c": "c1",
"p": "bp-3"
},
"pts": [],
"color": "rot"
},
{
"id": "w9",
"a": {
"c": "c1",
"p": "5j"
},
"b": {
"c": "c1",
"p": "bm-5"
},
"pts": [],
"color": "schwarz"
},
{
"id": "w10",
"a": {
"c": "c1",
"p": "4j"
},
"b": {
"c": "c2",
"p": "A0"
},
"pts": [
[
250,
415
],
[
160,
415
],
[
160,
715
],
[
420,
715
]
],
"color": "orange"
},
{
"id": "w12",
"a": {
"c": "c11",
"p": "GND"
},
"b": {
"c": "c1",
"p": "bm-26"
},
"pts": [
[
580,
415
],
[
470,
415
]
],
"color": "schwarz"
},
{
"id": "w13",
"a": {
"c": "c11",
"p": "VCC"
},
"b": {
"c": "c1",
"p": "bp-27"
},
"pts": [
[
590,
422
],
[
480,
422
]
],
"color": "rot"
},
{
"id": "w14",
"a": {
"c": "c11",
"p": "SIG"
},
"b": {
"c": "c2",
"p": "D3"
},
"pts": [
[
600,
445
],
[
460,
445
]
],
"color": "orange"
}
]
},
"blocks": "<xml xmlns=\"https://developers.google.com/blockly/xml\"><block type=\"ard_setup\" x=\"30\" y=\"30\"><statement name=\"DO\"></statement></block><block type=\"ard_loop\" x=\"30\" y=\"120\"><statement name=\"DO\"><block type=\"ard_servo\"><field name=\"PIN\">3</field><value name=\"DEG\"><block type=\"ard_map\"><value name=\"V\"><block type=\"ard_analog_read\"><field name=\"PIN\">A0</field></block></value><value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">0</field></shadow></value><value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">1023</field></shadow></value><value name=\"C\"><shadow type=\"math_number\"><field name=\"NUM\">0</field></shadow></value><value name=\"D\"><shadow type=\"math_number\"><field name=\"NUM\">180</field></shadow></value></block></value><next><block type=\"ard_wait\"><field name=\"UNIT\">MS</field><value name=\"N\"><shadow type=\"math_number\"><field name=\"NUM\">50</field></shadow></value></block></next></block></statement></block></xml>"
},
{
"id": "motor",
"title": "Motor mit Motortreiber",
"board": "uno",
"desc": "Ein Getriebemotor am Motortreiber L9110S (A-IA an D6, A-IB an D5). Das Potentiometer stellt die Geschwindigkeit ein.",
"circuit": {
"components": [
{
"id": "c1",
"type": "breadboard",
"x": 200,
"y": 200,
"rot": 0,
"props": {}
},
{
"id": "c2",
"type": "uno",
"x": 210,
"y": 460,
"rot": 0,
"props": {}
},
{
"id": "c7",
"type": "poti",
"x": 240,
"y": 330,
"rot": 0,
"props": {
"position": 80,
"ohm": 10000
}
},
{
"id": "c11",
"type": "mdriver",
"x": 350,
"y": 330,
"rot": 0,
"props": {}
},
{
"id": "c16",
"type": "gearmotor",
"x": 110,
"y": 160,
"rot": 0,
"props": {}
}
],
"wires": [
{
"id": "w3",
"a": {
"c": "c2",
"p": "5V"
},
"b": {
"c": "c1",
"p": "bp-1"
},
"pts": [
[
370,
690
],
[
180,
690
],
[
180,
390
]
],
"color": "rot"
},
{
"id": "w4",
"a": {
"c": "c2",
"p": "GND_1"
},
"b": {
"c": "c1",
"p": "bm-2"
},
"pts": [
[
380,
700
],
[
170,
700
],
[
170,
380
]
],
"color": "schwarz"
},
{
"id": "w5",
"a": {
"c": "c1",
"p": "bp-29"
},
"b": {
"c": "c1",
"p": "tp-29"
},
"pts": [
[
550,
390
],
[
550,
220
]
],
"color": "rot"
},
{
"id": "w6",
"a": {
"c": "c1",
"p": "bm-28"
},
"b": {
"c": "c1",
"p": "tm-28"
},
"pts": [
[
540,
380
],
[
540,
210
]
],
"color": "schwarz"
},
{
"id": "w8",
"a": {
"c": "c1",
"p": "3j"
},
"b": {
"c": "c1",
"p": "bp-3"
},
"pts": [],
"color": "rot"
},
{
"id": "w9",
"a": {
"c": "c1",
"p": "5j"
},
"b": {
"c": "c1",
"p": "bm-5"
},
"pts": [],
"color": "schwarz"
},
{
"id": "w10",
"a": {
"c": "c1",
"p": "4j"
},
"b": {
"c": "c2",
"p": "A0"
},
"pts": [
[
250,
415
],
[
160,
415
],
[
160,
715
],
[
420,
715
]
],
"color": "orange"
},
{
"id": "w12",
"a": {
"c": "c1",
"p": "16j"
},
"b": {
"c": "c1",
"p": "bm-16"
},
"pts": [],
"color": "schwarz"
},
{
"id": "w13",
"a": {
"c": "c1",
"p": "17j"
},
"b": {
"c": "c1",
"p": "bp-17"
},
"pts": [],
"color": "rot"
},
{
"id": "w14",
"a": {
"c": "c2",
"p": "D6"
},
"b": {
"c": "c1",
"p": "18j"
},
"pts": [
[
430,
440
],
[
390,
440
]
],
"color": "blau"
},
{
"id": "w15",
"a": {
"c": "c2",
"p": "D5"
},
"b": {
"c": "c1",
"p": "19j"
},
"pts": [
[
440,
430
],
[
400,
430
]
],
"color": "blau"
},
{
"id": "w17",
"a": {
"c": "c16",
"p": "N"
},
"b": {
"c": "c11",
"p": "MA1"
},
"pts": [
[
120,
185
],
[
315,
185
],
[
315,
277
]
],
"color": "schwarz"
},
{
"id": "w18",
"a": {
"c": "c16",
"p": "P"
},
"b": {
"c": "c11",
"p": "MA2"
},
"pts": [
[
110,
195
],
[
305,
195
],
[
305,
291
]
],
"color": "rot"
}
]
},
"blocks": "<xml xmlns=\"https://developers.google.com/blockly/xml\"><block type=\"ard_setup\" x=\"30\" y=\"30\"><statement name=\"DO\"></statement></block><block type=\"ard_loop\" x=\"30\" y=\"120\"><statement name=\"DO\"><block type=\"ard_motor\"><field name=\"IA\">6</field><field name=\"IB\">5</field><field name=\"DIR\">1</field><value name=\"SPEED\"><block type=\"ard_map\"><value name=\"V\"><block type=\"ard_analog_read\"><field name=\"PIN\">A0</field></block></value><value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">0</field></shadow></value><value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">1023</field></shadow></value><value name=\"C\"><shadow type=\"math_number\"><field name=\"NUM\">0</field></shadow></value><value name=\"D\"><shadow type=\"math_number\"><field name=\"NUM\">100</field></shadow></value></block></value></block></statement></block></xml>"
},
{
"id": "webseite",
"title": "Webseite schaltet LED",
"board": "esp32",
"ext": [
"comm"
],
"desc": "Der ESP32 öffnet ein eigenes WLAN mit einer Webseite. Mit dem Handy verbinden, 192.168.4.1 aufrufen und die LED schalten.",
"circuit": {
"components": [
{
"id": "c1",
"type": "breadboard",
"x": 200,
"y": 200,
"rot": 0,
"props": {}
},
{
"id": "c2",
"type": "esp32exp",
"x": 280,
"y": 520,
"rot": 0,
"props": {
"jump": "3.3"
}
},
{
"id": "c7",
"type": "led",
"x": 260,
"y": 310,
"rot": 0,
"props": {
"color": "gruen"
}
},
{
"id": "c8",
"type": "resistor",
"x": 270,
"y": 330,
"rot": 0,
"props": {
"ohm": 220
}
}
],
"wires": [
{
"id": "w3",
"a": {
"c": "c2",
"p": "P3V3a"
},
"b": {
"c": "c1",
"p": "bp-1"
},
"pts": [
[
550,
530
],
[
550,
425
],
[
180,
425
],
[
180,
390
]
],
"color": "rot"
},
{
"id": "w4",
"a": {
"c": "c2",
"p": "PGa"
},
"b": {
"c": "c1",
"p": "bm-2"
},
"pts": [
[
560,
590
],
[
560,
435
],
[
170,
435
],
[
170,
380
]
],
"color": "schwarz"
},
{
"id": "w5",
"a": {
"c": "c1",
"p": "bp-29"
},
"b": {
"c": "c1",
"p": "tp-29"
},
"pts": [
[
550,
390
],
[
550,
220
]
],
"color": "rot"
},
{
"id": "w6",
"a": {
"c": "c1",
"p": "bm-28"
},
"b": {
"c": "c1",
"p": "tm-28"
},
"pts": [
[
540,
380
],
[
540,
210
]
],
"color": "schwarz"
},
{
"id": "w9",
"a": {
"c": "c1",
"p": "10j"
},
"b": {
"c": "c1",
"p": "bm-10"
},
"pts": [],
"color": "schwarz"
},
{
"id": "w10",
"a": {
"c": "c2",
"p": "D4"
},
"b": {
"c": "c1",
"p": "5j"
},
"pts": [
[
400,
412
],
[
260,
412
]
],
"color": "blau"
}
]
},
"blocks": "<xml xmlns=\"https://developers.google.com/blockly/xml\"><block type=\"ard_setup\" x=\"30\" y=\"30\"><statement name=\"DO\"><block type=\"com_wifi_ap\"><value name=\"SSID\"><shadow type=\"text\"><field name=\"TEXT\">ESP-Werkstatt</field></shadow></value><value name=\"PW\"><shadow type=\"text\"><field name=\"TEXT\">werkstatt</field></shadow></value><next><block type=\"com_web_start\"><value name=\"T\"><shadow type=\"text\"><field name=\"TEXT\">Meine LED</field></shadow></value></block></next></block></statement></block><block type=\"ard_loop\" x=\"30\" y=\"220\"><statement name=\"DO\"><block type=\"controls_if\"><value name=\"IF0\"><block type=\"com_web_button\"><field name=\"N\">LED an</field></block></value><statement name=\"DO0\"><block type=\"ard_digital_write\"><field name=\"PIN\">4</field><field name=\"V\">HIGH</field></block></statement><next><block type=\"controls_if\"><value name=\"IF0\"><block type=\"com_web_button\"><field name=\"N\">LED aus</field></block></value><statement name=\"DO0\"><block type=\"ard_digital_write\"><field name=\"PIN\">4</field><field name=\"V\">LOW</field></block></statement><next><block type=\"com_web_show\"><field name=\"N\">LED</field><value name=\"V\"><block type=\"ard_digital_read\"><field name=\"PIN\">4</field></block></value></block></next></block></next></block></statement></block></xml>"
},
{
"id": "funk",
"title": "Funk-Klingel",
"board": "esp32",
"ext": [
"comm"
],
"desc": "Zwei ESP32 derselben Gruppe: Drückt man den Taster, leuchtet beim anderen die blaue LED und der serielle Monitor zeigt die Nachricht.",
"circuit": {
"components": [
{
"id": "c1",
"type": "breadboard",
"x": 200,
"y": 200,
"rot": 0,
"props": {}
},
{
"id": "c2",
"type": "esp32exp",
"x": 280,
"y": 520,
"rot": 0,
"props": {
"jump": "3.3"
}
},
{
"id": "c7",
"type": "button",
"x": 290,
"y": 280,
"rot": 0,
"props": {}
},
{
"id": "c9",
"type": "resistor",
"x": 310,
"y": 330,
"rot": 0,
"props": {
"ohm": 10000
}
}
],
"wires": [
{
"id": "w3",
"a": {
"c": "c2",
"p": "P3V3a"
},
"b": {
"c": "c1",
"p": "bp-1"
},
"pts": [
[
550,
530
],
[
550,
425
],
[
180,
425
],
[
180,
390
]
],
"color": "rot"
},
{
"id": "w4",
"a": {
"c": "c2",
"p": "PGa"
},
"b": {
"c": "c1",
"p": "bm-2"
},
"pts": [
[
560,
590
],
[
560,
435
],
[
170,
435
],
[
170,
380
]
],
"color": "schwarz"
},
{
"id": "w5",
"a": {
"c": "c1",
"p": "bp-29"
},
"b": {
"c": "c1",
"p": "tp-29"
},
"pts": [
[
550,
390
],
[
550,
220
]
],
"color": "rot"
},
{
"id": "w6",
"a": {
"c": "c1",
"p": "bm-28"
},
"b": {
"c": "c1",
"p": "tm-28"
},
"pts": [
[
540,
380
],
[
540,
210
]
],
"color": "schwarz"
},
{
"id": "w8",
"a": {
"c": "c1",
"p": "8a"
},
"b": {
"c": "c1",
"p": "tp-8"
},
"pts": [],
"color": "rot"
},
{
"id": "w10",
"a": {
"c": "c1",
"p": "14j"
},
"b": {
"c": "c1",
"p": "bm-14"
},
"pts": [],
"color": "schwarz"
},
{
"id": "w11",
"a": {
"c": "c2",
"p": "D19"
},
"b": {
"c": "c1",
"p": "10j"
},
"pts": [
[
350,
412
],
[
310,
412
]
],
"color": "blau"
}
]
},
"blocks": "<xml xmlns=\"https://developers.google.com/blockly/xml\"><block type=\"ard_setup\" x=\"30\" y=\"30\"><statement name=\"DO\"><block type=\"com_radio_init\"><field name=\"G\">1</field></block></statement></block><block type=\"ard_loop\" x=\"30\" y=\"170\"><statement name=\"DO\"><block type=\"controls_if\"><value name=\"IF0\"><block type=\"logic_compare\"><field name=\"OP\">EQ</field><value name=\"A\"><block type=\"ard_digital_read\"><field name=\"PIN\">19</field></block></value><value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value></block></value><statement name=\"DO0\"><block type=\"com_radio_send\"><value name=\"V\"><shadow type=\"text\"><field name=\"TEXT\">Ding-Dong!</field></shadow></value><next><block type=\"ard_wait\"><field name=\"UNIT\">S</field><value name=\"N\"><shadow type=\"math_number\"><field name=\"NUM\">0.5</field></shadow></value></block></next></block></statement><next><block type=\"controls_if\"><value name=\"IF0\"><block type=\"com_radio_avail\"></block></value><statement name=\"DO0\"><block type=\"ard_serial\"><field name=\"NL\">Y</field><value name=\"V\"><block type=\"com_radio_text\"></block></value><next><block type=\"ard_builtin_led\"><field name=\"V\">HIGH</field><next><block type=\"ard_wait\"><field name=\"UNIT\">S</field><value name=\"N\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value><next><block type=\"ard_builtin_led\"><field name=\"V\">LOW</field></block></next></block></next></block></next></block></statement></block></next></block></statement></block></xml>"
}
];
