/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * Guards for the responsive design (specification section 15): large touch
 * targets, answers that stack on small screens, a low and simple navigation bar
 * on a phone, and nothing that makes a page scroll sideways. The real layout is
 * measured in a browser; these keep the rules that produce it from being lost.
 * The styles are read from disk, as Vitest swaps CSS imports for placeholders.
 */
const css = (path: string) => readFileSync(`${process.cwd()}/${path}`, 'utf8')

/** The rules inside the first media query that starts with this condition. */
function insideMedia(source: string, condition: string): string {
  const start = source.indexOf(`@media ${condition}`)
  expect(start, `no @media ${condition}`).toBeGreaterThanOrEqual(0)
  let depth = 0
  for (let at = source.indexOf('{', start); at < source.length; at++) {
    if (source[at] === '{') depth++
    if (source[at] === '}' && --depth === 0) {
      return source.slice(source.indexOf('{', start) + 1, at)
    }
  }
  throw new Error(`@media ${condition} is not closed`)
}

const rem = (value: string) => Number.parseFloat(value)

describe('touch targets', () => {
  const index = css('src/index.css')

  it('are at least 44px (2.75rem) everywhere, and 48px (3rem) from tablet width', () => {
    expect(index).toMatch(/--target-min:\s*2\.75rem/)
    expect(insideMedia(index, '(min-width: 48rem)')).toMatch(
      /--target-min:\s*3rem/,
    )
  })

  it('is what the navigation links and the brand link are sized by', () => {
    for (const file of [
      'src/components/layout/Navigation.module.css',
      'src/components/layout/Header.module.css',
    ]) {
      expect(css(file)).toMatch(/min-height:\s*var\(--target-min\)/)
    }
  })

  it.each([
    ['src/components/common/Button.module.css', 3],
    ['src/components/practice/AnswerChoice.module.css', 4],
    ['src/components/common/OptionCard.module.css', 4],
    ['src/pages/SettingsPage.module.css', 3],
  ])('are larger still for %s (at least %srem)', (file, least) => {
    const heights = [...css(file).matchAll(/min-height:\s*([\d.]+)rem/g)].map(
      (found) => rem(found[1]),
    )

    expect(heights.length).toBeGreaterThan(0)
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(least)
  })
})

describe('the answer choices', () => {
  const front = css('src/components/practice/CardFront.module.css')

  it('are one column on a phone and two from 30rem up', () => {
    expect(front).toMatch(/\.choices\s*{[^}]*grid-template-columns:\s*1fr;/)
    expect(insideMedia(front, '(min-width: 30rem)')).toMatch(
      /grid-template-columns:\s*1fr 1fr/,
    )
  })
})

describe('the navigation bar on a phone', () => {
  const nav = css('src/components/layout/Navigation.module.css')
  const phone = insideMedia(nav, '(max-width: 47.99rem)')

  it('puts the four links in one row that shares the width, rather than three lines', () => {
    expect(phone).toMatch(/\.list\s*{[^}]*justify-content:\s*space-between/)
    expect(phone).toMatch(/\.list > li\s*{[^}]*flex:\s*1 1 auto/)
    expect(phone).toMatch(/\.link\s*{[^}]*justify-content:\s*center/)
  })

  it('still wraps, so that very large text is never cut off', () => {
    expect(nav).toMatch(/\.list\s*{[^}]*flex-wrap:\s*wrap/)
  })

  it('is a little tighter on the narrowest phones (320px)', () => {
    expect(insideMedia(nav, '(max-width: 22.5rem)')).toMatch(
      /font-size:\s*0\.9375rem/,
    )
  })

  it('keeps the header low on a phone', () => {
    expect(
      insideMedia(
        css('src/components/layout/Header.module.css'),
        '(max-width: 47.99rem)',
      ),
    ).toMatch(/padding-block:\s*var\(--space-sm\)/)
  })
})

describe('the practice card on a tablet', () => {
  const page = css('src/pages/PracticePage.module.css')

  it('sits lower on a tall window, by an amount that depends on the window and never on the card', () => {
    const tablet = insideMedia(page, '(min-width: 48rem)')

    expect(tablet).toMatch(
      /padding-top:\s*max\(0px,\s*calc\(\(100dvh - [\d.]+rem\) \/ 3\)\)/,
    )
  })

  it('stays centred on the page', () => {
    expect(css('src/components/practice/QuestionCard.module.css')).toMatch(
      /\.card\s*{[^}]*margin:\s*0 auto/,
    )
  })
})

describe('sideways scrolling', () => {
  const sheets = [
    'src/index.css',
    'src/pages/StatisticsPage.module.css',
    'src/components/statistics/RecentSessions.module.css',
    'src/components/statistics/StatisticsGrid.module.css',
    'src/components/statistics/MistakePractice.module.css',
  ].map(css)

  it('is never forced on a page: nothing scrolls sideways, and nothing is as wide as a table', () => {
    for (const sheet of sheets) {
      expect(sheet).not.toMatch(/overflow(-x)?:\s*(scroll|auto)/)
      expect(sheet).not.toMatch(/<table|display:\s*table/)
    }
  })

  it('wraps long words instead of letting them push the page wider', () => {
    expect(css('src/index.css')).toMatch(/overflow-wrap:\s*anywhere/)
  })
})

describe('the statistics on a small screen', () => {
  it('give a long list of operations a row to itself, rather than squeezing it into half of one', () => {
    expect(css('src/components/statistics/RecentSessions.module.css')).toMatch(
      /\.wide\s*{[^}]*grid-column:\s*1 \/ -1/,
    )
  })

  it('show facts in one column on a phone, and two when there is room', () => {
    expect(css('src/components/statistics/RecentSessions.module.css')).toMatch(
      /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*18rem\),\s*1fr\)\)/,
    )
  })
})
