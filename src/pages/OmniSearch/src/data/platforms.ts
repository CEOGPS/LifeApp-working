import type { Platform, SearchMode } from '../types'

const enc = (s: string) => encodeURIComponent(s.trim())

const _platforms: Platform[] = []

function p(partial: Omit<Platform, 'searchUrl'> & { searchUrl: (q: string, m: SearchMode) => string }): Platform {
  return partial
}

// Reverse image search helpers
// Native reverse image endpoints
const googleLens = (imgUrl: string) => `https://lens.google.com/uploadbyurl?url=${enc(imgUrl)}`
const bingVisual = (imgUrl: string) => `https://www.bing.com/images/search?q=imgurl:${enc(imgUrl)}&view=detailv2`
const yandexImg = (imgUrl: string) => `https://yandex.com/images/search?rpt=imageview&url=${enc(imgUrl)}`
const tineyeUrl = (imgUrl: string) => `https://tineye.com/search?url=${enc(imgUrl)}`
// Site-filtered Google Images — finds where a photo appears on a specific domain
const googleSiteImage = (imgUrl: string, domain: string) =>
  `https://www.google.com/search?q=site:${domain}+${enc(imgUrl)}&tbm=isch`

// ── SOCIAL MEDIA (20) ──────────────────────────────────────────
_platforms.push(
  p({ id: 'facebook', name: 'Facebook', category: 'social', color: '#1877F2', icon: 'f',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'facebook.com')
      : m === 'email' || m === 'phone' ? `https://www.facebook.com/search/people/?q=${enc(q)}`
      : `https://www.facebook.com/search/top/?q=${enc(q)}`,
    supports: ['text', 'email', 'phone', 'image'], embeddable: false, priority: 1 }),
  p({ id: 'youtube', name: 'YouTube', category: 'social', color: '#FF0000', icon: '▶',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'youtube.com')
      : `https://www.youtube.com/results?search_query=${enc(q)}`,
    supports: ['text', 'image'], embeddable: true, priority: 1 }),
  p({ id: 'instagram', name: 'Instagram', category: 'social', color: '#E4405F', icon: 'IG',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'instagram.com')
      : `https://www.instagram.com/explore/search/keyword/?q=${enc(q)}`,
    supports: ['text', 'email', 'image'], embeddable: false, priority: 1 }),
  p({ id: 'tiktok', name: 'TikTok', category: 'social', color: '#000000', icon: 'TT',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'tiktok.com')
      : `https://www.tiktok.com/search?q=${enc(q)}`,
    supports: ['text', 'image'], embeddable: false, priority: 1 }),
  p({ id: 'whatsapp', name: 'WhatsApp', category: 'social', color: '#25D366', icon: 'WA',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'whatsapp.com')
      : m === 'phone' ? `https://wa.me/${enc(q.replace(/[^0-9]/g, ''))}`
      : `https://www.google.com/search?q=${enc('site:whatsapp.com ' + q)}`,
    supports: ['phone', 'text', 'image'], embeddable: false, priority: 2 }),
  p({ id: 'wechat', name: 'WeChat', category: 'social', color: '#07C160', icon: 'WC',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'wechat.com')
      : `https://www.google.com/search?q=${enc('site:wechat.com ' + q)}`,
    supports: ['text', 'image'], embeddable: false, priority: 3 }),
  p({ id: 'twitter', name: 'Twitter/X', category: 'social', color: '#1DA1F2', icon: 'X',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'twitter.com')
      : m === 'email' ? `https://twitter.com/search?q=${enc(q)}&src=typed_query&f=user`
      : `https://twitter.com/search?q=${enc(q)}&src=typed_query`,
    supports: ['text', 'email', 'image'], embeddable: false, priority: 1 }),
  p({ id: 'snapchat', name: 'Snapchat', category: 'social', color: '#FFFC00', icon: 'SC',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'snapchat.com')
      : `https://story.snapchat.com/search?q=${enc(q)}`,
    supports: ['text', 'image'], embeddable: false, priority: 2 }),
  p({ id: 'pinterest', name: 'Pinterest', category: 'social', color: '#E60023', icon: 'P',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'pinterest.com')
      : `https://www.pinterest.com/search/pins/?q=${enc(q)}`,
    supports: ['text', 'image', 'email'], embeddable: false, priority: 2 }),
  p({ id: 'linkedin', name: 'LinkedIn', category: 'social', color: '#0A66C2', icon: 'in',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'linkedin.com')
      : m === 'email' ? `https://www.linkedin.com/search/results/people/?keywords=${enc(q)}`
      : `https://www.linkedin.com/search/results/all/?keywords=${enc(q)}`,
    supports: ['text', 'email', 'phone', 'image'], embeddable: false, priority: 1 }),
  p({ id: 'reddit', name: 'Reddit', category: 'social', color: '#FF4500', icon: 'R',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'reddit.com')
      : `https://www.reddit.com/search/?q=${enc(q)}`,
    supports: ['text', 'email', 'image'], embeddable: true, priority: 1 }),
  p({ id: 'telegram', name: 'Telegram', category: 'social', color: '#0088CC', icon: 'TG',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 't.me')
      : m === 'phone' ? `https://t.me/+${enc(q.replace(/[^0-9]/g, ''))}`
      : `https://t.me/s/${enc(q)}`,
    supports: ['text', 'phone', 'image'], embeddable: true, priority: 2 }),
  p({ id: 'tumblr', name: 'Tumblr', category: 'social', color: '#36465D', icon: 'Tb',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'tumblr.com')
      : `https://www.tumblr.com/search/${enc(q)}`,
    supports: ['text', 'image'], embeddable: false, priority: 2 }),
  p({ id: 'quora', name: 'Quora', category: 'social', color: '#B92B27', icon: 'Q',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'quora.com')
      : `https://www.quora.com/search?q=${enc(q)}`,
    supports: ['text', 'image'], embeddable: false, priority: 2 }),
  p({ id: 'viber', name: 'Viber', category: 'social', color: '#7360F2', icon: 'VB',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'viber.com')
      : m === 'phone' ? `viber://chat?number=${enc(q.replace(/[^0-9]/g, ''))}`
      : `https://www.google.com/search?q=${enc('site:viber.com ' + q)}`,
    supports: ['phone', 'text', 'image'], embeddable: false, priority: 3 }),
  p({ id: 'flickr', name: 'Flickr', category: 'social', color: '#0063DC', icon: 'FL',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'flickr.com')
      : `https://www.flickr.com/search/?text=${enc(q)}`,
    supports: ['text', 'image'], embeddable: false, priority: 2 }),
  p({ id: 'discord', name: 'Discord', category: 'social', color: '#5865F2', icon: 'DC',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'discord.com')
      : `https://discord.com/channels/@me?query=${enc(q)}`,
    supports: ['text', 'image'], embeddable: false, priority: 2 }),
  p({ id: 'clubhouse', name: 'Clubhouse', category: 'social', color: '#FCE205', icon: 'CH',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'clubhouse.com')
      : `https://www.clubhouse.com/search/${enc(q)}`,
    supports: ['text', 'image'], embeddable: false, priority: 3 }),
  p({ id: 'badoo', name: 'Badoo', category: 'social', color: '#7B2BF9', icon: 'BD',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'badoo.com')
      : `https://badoo.com/search/?q=${enc(q)}`,
    supports: ['text', 'email', 'image'], embeddable: false, priority: 2 }),
  p({ id: 'meetup', name: 'Meetup', category: 'social', color: '#ED1C40', icon: 'MU',
    searchUrl: (q, m) => m === 'image' ? googleSiteImage(q, 'meetup.com')
      : `https://www.meetup.com/find/?keywords=${enc(q)}`,
    supports: ['text', 'image'], embeddable: false, priority: 2 }),
)

