# Wii Game Center

Página web interactiva inspirada en la interfaz de la Nintendo Wii. Funciona como un
menú principal de canales desde el que se accede a cinco juegos jugables, con
selección previa de personaje estilo Mii.

## Cómo ejecutarlo

No requiere instalación ni compilación. Solo necesitas un navegador moderno.

Opción 1 — abrir directamente:

1. Descarga o clona este repositorio.
2. Abre `index.html` en tu navegador.

Opción 2 — servidor local (recomendado para evitar restricciones de `file://`):

```bash
cd Juegos
python -m http.server 8000
```

Luego visita `http://localhost:8000`.

## Flujo de la aplicación

1. **Selección de Mii (`#​/mii`):** pantalla inicial inspirada en la Wii. Elige uno de
   los 18 personajes de `Monitos.jpg`, escribe un nombre y pulsa *¡Vamos a jugar!*.
   La elección se guarda en `localStorage` y te acompaña en el menú y en los juegos.
2. **Menú principal (`#​/`):** cinco tarjetas-canal con previsualizaciones animadas
   en vivo (no son imágenes estáticas).
3. **Juegos (`#​/snake`, `#​/tetris`, `#​/gato`, `#​/pong`, `#​/tiempo`):** cada uno en
   su propia vista, con instrucciones, puntuación, botón de inicio/reinicio y botón
   para volver al menú. La navegación usa hash, así que funcionan los botones
   atrás/adelante del navegador.

## Juegos incluidos

| Juego | Descripción | Controles |
|---|---|---|
| Snake | Come manzanas, crece y evita paredes y tu propio cuerpo. Guarda el récord. | Flechas / WASD, D-pad en pantalla, deslizar sobre el tablero |
| Tetris | Mueve y rota piezas, completa líneas y sube de nivel. Con pieza siguiente y pausa. | `←` `→` `↓`, `↑`/`X` rotar, `Espacio` caída instantánea, botones táctiles |
| Gato | Tic-Tac-Toe para 2 jugadores en el mismo dispositivo, con marcador X/O/empates. | Clic / toque en las casillas |
| Pong | 1 jugador contra la CPU o 2 jugadores en local. Gana quien llegue a 5 puntos. | 1P: `W`/`S`, ratón o dedo. 2P: izquierda `W`/`S`, derecha `↑`/`↓` |
| Desafío de Tiempo | Memoriza un objetivo (3–10 s), cuenta mentalmente sin reloj y detén el crono. Hasta 1000 pts por intento según precisión, con récord guardado. | Botón ¡DETENER! o `Espacio` |

## Estructura del proyecto

```text
Juegos/
├── index.html    # SPA: vistas de Mii, menú y los 5 juegos
├── styles.css    # Estética Wii (tarjetas, sombras, responsive)
├── app.js        # Router por hash, previews animadas y lógica de los juegos
├── Monitos.jpg   # Hoja de 18 personajes (parrilla 6×3) usada como sprite
└── README.md
```

## Tecnologías

- HTML, CSS y JavaScript vanilla (sin dependencias ni build).
- Canvas 2D para los juegos y las previsualizaciones del menú.
- Tipografía Nunito (Google Fonts).
- Persistencia con `localStorage`:
  - `wgc-mii`: personaje y nombre elegidos.
  - `wgc-snake-best`: récord de Snake.
  - `wgc-tiempo-best`: mejor precisión del Desafío de Tiempo.

## Diseño responsive

El menú pasa de 5 columnas a 2 en tableta y 1 en móvil. Todos los juegos son
jugables con táctil (D-pad, botones y gestos) además de teclado.

## Licencia

Si publicas este repositorio, añade aquí la licencia que prefieras (por ejemplo, MIT).
