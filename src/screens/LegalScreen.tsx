import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { legalPages } from '../data/legalContent'

// Privacy policy, Terms of use and Community guidelines. Open to everyone,
// also before signing in.
export function LegalScreen({ page }: { page: keyof typeof legalPages }) {
  const navigate = useNavigate()
  const content = legalPages[page]
  return (
    <main className="screen legal-page">
      <header className="mates-header">
        <button type="button" className="icon-button" aria-label="Back" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))}>
          <ArrowLeft />
        </button>
        <div>
          <p className="eyebrow">Updated {content.updated}</p>
          <h1>{content.title}</h1>
        </div>
      </header>
      <p className="legal-intro">{content.intro}</p>
      {content.sections.map((section) => (
        <section key={section.heading} className="legal-section">
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      ))}
    </main>
  )
}