// ── DATING SITES (10) ──────────────────────────────────────────
const datingDomains: Array<[string, string, string]> = [
  ['eharmony', 'eHarmony', 'eharmony.com'],
  ['bumble', 'Bumble', 'bumble.com'],
  ['match', 'Match', 'match.com'],
  ['tinder', 'Tinder', 'tinder.com'],
  ['okcupid', 'OkCupid', 'okcupid.com'],
  ['hinge', 'Hinge', 'hinge.co'],
  ['zoosk', 'Zoosk', 'zoosk.com'],
  ['pof', 'Plenty of Fish', 'pof.com'],
  ['elitesingles', 'Elite Singles', 'elitesingles.com'],
  ['cmb', 'Coffee Meets Bagel', 'coffeemeetsbagel.com'],
]

for (const [id, name, domain] of datingDomains) {
  _platforms.push(
    p({
      id, name, category: 'dating', color: '#EC4899',
      icon: name.substring(0, 2).toUpperCase(),
      searchUrl: (q, m) => m === 'image'
        ? googleSiteImage(q, domain)
        : `https://www.google.com/search?q=${enc(`site:${domain} ${q}`)}`,
      supports: ['text', 'email', 'image'], embeddable: false, priority: 3,
    })
  )
}

// ── SEARCH ENGINES (49) ────────────────────────────────────────
// [id, name, urlBase, embeddable, priority, nativeReverseImage?]
const searchEngines: Array<[string, string, string, boolean, number, ((imgUrl: string) => string) | null]> = [
  ['google', 'Google', 'https://www.google.com/search?q=', true, 1, googleLens],
  ['bing', 'Bing', 'https://www.bing.com/search?q=', true, 1, bingVisual],
  ['yahoo', 'Yahoo!', 'https://search.yahoo.com/search?p=', true, 1, null],
  ['baidu', 'Baidu', 'https://www.baidu.com/s?wd=', true, 2, null],
  ['yandex', 'Yandex', 'https://yandex.com/search/?text=', true, 1, yandexImg],
  ['duckduckgo', 'DuckDuckGo', 'https://duckduckgo.com/?q=', true, 1, null],
  ['ask', 'Ask.com', 'https://www.ask.com/web?q=', false, 2, null],
  ['aol', 'AOL Search', 'https://search.aol.com/aol/search?q=', false, 2, null],
  ['wolframalpha', 'WolframAlpha', 'https://www.wolframalpha.com/input?i=', false, 2, null],
  ['startpage', 'StartPage', 'https://www.startpage.com/sp/search?query=', false, 2, null],
  ['qwant', 'Qwant', 'https://www.qwant.com/?q=', false, 2, null],
  ['ecosia', 'Ecosia', 'https://www.ecosia.org/search?q=', true, 2, null],
  ['dogpile', 'Dogpile', 'https://www.dogpile.com/serp?q=', false, 3, null],
  ['excite', 'Excite', 'https://results.excite.com/serp?q=', false, 3, null],
  ['lycos', 'Lycos', 'https://search.lycos.com/web/?q=', false, 3, null],
  ['gigablast', 'Gigablast', 'https://www.gigablast.com/search?q=', false, 3, null],
  ['mojeek', 'Mojeek', 'https://www.mojeek.com/search?q=', false, 2, null],
  ['searx', 'Searx', 'https://searx.be/search?q=', false, 2, null],
  ['metacrawler', 'MetaCrawler', 'https://www.metacrawler.com/serp?q=', false, 3, null],
  ['boardreader', 'Boardreader', 'https://boardreader.com/s/%s.html', false, 3, null],
  ['webcrawler', 'WebCrawler', 'https://www.webcrawler.com/serp?q=', false, 3, null],
  ['infocom', 'Info.com', 'https://www.info.com/serp?q=', false, 3, null],
  ['searchencrypt', 'Search Encrypt', 'https://www.searchencrypt.com/search/?eq=', false, 3, null],
  ['swisscows', 'Swisscows', 'https://swisscows.com/web?query=', false, 2, null],
  ['infinitysearch', 'Infinity Search', 'https://infinitysearch.com/?q=', false, 3, null],
  ['peekier', 'Peekier', 'https://peekier.com/#!', false, 3, null],
  ['gibiru', 'Gibiru', 'https://gibiru.com/results.html?q=', false, 3, null],
  ['disconnect', 'Disconnect Search', 'https://search.disconnect.me/searchTerms/search?query=', false, 3, null],
  ['oscobo', 'Oscobo', 'https://www.oscobo.com/search.php?q=', false, 3, null],
  ['yippy', 'Yippy', 'https://search.yippy.com/search?query=', false, 3, null],
  ['entireweb', 'Entireweb', 'https://www.entireweb.com/web?q=', false, 3, null],
  ['goodsearch', 'GoodSearch', 'https://www.goodsearch.com/search?q=', false, 3, null],
  ['hotbot', 'HotBot', 'https://www.hotbot.com/web?q=', false, 3, null],
  ['zapmeta', 'ZapMeta', 'https://www.zapmeta.com/search?q=', false, 3, null],
  ['clusty', 'Clusty', 'https://search.yippy.com/search?query=', false, 3, null],
  ['kartoo', 'KartOO', 'https://www.kartoo.com/search.php?q=', false, 3, null],
  ['vivisimo', 'Vivisimo', 'https://search.yippy.com/search?query=', false, 3, null],
  ['ixquick', 'Ixquick', 'https://www.startpage.com/sp/search?query=', false, 3, null],
  ['searchcom', 'Search.com', 'https://www.search.com/web?q=', false, 3, null],
  ['alltheweb', 'AllTheWeb', 'https://www.alltheinternet.com/?q=', false, 3, null],
  ['mahalo', 'Mahalo', 'https://www.google.com/search?q=site:mahalo.com+', false, 3, null],
  ['blekko', 'Blekko', 'https://blekko.com/ws/?q=', false, 3, null],
  ['chacha', 'ChaCha', 'https://www.google.com/search?q=site:chacha.com+', false, 3, null],
  ['wolframpro', 'WolframAlpha Pro', 'https://www.wolframalpha.com/input?i=', false, 2, null],
  ['ccsearch', 'Creative Commons Search', 'https://search.creativecommons.org/search?q=', false, 2, null],
  ['tineye', 'TinEye', 'https://tineye.com/search?url=', false, 1, tineyeUrl],
  ['cc', 'CC Search', 'https://ccsearch.creativecommons.org/search?q=', false, 2, null],
  ['shodan', 'Shodan', 'https://www.shodan.io/search?query=', false, 1, null],
  ['archiveorg', 'Archive.org', 'https://archive.org/search?query=', true, 1, null],
]

