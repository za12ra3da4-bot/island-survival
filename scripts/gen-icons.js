// 아이템·능력·UI 아이콘(SVG 64×64)을 public/assets/icons 에 만든다.  node scripts/gen-icons.js
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEM_IDS, POWER_IDS } from '../public/shared/config.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'icons');
mkdirSync(OUT, { recursive: true });

const INK = '#2b1d14';
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
const hl = (d, w = 2.5, o = 0.6) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width="${w}"/>`;
const line = (d, color, w = 2) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
// 테두리 있는 굵은 선 (뼈, 손잡이, 활대)
const rod = (d, color, w = 6) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 4}"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

const WOOD = '#a8673a', WOOD_D = '#7c4722', WOOD_L = '#d39a5b';
const METAL = { wood: '#c98c4f', stone: '#a9a69f', iron: '#dde2e8', mithril: '#5fe3e8' };

// ── 재료 ─────────────────────────────────────────
function rock(fill, extra = '') {
  return `<path d="M8 44 L14 24 L30 12 L47 16 L57 33 L51 51 L24 55 Z" fill="${fill}"/>
    <path d="M14 24 L30 12 L47 16 L37 28 L20 30 Z" fill="${shade(fill, 0.28)}" stroke-width="2"/>
    <path d="M37 28 L57 33 M20 30 L24 55" fill="none" stroke-width="2" stroke-opacity=".45"/>${extra}`;
}

const ICONS = {
  wood: () => svg(`
    <rect x="6" y="31" width="42" height="19" rx="5" fill="${WOOD}"/>
    ${line('M12 37 L30 37 M16 44 L40 44', WOOD_D)}
    <ellipse cx="48" cy="40.5" rx="7" ry="9.5" fill="${WOOD_L}"/>
    <ellipse cx="48" cy="40.5" rx="3" ry="4.5" fill="none" stroke="#b77c45" stroke-width="2"/>
    <rect x="14" y="13" width="38" height="18" rx="5" fill="#b8753f"/>
    ${line('M20 19 L38 19 M24 25 L44 25', WOOD_D)}
    <ellipse cx="52" cy="22" rx="6.5" ry="9" fill="${WOOD_L}"/>
    <ellipse cx="52" cy="22" rx="2.6" ry="4" fill="none" stroke="#b77c45" stroke-width="2"/>`),
  stone: () => svg(rock('#9c9a95')),
  iron_ore: () => svg(rock('#86837e', `
    <path d="M22 38 L28 34 L32 40 L26 45 Z" fill="#e0955a" stroke-width="2.2"/>
    <path d="M38 40 L45 37 L47 44 L40 47 Z" fill="#d9823f" stroke-width="2.2"/>
    <path d="M40 22 L46 21 L47 27 L41 28 Z" fill="#eaa96f" stroke-width="2.2"/>`)),
  mithril_ore: () => svg(rock('#6d6878', `
    <path d="M20 46 L24 30 L30 44 Z" fill="#5fe3e8" stroke-width="2.2"/>
    <path d="M30 46 L36 24 L43 46 Z" fill="#8ff3f5" stroke-width="2.2"/>
    <path d="M42 46 L47 34 L51 46 Z" fill="#3fc3cf" stroke-width="2.2"/>
    ${hl('M34 32 L36 26', 1.8, 0.9)}`)),

  // ── 음식 ───────────────────────────────────────
  apple: () => svg(`
    <path d="M32 20 C22 12 7 18 9 35 C11 51 24 59 32 55 C40 59 53 51 55 35 C57 18 42 12 32 20 Z" fill="#e8413a"/>
    <path d="M32 20 C32 14 34 10 37 6" fill="none"/>
    <path d="M35 13 C40 5 50 5 53 9 C49 16 40 18 35 13 Z" fill="#5cbf4a" stroke-width="2.5"/>
    ${hl('M17 30 C17 25 20 22 24 22', 3, 0.7)}`),
  raw_meat: () => meat('#f07a8a', `${line('M20 26 C24 22 30 22 34 26 M18 34 C22 32 26 33 28 36', '#ffd3da', 2.5)}`),
  cooked_meat: () => meat('#b85a2b', `${line('M18 26 L30 16 M18 36 L38 18 M24 42 L42 26', '#7a3514', 2.5)}${hl('M16 22 C18 17 23 14 28 14', 2.5, 0.5)}`),
  arrow: () => svg(`
    ${rod('M13 51 L46 18', WOOD_L, 3)}
    <path d="M40 16 L56 8 L48 24 Z" fill="#b9bec5"/>
    <path d="M8 44 L16 44 L20 48 L20 56 L12 52 Z" fill="#e8413a" stroke-width="2.5"/>
    <path d="M14 38 L20 40 L24 44 L18 46 Z" fill="#f4efe3" stroke-width="2.5"/>`),

  // ── 도구 ───────────────────────────────────────
  fist: () => svg(`
    <rect x="21" y="44" width="22" height="15" rx="3" fill="#e2a872"/>
    <rect x="12" y="15" width="40" height="32" rx="11" fill="#f2c28f"/>
    ${line('M22 16 L22 28 M32 15 L32 28 M42 16 L42 28', INK, 2.5)}
    <path d="M12 33 C22 30 34 32 37 39 C31 44 20 44 13 41 Z" fill="#e2a872" stroke-width="2.5"/>
    ${hl('M18 20 L18 24', 2.5, 0.7)}`),
  bow: () => svg(`
    <path d="M13 13 L51 51" fill="none" stroke="#f4efe3" stroke-width="2"/>
    ${rod('M13 13 C40 4 62 30 51 51', WOOD, 5)}
    <path d="M36 21 L44 29" fill="none" stroke="${INK}" stroke-width="9"/>
    <path d="M36 21 L44 29" fill="none" stroke="#e8413a" stroke-width="5"/>`),
  iron_armor: () => armor('#c4c9d0'),
  mithril_armor: () => armor('#58d7de'),

  // ── 설치물 ─────────────────────────────────────
  workbench: () => svg(`
    <rect x="46" y="24" width="7" height="28" fill="${WOOD_D}"/>
    <rect x="10" y="30" width="7" height="26" fill="${WOOD_D}"/>
    <rect x="38" y="30" width="7" height="26" fill="${WOOD_D}"/>
    <path d="M6 22 L18 12 L60 12 L50 22 Z" fill="${WOOD_L}"/>
    <path d="M6 22 L50 22 L50 31 L6 31 Z" fill="${WOOD}"/>
    <path d="M50 22 L60 12 L60 21 L50 31 Z" fill="${WOOD_D}"/>
    <rect x="22" y="6" width="16" height="7" rx="2" fill="#9aa1a9" stroke-width="2.5"/>
    ${line('M30 13 L28 19', INK, 3)}
    ${hl('M12 20 L44 20', 2, 0.5)}`),
  campfire: () => svg(`
    <circle cx="10" cy="52" r="5" fill="#9c9a95" stroke-width="2.5"/><circle cx="54" cy="52" r="5" fill="#9c9a95" stroke-width="2.5"/>
    <rect x="8" y="44" width="48" height="9" rx="4" fill="${WOOD}" transform="rotate(-14 32 48)"/>
    <rect x="8" y="44" width="48" height="9" rx="4" fill="#b8753f" transform="rotate(14 32 48)"/>
    <path d="M32 4 C41 16 50 23 48 37 C46 48 18 48 16 37 C14 27 24 22 26 14 C29 18 30 22 30 26 C32 20 32 12 32 4 Z" fill="#ff8a2a"/>
    <path d="M32 22 C37 30 41 34 39 40 C37 46 27 46 25 40 C23 34 29 30 32 22 Z" fill="#ffd23f" stroke-width="2.2"/>`),
  wood_wall: () => svg(`
    ${[6, 20, 34, 48].map((x, i) => `<path d="M${x} 58 L${x} 15 L${x + 5} 7 L${x + 10} 15 L${x + 10} 58 Z" fill="${i % 2 ? WOOD : '#b8753f'}"/>`).join('')}
    <rect x="3" y="24" width="58" height="7" rx="2" fill="${WOOD_D}"/>
    <rect x="3" y="44" width="58" height="7" rx="2" fill="${WOOD_D}"/>`),
  stone_wall: () => svg(`
    ${[[6, 12, 20, '#a9a69f'], [26, 12, 16, '#8f8c86'], [42, 12, 16, '#9c9a95'],
      [6, 25, 12, '#8f8c86'], [18, 25, 22, '#a9a69f'], [40, 25, 18, '#8a8781'],
      [6, 38, 18, '#9c9a95'], [24, 38, 16, '#8f8c86'], [40, 38, 18, '#a9a69f']]
      .map(([x, y, w, c]) => `<rect x="${x}" y="${y}" width="${w}" height="13" rx="2" fill="${c}" stroke-width="2.5"/>`).join('')}
    <rect x="4" y="51" width="56" height="7" rx="2" fill="#76736e" stroke-width="2.5"/>
    ${hl('M9 15 L20 15 M21 28 L34 28 M9 41 L18 41', 2, 0.5)}`),

  // ── UI ──────────────────────────────────────────
  wood_floor: () => svg(`
    <path d="M4 36 L32 52 L60 36 L60 28 L32 44 L4 28 Z" fill="${WOOD_D}"/>
    <path d="M32 12 L60 28 L32 44 L4 28 Z" fill="${WOOD_L}"/>
    ${line('M11 24 L39 40 M18 20 L46 36 M25 16 L53 32', WOOD, 2.5)}
    ${hl('M12 28 L32 16', 2, 0.6)}`),
  stone_floor: () => svg(`
    <path d="M4 36 L32 52 L60 36 L60 28 L32 44 L4 28 Z" fill="#76736e"/>
    <path d="M32 12 L60 28 L32 44 L4 28 Z" fill="#b3b0a9"/>
    ${line('M18 20 L46 36 M46 20 L18 36', '#7d7a76', 3)}
    ${hl('M12 28 L32 16', 2, 0.6)}`),
  wood_window: () => svg(`
    <rect x="5" y="8" width="54" height="50" rx="3" fill="${WOOD}"/>
    ${line('M5 20 L59 20 M5 33 L59 33 M5 46 L59 46', WOOD_D, 2.5)}
    <rect x="19" y="17" width="26" height="24" rx="2" fill="#9ad8ff"/>
    ${line('M32 17 L32 41 M19 29 L45 29', INK, 3)}
    ${hl('M23 22 L28 22', 2.5, 0.9)}`),
  stone_window: () => svg(`
    ${[[5, 8, 18], [23, 8, 18], [41, 8, 18], [5, 21, 12], [45, 21, 14], [5, 34, 12], [45, 34, 14], [5, 47, 22], [27, 47, 16], [43, 47, 16]]
      .map(([x, y, w], i) => `<rect x="${x}" y="${y}" width="${w}" height="13" rx="2" fill="${['#a9a69f', '#9c9a95', '#8f8c86'][i % 3]}" stroke-width="2.5"/>`).join('')}
    <rect x="17" y="21" width="28" height="26" rx="2" fill="#9ad8ff"/>
    ${line('M31 21 L31 47 M17 34 L45 34', INK, 3)}
    ${hl('M21 26 L26 26', 2.5, 0.9)}`),
  wood_door: () => svg(`
    <rect x="13" y="5" width="38" height="55" rx="5" fill="${WOOD}"/>
    ${line('M26 6 L26 59 M38 6 L38 59', WOOD_D, 2.5)}
    <rect x="13" y="15" width="38" height="7" fill="${WOOD_D}" stroke-width="2.5"/>
    <rect x="13" y="42" width="38" height="7" fill="${WOOD_D}" stroke-width="2.5"/>
    <circle cx="44" cy="33" r="3.5" fill="#ffcf3d" stroke-width="2"/>`),
  iron_door: () => svg(`
    <rect x="13" y="5" width="38" height="55" rx="4" fill="#8f96a0"/>
    <rect x="13" y="14" width="38" height="7" fill="#5f666f" stroke-width="2.5"/>
    <rect x="13" y="44" width="38" height="7" fill="#5f666f" stroke-width="2.5"/>
    ${[[19, 17.5], [32, 17.5], [45, 17.5], [19, 47.5], [32, 47.5], [45, 47.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#dfe3e8" stroke="none"/>`).join('')}
    <circle cx="43" cy="33" r="4.5" fill="none" stroke-width="3.5"/>
    ${hl('M18 25 L18 40', 2.5, 0.5)}`),
  wood_roof: () => svg(`
    <rect x="14" y="36" width="36" height="22" fill="${WOOD_L}"/>
    <rect x="27" y="44" width="10" height="14" fill="${WOOD_D}" stroke-width="2.5"/>
    <path d="M2 40 L32 8 L62 40 Z" fill="#a8602e"/>
    ${line('M12 30 L52 30 M20 22 L44 22', '#7a3f18', 2.5)}
    ${hl('M10 36 L30 14', 2.5, 0.5)}`),
  stone_roof: () => svg(`
    <rect x="14" y="36" width="36" height="22" fill="#b3b0a9"/>
    <rect x="27" y="44" width="10" height="14" fill="${WOOD_D}" stroke-width="2.5"/>
    <path d="M2 40 L32 8 L62 40 Z" fill="#c4553a"/>
    ${line('M12 30 L52 30 M20 22 L44 22 M26 16 L38 16', '#8e2f1c', 2.5)}
    ${hl('M10 36 L30 14', 2.5, 0.5)}`),
  fence: () => svg(`
    ${[8, 28, 48].map((x) => `<path d="M${x} 60 L${x} 16 L${x + 4} 8 L${x + 8} 16 L${x + 8} 60 Z" fill="${WOOD}"/>`).join('')}
    <rect x="2" y="24" width="60" height="7" rx="2" fill="${WOOD_L}"/>
    <rect x="2" y="42" width="60" height="7" rx="2" fill="${WOOD_L}"/>`),
  torch: () => svg(`
    ${rod('M22 60 L38 24', WOOD, 6)}
    <path d="M34 26 L46 30 L42 20 Z" fill="#5a3a22"/>
    <path d="M42 2 C52 12 56 20 50 28 C46 33 36 32 34 26 C32 18 40 16 42 2 Z" fill="#ff8a2a"/>
    <path d="M42 14 C46 19 48 23 45 26 C43 28 39 28 38 25 C37 21 41 20 42 14 Z" fill="#ffe066" stroke-width="2"/>`),
  lantern: () => svg(`
    <path d="M32 3 L32 12" fill="none" stroke-width="4"/>
    <path d="M20 16 L44 16 L38 8 L26 8 Z" fill="#5f666f"/>
    <rect x="18" y="16" width="28" height="34" rx="4" fill="#ffd95a"/>
    <path d="M26 42 C26 34 32 30 32 24 C36 30 38 34 38 42 Z" fill="#ff9b2e" stroke-width="2"/>
    ${line('M18 30 L46 30', '#5f666f', 2.5)}
    <rect x="16" y="50" width="32" height="8" rx="2" fill="#5f666f"/>
    ${hl('M23 20 L23 44', 2.5, 0.8)}`),
  bed: () => svg(`
    <rect x="4" y="20" width="10" height="38" rx="2" fill="${WOOD_D}"/>
    <rect x="50" y="34" width="10" height="24" rx="2" fill="${WOOD_D}"/>
    <rect x="8" y="34" width="50" height="14" rx="3" fill="#f4efe3"/>
    <path d="M26 30 L58 30 L58 46 L26 46 Z" fill="#d23a2a"/>
    <rect x="12" y="26" width="16" height="10" rx="4" fill="#ffffff"/>
    <rect x="6" y="46" width="54" height="8" fill="${WOOD}"/>
    ${line('M34 34 L54 34', '#ff7b6b', 2.5)}`),
  table: () => svg(`
    <path d="M28 30 L24 56 M36 30 L40 56" fill="none" stroke-width="10"/>
    <path d="M28 30 L24 56 M36 30 L40 56" fill="none" stroke="${WOOD_D}" stroke-width="5"/>
    <ellipse cx="32" cy="24" rx="28" ry="10" fill="${WOOD_L}"/>
    <path d="M4 24 C4 34 60 34 60 24 L60 28 C60 38 4 38 4 28 Z" fill="${WOOD}"/>
    <rect x="36" y="10" width="10" height="12" rx="2" fill="#f4efe3" stroke-width="2.5"/>`),
  chair: () => svg(`
    <rect x="18" y="4" width="28" height="30" rx="4" fill="${WOOD}"/>
    ${line('M26 8 L26 30 M38 8 L38 30', WOOD_D, 2.5)}
    <rect x="12" y="32" width="40" height="9" rx="3" fill="${WOOD_L}"/>
    <path d="M17 41 L15 60 M47 41 L49 60" fill="none" stroke-width="8"/>
    <path d="M17 41 L15 60 M47 41 L49 60" fill="none" stroke="${WOOD_D}" stroke-width="4"/>`),
  spikes: () => svg(`
    <path d="M2 46 L32 60 L62 46 L32 34 Z" fill="${WOOD}"/>
    ${[[14, 42], [26, 38], [38, 38], [50, 42], [22, 49], [34, 50], [44, 48]].map(([x, y]) => `<path d="M${x - 5} ${y + 2} L${x} ${y - 24} L${x + 5} ${y + 2} Z" fill="#c9ced6" stroke-width="2.2"/>`).join('')}`),
  coin: () => svg(`
    <circle cx="32" cy="32" r="26" fill="#ffcf3d"/>
    <circle cx="32" cy="32" r="18.5" fill="#ffdd6b" stroke="#d99a1a" stroke-width="3"/>
    <rect x="25" y="25" width="14" height="14" rx="1.5" fill="#8a5a12" stroke-width="2.5"/>
    ${line('M32 16 L32 20 M32 44 L32 48 M16 32 L20 32 M44 32 L48 32', '#d99a1a', 3)}
    ${hl('M14 26 C16 19 21 14 28 12', 3, 0.75)}`),
  heart: () => svg(`
    <path d="M32 56 C12 43 4 33 4 22 C4 12 12 6 20 6 C26 6 30 10 32 14 C34 10 38 6 44 6 C52 6 60 12 60 22 C60 33 52 43 32 56 Z" fill="#ff4f5e"/>
    ${hl('M12 20 C12 15 15 12 20 12', 3.5, 0.7)}`),
  bolt: () => svg(`
    <path d="M38 3 L11 36 L28 36 L23 61 L53 25 L36 25 L43 3 Z" fill="#ffd23f"/>
    ${hl('M36 9 L20 31', 2.5, 0.7)}`),
  hunger: () => meat('#e38b3a', `${hl('M16 22 C18 17 23 14 28 14', 2.5, 0.6)}`),
  skull: () => svg(`
    <path d="M32 5 C16 5 7 17 7 30 C7 40 13 44 18 46 L18 57 L46 57 L46 46 C51 44 57 40 57 30 C57 17 48 5 32 5 Z" fill="#f4efe3"/>
    <ellipse cx="22" cy="31" rx="7" ry="8" fill="${INK}"/><ellipse cx="42" cy="31" rx="7" ry="8" fill="${INK}"/>
    <path d="M32 38 L28 45 L36 45 Z" fill="${INK}" stroke-width="2"/>
    ${line('M26 49 L26 57 M32 49 L32 57 M38 49 L38 57', INK, 2.5)}
    ${hl('M14 22 C16 16 20 12 26 10', 3, 0.7)}`),
  hammer: () => svg(`<g transform="rotate(-38 32 32)">
    <rect x="28.5" y="20" width="7" height="40" rx="2.5" fill="${WOOD}"/>
    <rect x="11" y="6" width="42" height="16" rx="3" fill="#9aa1a9"/>
    <rect x="11" y="6" width="9" height="16" rx="2" fill="#7b828a"/>
    ${hl('M22 10 L48 10', 2.5, 0.6)}</g>`),
  boat: () => svg(`
    <path d="M33 5 L33 40" fill="none" stroke-width="3.5"/>
    <path d="M36 8 L36 36 L57 36 Z" fill="#f4efe3"/>
    <path d="M30 12 L30 36 L12 36 Z" fill="#e9dcc4"/>
    <path d="M33 5 L43 8 L33 11 Z" fill="#e8413a" stroke-width="2"/>
    <path d="M4 38 L60 38 L50 53 L14 53 Z" fill="${WOOD}"/>
    ${line('M8 44 L56 44', WOOD_D, 2.5)}
    <path d="M2 59 C8 55 12 55 18 59 C24 55 28 55 34 59 C40 55 44 55 50 59 C56 55 60 55 62 57" fill="none" stroke="#3fa0d6" stroke-width="3"/>`),
  map: () => svg(`
    <path d="M6 14 L22 8 L42 14 L58 8 L58 50 L42 56 L22 50 L6 56 Z" fill="#f1dfb0"/>
    <path d="M22 8 L42 14 L42 56 L22 50 Z" fill="#e2c98f" stroke-width="2.5"/>
    <path d="M12 44 C18 40 22 34 30 34 C36 34 40 28 46 24" fill="none" stroke="#b5773b" stroke-width="2.5" stroke-dasharray="3 4"/>
    ${line('M46 18 L54 26 M54 18 L46 26', '#e8413a', 3.5)}
    <circle cx="13" cy="45" r="3" fill="#4d96ff" stroke-width="2"/>`),
  crown: () => svg(`
    <path d="M6 46 L9 17 L22 31 L32 11 L42 31 L55 17 L58 46 Z" fill="#ffcf3d"/>
    <rect x="6" y="44" width="52" height="11" rx="2" fill="#f0b323"/>
    <circle cx="32" cy="49.5" r="3.5" fill="#e8413a" stroke-width="2"/>
    <circle cx="18" cy="49.5" r="2.8" fill="#4d96ff" stroke-width="2"/><circle cx="46" cy="49.5" r="2.8" fill="#6bcb77" stroke-width="2"/>
    ${hl('M13 38 L14 26', 2.5, 0.7)}`),
  chest: () => chest('#b5773b', '#c98c4f', '#7b7f86', '#ffcf3d'),
  gold_chest: () => chest('#f0b323', '#ffd95a', '#a86b12', '#e8413a'),
  lock: () => svg(`
    <path d="M20 28 L20 20 C20 8 44 8 44 20 L44 28" fill="none" stroke-width="10"/>
    <path d="M20 28 L20 20 C20 8 44 8 44 20 L44 28" fill="none" stroke="#b9bec5" stroke-width="4"/>
    <rect x="10" y="27" width="44" height="32" rx="6" fill="#ffcf3d"/>
    <circle cx="32" cy="40" r="5" fill="${INK}"/>
    <path d="M32 42 L32 51" fill="none" stroke-width="4"/>
    ${hl('M16 33 L16 45', 2.5, 0.7)}`),
  up: () => svg(`
    <path d="M32 4 L58 31 L42 31 L42 60 L22 60 L22 31 L6 31 Z" fill="#7ed957"/>
    ${hl('M32 12 L49 29', 2.5, 0.7)}`),
  sun: () => svg(`
    ${Array.from({ length: 8 }, (_, i) => `<path d="M32 3 L37 13 L27 13 Z" fill="#ffb52e" stroke-width="2.2" transform="rotate(${i * 45} 32 32)"/>`).join('')}
    <circle cx="32" cy="32" r="15" fill="#ffd23f"/>
    ${hl('M23 28 C24 24 27 21 31 20', 2.5, 0.7)}`),
  moon: () => svg(`
    <path d="M40 6 C24 8 11 20 11 35 C11 49 23 59 38 59 C48 59 56 53 60 45 C54 47 47 47 41 44 C30 40 24 30 26 19 C28 13 33 8 40 6 Z" fill="#f5e6a8"/>
    <path d="M50 12 L52 17 L57 19 L52 21 L50 26 L48 21 L43 19 L48 17 Z" fill="#fff4c2" stroke-width="2"/>
    <circle cx="22" cy="44" r="3" fill="#e8d48a" stroke-width="2"/>`),
};

function meat(color, extra) {
  return svg(`
    ${rod('M38 38 L50 50', '#f4efe3', 6)}
    <circle cx="49" cy="56" r="5" fill="#f4efe3"/><circle cx="56" cy="49" r="5" fill="#f4efe3"/>
    <path d="M13 42 C4 31 12 10 30 10 C47 10 56 25 47 38 L41 42 C35 48 22 51 13 42 Z" fill="${color}"/>
    ${extra}`);
}

function armor(color) {
  return svg(`
    <path d="M20 7 L27 11 C29 16 35 16 37 11 L44 7 L57 15 L53 30 L46 28 L46 57 L18 57 L18 28 L11 30 L7 15 Z" fill="${color}"/>
    <path d="M32 17 L32 57" fill="none" stroke="${shade(color, -0.3)}" stroke-width="2.5"/>
    <path d="M18 40 L46 40" fill="none" stroke="${shade(color, -0.3)}" stroke-width="2.5"/>
    <circle cx="25" cy="24" r="2" fill="${shade(color, -0.35)}" stroke="none"/><circle cx="39" cy="24" r="2" fill="${shade(color, -0.35)}" stroke="none"/>
    ${hl('M23 30 L23 50', 3, 0.6)}`);
}

function chest(body, lid, band, lock) {
  return svg(`
    <rect x="7" y="29" width="50" height="27" rx="3" fill="${body}"/>
    <path d="M7 31 L7 22 C7 11 57 11 57 22 L57 31 Z" fill="${lid}"/>
    <rect x="13" y="13" width="7" height="43" fill="${band}" stroke-width="2.5"/>
    <rect x="44" y="13" width="7" height="43" fill="${band}" stroke-width="2.5"/>
    <rect x="26" y="25" width="12" height="13" rx="2" fill="${lock}" stroke-width="2.5"/>
    <circle cx="32" cy="31" r="1.8" fill="${INK}" stroke="none"/>
    ${hl('M24 17 C30 15 36 15 40 16', 2.5, 0.6)}`);
}

function tool(kind, tier) {
  const head = METAL[tier], dark = shade(head, -0.3);
  let body;
  if (kind === 'sword') {
    body = `
      <path d="M27 42 L27 13 L32 3 L37 13 L37 42 Z" fill="${head}"/>
      <path d="M32 7 L32 40" fill="none" stroke="${dark}" stroke-width="2"/>
      ${hl('M29.5 14 L29.5 38', 2, 0.75)}
      ${rod('M32 46 L32 55', WOOD, 5)}
      <rect x="16" y="40" width="32" height="7" rx="3" fill="${tier === 'wood' ? WOOD_D : '#c99a2e'}"/>
      <circle cx="32" cy="58" r="4" fill="${tier === 'wood' ? WOOD_D : '#c99a2e'}"/>`;
  } else if (kind === 'axe') {
    body = `
      ${rod('M32 60 L32 8', WOOD, 5)}
      <path d="M30 10 L45 5 C55 13 56 29 46 36 L30 29 Z" fill="${head}"/>
      <path d="M45 5 C55 13 56 29 46 36" fill="none" stroke="${shade(head, 0.45)}" stroke-width="2.5"/>
      <rect x="26" y="8" width="8" height="21" rx="2" fill="${dark}"/>
      ${line('M28 54 L36 54 M28 49 L36 49', WOOD_D, 2.5)}`;
  } else {
    body = `
      ${rod('M32 60 L32 14', WOOD, 5)}
      <path d="M5 24 C15 6 49 6 59 24 L54 26 C44 15 20 15 10 26 Z" fill="${head}"/>
      ${hl('M13 18 C22 11 42 11 51 18', 2, 0.7)}
      <rect x="26" y="10" width="12" height="11" rx="2" fill="${dark}"/>
      ${line('M28 54 L36 54 M28 49 L36 49', WOOD_D, 2.5)}`;
  }
  return svg(`<g transform="rotate(40 32 32) translate(3.2 3.2) scale(.9)">${body}</g>`);
}

// ── 능력 ─────────────────────────────────────────
const POWER = {
  sneaker: () => svg(`
    ${line('M4 22 L16 22 M2 32 L12 32 M6 42 L14 42', '#9ad0ff', 3)}
    <g transform="rotate(-18 36 34)">
      <ellipse cx="37" cy="36" rx="23" ry="12" fill="#e3c27a"/>
      ${line('M20 30 L54 30 M17 36 L57 36 M20 42 L54 42', '#b8943f', 2)}
      <path d="M28 26 C32 16 44 16 48 26" fill="none" stroke="${INK}" stroke-width="7"/>
      <path d="M28 26 C32 16 44 16 48 26" fill="none" stroke="#e8413a" stroke-width="3.5"/>
    </g>`),
  heart: () => svg(`
    <path d="M32 56 C12 43 4 33 4 22 C4 12 12 6 20 6 C26 6 30 10 32 14 C34 10 38 6 44 6 C52 6 60 12 60 22 C60 33 52 43 32 56 Z" fill="#e8413a"/>
    <path d="M27 20 L37 20 L37 26 L43 26 L43 36 L37 36 L37 42 L27 42 L27 36 L21 36 L21 26 L27 26 Z" fill="#fff" stroke-width="2.5"/>
    ${hl('M11 20 C11 15 14 12 19 12', 3, 0.6)}`),
  whetstone: () => svg(`
    <path d="M6 42 L16 30 L58 30 L48 42 Z" fill="#7d8fa3"/>
    <path d="M6 42 L48 42 L48 54 L6 54 Z" fill="#5f7085"/>
    <path d="M48 42 L58 30 L58 42 L48 54 Z" fill="#4b596b"/>
    ${hl('M14 36 L44 36', 2, 0.55)}
    <path d="M22 26 L50 6 L54 10 L28 30 Z" fill="#dde2e8" stroke-width="2.5"/>
    ${line('M14 18 L18 22 M36 20 L40 16 M24 12 L26 18', '#ffd23f', 3)}`),
  glove: () => svg(`
    <path d="M18 50 L18 34 L13 24 C11 18 17 15 20 20 L24 28 L24 12 C24 7 30 7 30 12 L30 26 L32 8 C32 3 38 3 38 8 L38 26 L40 11 C40 6 46 6 46 11 L46 28 L48 17 C48 12 54 12 54 17 L52 40 C52 46 48 50 46 50 Z" fill="#e0a84a"/>
    <rect x="16" y="48" width="32" height="12" rx="3" fill="#b86d2a"/>
    ${line('M20 54 L44 54', '#8a4f1c', 2)}
    ${hl('M27 14 L27 24', 2, 0.6)}`),
  riceball: () => svg(`
    <path d="M32 6 C38 6 58 42 56 50 C54 58 10 58 8 50 C6 42 26 6 32 6 Z" fill="#fbf8ef"/>
    <path d="M16 40 L48 40 C51 46 52 50 50 58 L14 58 C12 50 13 46 16 40 Z" fill="#2f4a36"/>
    ${line('M20 46 L44 46', '#476b50', 2)}
    <circle cx="26" cy="26" r="1.6" fill="#e9e2cf" stroke="none"/><circle cx="36" cy="22" r="1.6" fill="#e9e2cf" stroke="none"/><circle cx="38" cy="32" r="1.6" fill="#e9e2cf" stroke="none"/>
    ${hl('M25 17 C22 22 20 26 18 31', 3, 0.8)}`),
  feather: () => svg(`
    <path d="M52 5 C30 8 13 27 13 49 C33 47 50 31 52 5 Z" fill="#eef6ff"/>
    <path d="M52 5 C44 22 30 38 8 58" fill="none" stroke-width="3"/>
    ${line('M40 18 L30 16 M44 24 L36 30 M34 30 L24 28 M38 36 L28 42 M26 42 L18 40', '#9fb7d0', 2)}
    ${line('M4 20 L14 20 M2 28 L10 28', '#9ad0ff', 3)}`),
  pouch: () => svg(`
    <path d="M17 30 C7 40 9 59 32 59 C55 59 57 40 47 30 Z" fill="#e8413a"/>
    <path d="M19 31 L22 13 L32 20 L42 13 L45 31 Z" fill="#ff7b54"/>
    <path d="M16 31 C24 35 40 35 48 31" fill="none" stroke="${INK}" stroke-width="7"/>
    <path d="M16 31 C24 35 40 35 48 31" fill="none" stroke="#ffcf3d" stroke-width="3.5"/>
    <circle cx="32" cy="46" r="7.5" fill="#ffcf3d" stroke-width="2.5"/>
    <rect x="29" y="43" width="6" height="6" fill="#b5301f" stroke="none"/>
    ${hl('M15 44 C15 40 17 37 19 36', 2.5, 0.6)}`),
  herb: () => svg(`
    <path d="M32 60 C32 46 30 36 32 20" fill="none" stroke="#3f8a33" stroke-width="3.5"/>
    <path d="M32 22 C22 22 14 14 14 4 C26 4 32 12 32 22 Z" fill="#6bcb77"/>
    <path d="M32 22 C42 22 50 14 50 4 C38 4 32 12 32 22 Z" fill="#5cbf4a"/>
    <path d="M31 40 C20 42 10 36 6 26 C18 24 28 30 31 40 Z" fill="#7ed957"/>
    <path d="M33 44 C44 46 54 40 58 30 C46 28 36 34 33 44 Z" fill="#6bcb77"/>
    ${line('M18 8 L30 20 M46 8 L34 20 M10 28 L28 38 M54 32 L36 42', '#3f8a33', 1.8)}`),
  fang: () => svg(`
    <path d="M6 10 C20 18 44 18 58 10 L58 18 C44 26 20 26 6 18 Z" fill="#b5301f"/>
    <path d="M14 18 C17 32 20 44 23 54 C27 42 29 30 30 20 Z" fill="#fbf8ef"/>
    <path d="M34 20 C35 30 37 42 41 54 C44 44 47 32 50 18 Z" fill="#fbf8ef"/>
    <path d="M23 54 C21 57 21 61 24 61 C27 61 26 57 23 54 Z" fill="#e8413a" stroke-width="2"/>
    ${hl('M18 24 L21 38', 2, 0.9)}`),
  hawk: () => svg(`
    <path d="M4 34 C16 17 48 17 60 34 C48 51 16 51 4 34 Z" fill="#fbf8ef"/>
    <circle cx="32" cy="34" r="12" fill="#ffb52e"/>
    <circle cx="32" cy="34" r="5.5" fill="${INK}"/>
    <circle cx="29" cy="30" r="2.2" fill="#fff" stroke="none"/>
    <path d="M2 24 C16 8 44 6 62 18 L58 24 C42 16 20 16 6 28 Z" fill="#7a4a22"/>`),
  turtle: () => svg(`
    <ellipse cx="12" cy="44" rx="6" ry="5" fill="#8ccf6b"/>
    <ellipse cx="16" cy="54" rx="5" ry="4" fill="#8ccf6b"/><ellipse cx="48" cy="54" rx="5" ry="4" fill="#8ccf6b"/>
    <path d="M8 46 C8 20 20 10 34 10 C48 10 58 22 58 46 Z" fill="#4f9a36"/>
    <path d="M24 26 L34 20 L44 26 L44 38 L34 44 L24 38 Z" fill="#6fbf4a" stroke-width="2.5"/>
    ${line('M24 26 L14 22 M44 26 L52 20 M24 38 L12 44 M44 38 L56 44 M34 44 L34 46 M34 20 L34 10', INK, 2.5)}
    <rect x="6" y="44" width="54" height="6" rx="3" fill="#e3c27a"/>
    ${hl('M18 22 C22 16 26 14 30 13', 2.5, 0.6)}`),
  ginseng: () => svg(`
    <path d="M32 24 C32 16 30 10 26 6 M32 24 C34 16 38 10 44 8" fill="none" stroke="#3f8a33" stroke-width="3"/>
    <path d="M26 6 C20 4 14 8 14 14 C20 14 24 12 26 6 Z M44 8 C50 4 56 8 56 14 C50 15 46 12 44 8 Z" fill="#6bcb77" stroke-width="2.5"/>
    <circle cx="36" cy="10" r="3.5" fill="#e8413a" stroke-width="2"/>
    <path d="M26 22 C22 30 22 38 24 44 C20 50 14 54 10 58 C18 58 24 54 27 50 L28 60 L32 50 C34 54 40 60 48 58 C42 54 38 48 38 42 C42 36 40 28 38 22 Z" fill="#f0d9a8"/>
    ${line('M26 30 L36 30 M25 36 L35 36', '#c9a86a', 2)}`),
  cloud: () => svg(`
    <path d="M12 50 C4 50 2 40 8 36 C6 28 16 22 22 28 C24 16 42 14 46 26 C54 22 62 30 58 38 C64 42 60 50 54 50 Z" fill="#fbfdff"/>
    ${line('M14 44 C20 46 26 46 30 44', '#bcd3ea', 2.5)}
    <path d="M22 20 C14 18 10 12 10 6 C16 8 20 12 22 20 Z M42 18 C50 16 54 10 56 4 C48 6 44 10 42 18 Z" fill="#9ad0ff" stroke-width="2.2"/>
    ${hl('M16 32 C18 29 20 28 22 29', 2.5, 0.9)}`),
  thorns: () => svg(`
    ${[[32, 3, 28, 12, 36, 12], [8, 10, 17, 14, 13, 21], [56, 10, 47, 14, 51, 21], [3, 36, 12, 30, 12, 40], [61, 36, 52, 30, 52, 40]]
      .map(([a, b, c, d, e, f]) => `<path d="M${a} ${b} L${c} ${d} L${e} ${f} Z" fill="#dde2e8" stroke-width="2.2"/>`).join('')}
    <path d="M20 9 L27 13 C29 18 35 18 37 13 L44 9 L55 16 L51 30 L46 28 L46 57 L18 57 L18 28 L13 30 L9 16 Z" fill="#7a5aa6"/>
    ${[[25, 28], [39, 28], [32, 40], [25, 50], [39, 50]].map(([x, y]) => `<path d="M${x - 4} ${y + 3} L${x} ${y - 5} L${x + 4} ${y + 3} Z" fill="#dde2e8" stroke-width="2"/>`).join('')}`),
  drum: () => svg(`
    <ellipse cx="32" cy="46" rx="24" ry="9" fill="#9b2a1e"/>
    <path d="M8 22 L8 46 C8 51 56 51 56 46 L56 22 Z" fill="#c93a2b"/>
    ${[14, 24, 40, 50].map((x) => `<circle cx="${x}" cy="${x === 14 || x === 50 ? 44 : 47}" r="1.8" fill="#ffcf3d" stroke="none"/>`).join('')}
    <ellipse cx="32" cy="22" rx="24" ry="9" fill="#f1dfb0"/>
    <path d="M36 8 L24 26 L32 26 L27 40 L42 20 L34 20 L39 8 Z" fill="#ffd23f" stroke-width="2.5"/>`),
  berserk: () => svg(`
    <path d="M14 30 C6 26 2 16 6 4 C10 14 16 18 22 20 Z" fill="#f4efe3"/>
    <path d="M50 30 C58 26 62 16 58 4 C54 14 48 18 42 20 Z" fill="#f4efe3"/>
    <path d="M12 40 C12 20 20 12 32 12 C44 12 52 20 52 40 L52 56 L40 56 L40 46 L24 46 L24 56 L12 56 Z" fill="#8a8f98"/>
    <path d="M18 34 L46 34 L44 40 L20 40 Z" fill="#b5301f" stroke-width="2.5"/>
    <path d="M32 12 L32 34" fill="none" stroke="#5d626a" stroke-width="3"/>
    ${hl('M18 28 C19 22 22 18 26 16', 2.5, 0.6)}`),
  phoenix: () => svg(`
    <path d="M50 4 C58 18 56 36 44 48 C36 56 22 58 12 56 C14 44 20 30 30 20 C36 14 44 10 50 4 Z" fill="#ff7b2e"/>
    <path d="M46 14 C48 26 44 38 36 44 C30 48 24 50 20 50 C22 40 28 30 36 24 C40 20 44 18 46 14 Z" fill="#ffd23f" stroke-width="2.2"/>
    <path d="M50 4 C42 22 26 40 6 60" fill="none" stroke-width="3"/>
    ${line('M8 30 C4 26 6 20 10 18 M16 12 C14 8 16 4 20 2', '#ffb52e', 3)}`),
  belt: () => svg(`
    <path d="M2 22 C20 28 44 28 62 22 L62 42 C44 48 20 48 2 42 Z" fill="#c93a2b"/>
    ${line('M4 26 C20 32 44 32 60 26 M4 38 C20 44 44 44 60 38', '#ffcf3d', 2)}
    <rect x="18" y="14" width="28" height="36" rx="6" fill="#ffcf3d"/>
    <rect x="24" y="20" width="16" height="24" rx="3" fill="#f0b323" stroke-width="2.5"/>
    <path d="M32 24 L35 30 L41 31 L36.5 35 L38 41 L32 38 L26 41 L27.5 35 L23 31 L29 30 Z" fill="#fff4c2" stroke-width="1.8"/>`),
};

let count = 0;
const write = (name, content) => { writeFileSync(join(OUT, `${name}.svg`), content); count++; };
for (const id of ITEM_IDS) {
  const m = id.match(/^(wood|stone|iron|mithril)_(axe|pick|sword)$/);
  if (m) write(id, tool(m[2], m[1]));
  else if (ICONS[id]) write(id, ICONS[id]());
  else throw new Error(`아이콘 없음: ${id}`);
}
for (const id of POWER_IDS) {
  if (!POWER[id]) throw new Error(`능력 아이콘 없음: ${id}`);
  write(`p_${id}`, POWER[id]());
}
for (const id of ['coin', 'heart', 'bolt', 'hunger', 'skull', 'hammer', 'boat', 'map', 'crown', 'chest', 'gold_chest', 'sun', 'moon', 'lock', 'up']) write(id, ICONS[id]());
console.log(`아이콘 ${count}개 → ${OUT}`);
