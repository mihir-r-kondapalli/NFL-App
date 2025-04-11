// app/components/Button.tsx
"use client"

import styles from './Button.module.css'

type ButtonProps = {
  label: string
  onClick: () => void
}

export default function Button({ label, onClick }: ButtonProps) {
  return (
    <button onClick={onClick} className={styles.button}>{label}</button>
  )
}