for (const [id, name, urlBase, embeddable, priority, reverseImgFn] of searchEngines) {
  const supports: SearchMode[] = reverseImgFn ? ['text', 'email', 'phone', 'image'] : ['text', 'email', 'phone']
  _platforms.push(
    p({
      id, name, category: 'search', color: '#4285F4',
      icon: name.substring(0, 2).toUpperCase(),
      searchUrl: (q, m) => {
        if (m === 'image' && reverseImgFn) return reverseImgFn(q)
        if (id === 'tineye') return `${urlBase}${enc(q)}`
        return `${urlBase}${enc(q)}`
      },
      supports, embeddable, priority,
    })
  )
}

// ── LISTING SITES (13) ─────────────────────────────────────────
const listingSites: Array<[string, string, string, number]> = [
  ['zillow', 'Zillow', 'zillow.com', 2],
  ['realtor', 'Realtor.com', 'realtor.com', 2],
  ['yelp', 'Yelp', 'yelp.com', 1],
  ['yp', 'Yellow Pages', 'yellowpages.com', 2],
  ['zoominfo', 'ZoomInfo', 'zoominfo.com', 2],
  ['houzz', 'Houzz', 'houzz.com', 3],
  ['tripadvisor', 'TripAdvisor', 'tripadvisor.com', 2],
  ['angi', 'Angi', 'angi.com', 2],
  ['trustpilot', 'Trustpilot', 'trustpilot.com', 2],
  ['foursquare', 'Foursquare', 'foursquare.com', 2],
  ['bbb', 'BBB', 'bbb.org', 2],
  ['craigslist', 'Craigslist', 'craigslist.org', 2],
  ['whitepages', 'Whitepages', 'whitepages.com', 1],
]

