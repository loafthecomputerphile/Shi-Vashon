import { useState } from 'react'
import { SITE_CONFIGS } from '@/scraper/catalog'
import Minibrowser from '@/components/Minibrowser'
import { UnderlineTabs } from '@/components/kit/tabs'
import type { Wardrobe } from '@/hooks/useWardrobe'

// The mini browser: the store site itself, iframed through the proxy worker.
// The injected scraper highlights config-targeted product images; clicking one
// saves it into the wardrobe DB.
export default function Shop({ wardrobe, onSaved }: { wardrobe: Wardrobe; onSaved?: (name: string) => void }) {
  const [siteIdx, setSiteIdx] = useState(0)
  const config = SITE_CONFIGS[siteIdx]

  return (
    <section className="flex min-h-0 flex-1 flex-col p-4 pb-6 sm:p-6 max-md:pb-20">
      <UnderlineTabs
        className="mb-4 flex-wrap items-center gap-x-5 gap-y-1"
        items={SITE_CONFIGS.map((c, i) => ({ id: String(i), label: c.brand }))}
        activeId={String(siteIdx)}
        onChange={(id) => setSiteIdx(Number(id))}
      />
      <Minibrowser key={config.site} config={config} wardrobe={wardrobe} onClose={undefined} onSaved={onSaved} />
    </section>
  )
}
