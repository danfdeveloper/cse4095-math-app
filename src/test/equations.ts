/** Every "a op b op c = d" written in some text, such as "5 × 8 = 40" or "4 + 3 + 1 = 8". */
const EQUATION = /\d+(?: [+−×÷] \d+)+ = \d+/g

export function findEquations(text: string): string[] {
  return text.match(EQUATION) ?? []
}

/** Works out "a + b × c" the usual way: × and ÷ first, then + and −, left to right. */
export function evaluate(expression: string): number {
  const tokens = expression.split(' ')
  const values: number[] = [Number(tokens[0])]
  const lowOps: string[] = []

  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i]
    const value = Number(tokens[i + 1])
    if (op === '×') values.push(values.pop()! * value)
    else if (op === '÷') values.push(values.pop()! / value)
    else {
      lowOps.push(op)
      values.push(value)
    }
  }

  let total = values[0]
  lowOps.forEach((op, i) => {
    total = op === '+' ? total + values[i + 1] : total - values[i + 1]
  })
  return total
}

/** The equations in some text that are not actually true. Empty means all are. */
export function wrongEquations(text: string): string[] {
  return findEquations(text).filter((equation) => {
    const [left, right] = equation.split(' = ')
    return evaluate(left) !== Number(right)
  })
}