for (const [id, name, domain, priority] of listingSites) {
  const supports: SearchMode[] = id === 'whitepages' ? ['text', 'phone', 'email', 'image'] : ['text', 'phone', 'image']
  _platforms.push(
    p({
      id, name, category: 'listing', color: '#0EA5E9',
      icon: name.substring(0, 2).toUpperCase(),
      searchUrl: (q, m) => m === 'image'
        ? googleSiteImage(q, domain)
        : id === 'whitepages' ? `https://www.whitepages.com/name/${enc(q)}`
        : `https://www.google.com/search?q=${enc(`site:${domain} ${q}`)}`,
      supports, embeddable: false, priority,
    })
  )
}

// ── FREE LLM SEARCH SITES (8) ──────────────────────────────────
const llmSites: Array<[string, string, string, number]> = [
  ['grok-minitoolai', 'Grok (MiniToolAI)', 'https://www.minitoolai.com/grok/search?q=', 2],
  ['grok-english', 'Grok English', 'https://grok.com/search?q=', 1],
  ['aiforever', 'AIFreeForever', 'https://aifreeforever.com/search?q=', 3],
  ['duckai', 'Duck.ai', 'https://duck.ai/?q=', 2],
  ['perplexity', 'Perplexity.ai', 'https://www.perplexity.ai/search?q=', 1],
  ['copilot', 'Microsoft Copilot', 'https://copilot.microsoft.com/?q=', 2],
  ['gemini', 'Google Gemini', 'https://gemini.google.com/app?q=', 1],
  ['nvidia-nim', 'NVIDIA NIM Models', 'https://build.nvidia.com/search?q=', 3],
]

