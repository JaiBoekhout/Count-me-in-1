import { useEffect, useRef, useState } from 'react'
import { bannersFor, getPartnerBanners, logPartnerEvent, type PartnerBanner } from '../lib/partners'

// Partner (sponsor) banners. Members only get banners that are Live; the team
// also sees Concept banners (marked), to test them and show them to businesses.
// `sports`: only general banners plus banners for these sports. null = all.
export function PartnerSlider({ sports = null, className = '' }: { sports?: string[] | null; className?: string }) {
  const [banners, setBanners] = useState<PartnerBanner[]>([])
  const trackRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let active = true
    void getPartnerBanners().then((result) => { if (active) setBanners(result) })
    return () => { active = false }
  }, [])

  const visible = bannersFor(banners, sports)

  // Count a view when a banner is at least half on screen.
  useEffect(() => {
    const track = trackRef.current
    if (!track || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.bannerId
        if (entry.isIntersecting && id) void logPartnerEvent(id, 'view')
      }
    }, { threshold: 0.5 })
    track.querySelectorAll('[data-banner-id]').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [visible.length])

  if (visible.length === 0) return null

  return (
    <section className={`partner-slider ${className}`.trim()} aria-label="Partners">
      <div className="partner-slider-track" ref={trackRef}>
        {visible.map((banner) => <PartnerBannerCard key={banner.id} banner={banner} />)}
      </div>
    </section>
  )
}

export function PartnerBannerCard({ banner, preview = false }: { banner: Pick<PartnerBanner, 'name' | 'headline' | 'ctaLabel' | 'linkUrl' | 'imageUrl' | 'status'> & { id?: string }; preview?: boolean }) {
  const content = (
    <>
      <img src={banner.imageUrl} alt="" loading="lazy" />
      <span className="partner-banner-shade" />
      <span className="partner-banner-text">
        <span className="partner-banner-label">
          Partner{banner.status === 'concept' ? ' · Concept, only the team sees this' : ''}
        </span>
        <span>
          <small>{banner.name}</small>
          {banner.headline && <strong>{banner.headline}</strong>}
        </span>
        {banner.linkUrl && <span className="partner-banner-cta">{banner.ctaLabel}</span>}
      </span>
    </>
  )
  if (!banner.linkUrl || preview) {
    return <div className="partner-banner" data-banner-id={banner.id}>{content}</div>
  }
  return (
    <a
      className="partner-banner"
      data-banner-id={banner.id}
      href={banner.linkUrl}
      target="_blank"
      rel="noreferrer sponsored"
      onClick={() => { if (banner.id) void logPartnerEvent(banner.id, 'tap') }}
    >
      {content}
    </a>
  )
}
