/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Counts how often the header is drawn, by wrapping the real one.
const headerRenders = vi.hoisted(() => ({ count: 0 }))
vi.mock('../components/layout/Header', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../components/layout/Header')>()
  return {
    Header: () => {
      headerRenders.count++
      return actual.Header()
    },
  }
})

import { renderApp } from './renderApp'

/*
 * Guards for rendering (TODO Task 83): questions are made in event handlers,
 * never while drawing, and practicing does not redraw what has nothing to do
 * with the card.
 */

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : []
  })
}

describe('making questions', () => {
  it('is never done by a page, a component or a hook, which run while drawing', () => {
    const drawing = ['src/pages', 'src/components', 'src/hooks'].flatMap(
      (directory) => sourceFiles(`${process.cwd()}/${directory}`),
    )
    const offenders = drawing.filter((file) =>
      /from '[./]*\/services\/(questionGenerator|reviewQuestions|similarQuestions)'/.test(
        readFileSync(file, 'utf8'),
      ),
    )

    expect(drawing.length).toBeGreaterThan(30)
    expect(offenders).toEqual([])
  })
})

describe('practicing', () => {
  it('does not redraw the header for picking, flipping and answering', async () => {
    const user = userEvent.setup()
    renderApp('/practice/setup')
    await user.click(screen.getByRole('checkbox', { name: 'Addition' }))
    await user.click(screen.getByRole('button', { name: 'Start Session' }))
    const before = headerRenders.count

    for (let count = 0; count < 3; count++) {
      await user.click(
        within(screen.getByRole('group')).getAllByRole('button')[1],
      )
      await user.click(screen.getByRole('button', { name: 'Flip Card' }))
      await user.click(screen.getByRole('button', { name: 'I Got It Right' }))
    }

    expect(headerRenders.count).toBe(before)
  })
})