for (const [id, name, urlBase, priority] of llmSites) {
  _platforms.push(
    p({
      id, name, category: 'llm', color: '#8B5CF6',
      icon: name.substring(0, 2).toUpperCase(),
      searchUrl: (q) => `${urlBase}${enc(q)}`,
      supports: ['text', 'email', 'phone', 'image'],
      embeddable: false, priority,
    })
  )
}

export const PLATFORMS_FINAL: Platform[] = _platforms

// Category metadata
export const CATEGORIES: Record<string, { label: string; color: string; icon: string }> = {
  social: { label: 'Social Media', color: '#1877F2', icon: 'Users' },
  dating: { label: 'Dating Sites', color: '#EC4899', icon: 'Heart' },
  search: { label: 'Search Engines', color: '#4285F4', icon: 'Search' },
  listing: { label: 'Listing Sites', color: '#0EA5E9', icon: 'MapPin' },
  llm: { label: 'LLM Search', color: '#8B5CF6', icon: 'Brain' },
}

export function getPlatformById(id: string): Platform | undefined {
  return _platforms.find(p => p.id === id)
}

export function getPlatformsByCategory(cat: string): Platform[] {
  return _platforms.filter(p => p.category === cat)
}

export function getSupportedPlatforms(mode: SearchMode): Platform[] {
  return _platforms.filter(p => p.supports.includes(mode))
}
