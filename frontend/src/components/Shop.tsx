import { useState } from 'react'
import { SITE_CONFIGS } from '@/scraper/catalog'
import Minibrowser from '@/components/Minibrowser'
import type { useWardrobe } from '@/hooks/useWardrobe'
import { cn } from '@/lib/utils'
import { pillBase, pillActive, pillInactive } from '@/lib/ui'

type Wardrobe = ReturnType<typeof useWardrobe>

// The mini browser: the store site itself, iframed through the proxy worker.
// The injected scraper highlights config-targeted product images; clicking one
// saves it into the wardrobe DB.
export default function Shop({ wardrobe }: { wardrobe: Wardrobe }) {
  const [siteIdx, setSiteIdx] = useState(0)
  const config = SITE_CONFIGS[siteIdx]

  return (
    <section className="flex min-h-0 flex-1 flex-col p-4 pb-6 sm:p-6 max-md:pb-20">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1">
        {SITE_CONFIGS.map((c, i) => (
          <button
            key={c.site}
            onClick={() => setSiteIdx(i)}
            className={cn(
              pillBase,
              'py-2 text-xs uppercase',
              i === siteIdx ? pillActive : pillInactive,
            )}
          >
            {c.brand}
          </button>
        ))}
      </div>
      <Minibrowser key={config.site} config={config} wardrobe={wardrobe} onClose={undefined} />
    </section>
  )
}
