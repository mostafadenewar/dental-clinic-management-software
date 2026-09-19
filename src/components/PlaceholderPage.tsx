import type { ReactNode } from 'react'
import './placeholder.css'

interface PlaceholderPageProps {
  icon: ReactNode
  title: string
  description: string
  accent: 'blue' | 'violet' | 'amber'
  rows: string[]
}

const PlaceholderPage = ({ icon, title, description, accent, rows }: PlaceholderPageProps) => {
  return (
    <div className="placeholder-page">
      <section className="placeholder-card">
        <div className={`placeholder-icon accent-${accent}`}>{icon}</div>
        <span className="placeholder-badge">Placeholder</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="placeholder-rows">
          {rows.map((_row, index) => (
            <div key={index} className="placeholder-row">
              <span className="ph-line ph-line-sm" />
              <span className="ph-line" />
              <span className="ph-chip" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default PlaceholderPage