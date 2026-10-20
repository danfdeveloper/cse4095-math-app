import styles from './StatTiles.module.css'

export interface StatTile {
  label: string
  value: string | number
}

interface StatTilesProps {
  tiles: readonly StatTile[]
}

/**
 * A row of big numbers, each with a label. In the page the label comes first
 * (so a screen reader says "Correct: 7"), but it shows under the number.
 */
export function StatTiles({ tiles }: StatTilesProps) {
  return (
    <dl className={styles.tiles}>
      {tiles.map(({ label, value }) => (
        <div key={label} className={styles.tile}>
          <dt className={styles.label}>{label}</dt>
          <dd className={styles.value}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
