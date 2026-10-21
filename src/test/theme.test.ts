/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ACCENTS,
  ANSWER_ACCENTS,
  answerAccent,
  DIFFICULTY_ACCENT,
  OPERATION_ACCENT,
} from '../constants/accents'
import { DIFFICULTY_LEVELS, MATH_OPERATIONS } from '../constants/practice'

/*
 * Guards for the visual design, so that a change to the colours or the styles
 * cannot quietly break what the specification asks for (sections 13 and 14):
 * readable text, no meaning carried by colour alone, no motion that cannot be
 * turned off, nothing distracting, and nothing fetched from outside.
 */

// The styles are read from disk: Vitest swaps CSS imports for placeholders.
// Tests run from the project folder.
const root = `${process.cwd()}/`

function cssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return cssFiles(path)
    return entry.name.endsWith('.css') ? [path] : []
  })
}

const sheets: Record<string, string> = Object.fromEntries(
  cssFiles(join(root, 'src')).map((path) => [
    path.slice(root.length),
    readFileSync(path, 'utf8'),
  ]),
)
const indexCss = sheets['src/index.css']
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8')

/** The value of every custom property in index.css's :root. */
function tokens(): Record<string, string> {
  const found: Record<string, string> = {}
  for (const [, name, value] of indexCss.matchAll(
    /(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g,
  )) {
    found[name] = value.toLowerCase()
  }
  return found
}
const T = tokens()

const channel = (hex: string, i: number) =>
  parseInt(hex.slice(i, i + 2), 16) / 255
const linear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
const luminance = (hex: string) =>
  0.2126 * linear(channel(hex, 1)) +
  0.7152 * linear(channel(hex, 3)) +
  0.0722 * linear(channel(hex, 5))
/** WCAG contrast ratio, from 1 to 21. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const HUES = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
]

describe('the palette', () => {
  it('has a deep, a bright and a soft shade of every hue', () => {
    for (const hue of HUES) {
      for (const shade of ['deep', 'bright', 'soft']) {
        expect(T[`--${hue}-${shade}`], `--${hue}-${shade}`).toMatch(
          /^#[0-9a-f]{6}$/,
        )
      }
    }
  })

  describe('keeps text readable (AA: 4.5 to 1)', () => {
    const problems: string[] = []
    const need = (label: string, a: string, b: string, min: number) => {
      const ratio = contrast(a, b)
      if (ratio < min)
        problems.push(`${label}: ${ratio.toFixed(2)} (needs ${min})`)
    }
    const white = T['--color-surface']
    const page = T['--color-bg']
    const text = T['--color-text']
    const muted = T['--color-text-muted']

    for (const hue of HUES.filter((h) => h !== 'red')) {
      const deep = T[`--${hue}-deep`]
      const bright = T[`--${hue}-bright`]
      const soft = T[`--${hue}-soft`]
      need(`${hue} deep text on white`, deep, white, 4.5)
      need(`${hue} deep text on the page`, deep, page, 4.5)
      need(`${hue} deep text on its soft shade`, deep, soft, 4.5)
      need(`white check mark on ${hue} deep`, white, deep, 4.5)
      need(`body text on ${hue} soft`, text, soft, 4.5)
      need(`muted text on ${hue} soft`, muted, soft, 4.5)
      need(`body text on ${hue} bright`, text, bright, 4.5)
    }

    it.each([
      ['body text on the page', text, page],
      ['body text on white', text, white],
      ['muted text on the page', muted, page],
      ['muted text on white', muted, white],
      [
        'white text on a primary button',
        T['--color-on-primary'],
        T['--color-primary'],
      ],
      [
        'white text on a primary button being pressed',
        T['--color-on-primary'],
        T['--color-primary-active'],
      ],
      [
        'primary text on its soft shade',
        T['--color-primary'],
        T['--color-primary-soft'],
      ],
      [
        'text on a disabled button',
        T['--color-disabled-text'],
        T['--color-disabled-bg'],
      ],
    ])('%s', (label, a, b) => {
      expect(contrast(a, b), label).toBeGreaterThanOrEqual(4.5)
    })

    it('for every hue, text and the check marks in filled controls', () => {
      expect(problems).toEqual([])
    })
  })

  it('keeps the focus ring visible on every background it can land on (3 to 1)', () => {
    const ring = T['--color-focus']
    const backgrounds = [
      T['--color-surface'],
      T['--color-bg'],
      ...HUES.flatMap((h) => [T[`--${h}-bright`], T[`--${h}-soft`]]),
    ]

    for (const background of backgrounds) {
      expect(contrast(ring, background), background).toBeGreaterThanOrEqual(3)
    }
  })

  it('makes a bar that shows a length easy to see against white (3 to 1)', () => {
    const bar = indexCss.match(
      /--rainbow-bar:\s*linear-gradient\(([^;]*)\);/s,
    )![1]
    const hues = [...bar.matchAll(/var\(--(\w+)-deep\)/g)].map((m) => m[1])

    expect(hues.length).toBeGreaterThanOrEqual(3)
    for (const hue of hues) {
      expect(
        contrast(T[`--${hue}-deep`], T['--color-surface']),
      ).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('the accents', () => {
  it('each has a rule in index.css that sets all three shades', () => {
    for (const accent of ACCENTS) {
      const rule = indexCss.match(
        new RegExp(`\\[data-accent='${accent}'\\]\\s*{([^}]*)}`),
      )
      expect(rule, accent).not.toBeNull()
      for (const shade of ['deep', 'bright', 'soft']) {
        expect(rule![1], `${accent} ${shade}`).toContain(
          `--accent-${shade}: var(--${accent}-${shade})`,
        )
      }
    }
  })

  it('give each operation its own colour', () => {
    const colours = MATH_OPERATIONS.map((op) => OPERATION_ACCENT[op])

    expect(new Set(colours).size).toBe(MATH_OPERATIONS.length)
  })

  it('give each level its own colour, none the same as an operation’s', () => {
    const levels = DIFFICULTY_LEVELS.map((level) => DIFFICULTY_ACCENT[level])
    const operations = MATH_OPERATIONS.map((op) => OPERATION_ACCENT[op])

    expect(new Set(levels).size).toBe(DIFFICULTY_LEVELS.length)
    for (const colour of levels) expect(operations).not.toContain(colour)
  })

  it('never use red, so no card or tile looks like a verdict', () => {
    const everything = [
      ...Object.values(OPERATION_ACCENT),
      ...Object.values(DIFFICULTY_ACCENT),
      ...ANSWER_ACCENTS,
      ...ACCENTS,
    ]

    expect(everything).not.toContain('red' as never)
  })

  describe('for the answer choices', () => {
    it('include neither green nor orange nor red, which suggest right and wrong', () => {
      for (const accent of ANSWER_ACCENTS) {
        expect(['green', 'orange', 'red', 'yellow']).not.toContain(accent)
      }
    })

    it('are all different, so the four choices look different', () => {
      expect(new Set(ANSWER_ACCENTS).size).toBe(4)
    })

    it('go round again if there are ever more choices', () => {
      expect(answerAccent(0)).toBe(ANSWER_ACCENTS[0])
      expect(answerAccent(3)).toBe(ANSWER_ACCENTS[3])
      expect(answerAccent(4)).toBe(ANSWER_ACCENTS[0])
      expect(answerAccent(9)).toBe(ANSWER_ACCENTS[1])
    })
  })
})

describe('the styles', () => {
  const files = Object.entries(sheets)

  it('are all being checked', () => {
    expect(files.length).toBeGreaterThanOrEqual(25)
  })

  it('give every file that moves or fades something a reduced-motion rule (section 14)', () => {
    const moves =
      /(?:^|[\s;{])(?:animation|transition)\s*:|(?:^|[\s;{])transform\s*:\s*(?!none)/m
    const offenders = files
      .filter(
        ([, css]) => moves.test(css) && !css.includes('prefers-reduced-motion'),
      )
      .map(([file]) => file)

    expect(offenders).toEqual([])
  })

  it('never loop an animation, which would distract (section 13.1)', () => {
    const offenders = files
      .filter(([, css]) => /\binfinite\b/.test(css))
      .map(([file]) => file)

    expect(offenders).toEqual([])
  })

  it('fetch nothing from outside: no web fonts, no imported sheets, no remote images (section 17)', () => {
    const offenders = files
      .filter(
        ([, css]) =>
          /@import|url\(\s*['"]?(?:https?:)?\/\//i.test(css) ||
          /https?:\/\//i.test(css),
      )
      .map(([file]) => file)

    expect(offenders).toEqual([])
  })

  it('and the page itself loads nothing from outside', () => {
    const remote = [
      ...indexHtml.matchAll(
        /\b(?:src|href)\s*=\s*["']((?:https?:)?\/\/[^"']+)["']/gi,
      ),
    ].map((m) => m[1])

    expect(remote).toEqual([])
  })
})
