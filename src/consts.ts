import type { IconMap, SocialLink, Site } from '@/types'

export const SITE: Site = {
  title: 'LOURCODE.KR',
  description:
    'I specialize in offensive cybersecurity research. I am also interested in software vulnerability analysis such as IoT, iOS, Windows, and open source software.',
  href: 'https://blog.lourcode.kr',
  author: 'LOURCODE',
  locale: 'ko-KR',
  featuredPostCount: 2,
  postsPerPage: 10,
}

export const NAV_LINKS: SocialLink[] = [
  {
    href: '/posts',
    label: 'blog',
  },
  {
    href: '/about',
    label: 'about',
  },
]

export const SOCIAL_LINKS: SocialLink[] = [
  {
    href: 'https://github.com/LOURC0D3',
    label: 'GitHub',
  },
  {
    href: 'mailto:lourcode@gmail.com',
    label: 'Email',
  },
  {
    href: '/rss.xml',
    label: 'RSS',
  },
]

export const ICON_MAP: IconMap = {
  Website: 'lucide:globe',
  GitHub: 'lucide:github',
  LinkedIn: 'lucide:linkedin',
  Twitter: 'lucide:twitter',
  Email: 'lucide:mail',
  RSS: 'lucide:rss',
}
