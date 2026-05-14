import { defineConfig, passthroughImageService } from 'astro/config'

import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import icon from 'astro-icon'

import { rehypeHeadingIds } from '@astrojs/markdown-remark'
import rehypeExpressiveCode from 'rehype-expressive-code'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeKatex from 'rehype-katex'
import rehypeShiki from '@shikijs/rehype'
import remarkEmoji from 'remark-emoji'
import remarkMath from 'remark-math'
import { visit } from 'unist-util-visit'

function meaningfulChildren(node: any) {
  return node.children.filter(
    (c: any) => !(c.type === 'text' && !c.value.trim()),
  )
}

function rehypeImageFigure() {
  return (tree: any) => {
    visit(tree, (node: any) => {
      if (!node.children || !Array.isArray(node.children)) return
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        if (child.type !== 'element' || child.tagName !== 'p') continue
        const meaningful = meaningfulChildren(child)
        if (
          meaningful.length === 2 &&
          meaningful[0].type === 'element' &&
          meaningful[0].tagName === 'img' &&
          meaningful[1].type === 'element' &&
          meaningful[1].tagName === 'em'
        ) {
          const [img, em] = meaningful
          node.children[i] = {
            type: 'element',
            tagName: 'figure',
            properties: { className: ['post-figure'] },
            children: [
              img,
              {
                type: 'element',
                tagName: 'figcaption',
                properties: {},
                children: em.children,
              },
            ],
          }
        }
      }
    })
  }
}

function isEmOnlyParagraph(node: any) {
  if (!node || node.type !== 'element' || node.tagName !== 'p') return false
  const meaningful = node.children.filter(
    (c: any) => !(c.type === 'text' && !c.value.trim()),
  )
  return (
    meaningful.length === 1 &&
    meaningful[0].type === 'element' &&
    meaningful[0].tagName === 'em'
  )
}

function findFrameFigure(div: any): any {
  if (!div || div.type !== 'element' || !Array.isArray(div.children)) return null
  return div.children.find(
    (c: any) =>
      c.type === 'element' &&
      c.tagName === 'figure' &&
      Array.isArray(c.properties?.className) &&
      c.properties.className.includes('frame'),
  )
}

function rehypeCodeFigure() {
  return (tree: any) => {
    visit(tree, (node: any) => {
      if (!node.children || !Array.isArray(node.children)) return
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        let figure = null
        if (
          child.type === 'element' &&
          child.tagName === 'figure' &&
          Array.isArray(child.properties?.className) &&
          child.properties.className.includes('frame')
        ) {
          figure = child
        } else if (
          child.type === 'element' &&
          child.tagName === 'div'
        ) {
          figure = findFrameFigure(child)
        }
        if (!figure) continue

        let j = i + 1
        while (
          j < node.children.length &&
          node.children[j].type === 'text' &&
          !node.children[j].value.trim()
        ) {
          j++
        }
        if (j >= node.children.length) continue
        const next = node.children[j]
        if (!isEmOnlyParagraph(next)) continue
        const em = next.children.find(
          (c: any) => c.type === 'element' && c.tagName === 'em',
        )
        figure.children.push({
          type: 'element',
          tagName: 'figcaption',
          properties: { className: ['post-code-caption'] },
          children: em.children,
        })
        node.children.splice(j, 1)
      }
    })
  }
}

import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections'
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers'
import type { ExpressiveCodeTheme } from 'rehype-expressive-code'

import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://blog.lourcode.kr',
  image: {
    service: passthroughImageService(),
  },
  integrations: [mdx(), react(), sitemap(), icon()],
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    port: 1234,
    host: true,
  },
  devToolbar: {
    enabled: false,
  },
  markdown: {
    syntaxHighlight: false,
    rehypePlugins: [
      [
        rehypeExternalLinks,
        {
          target: '_blank',
          rel: ['nofollow', 'noreferrer', 'noopener'],
        },
      ],
      rehypeHeadingIds,
      rehypeImageFigure,
      rehypeKatex,
      [
        rehypeExpressiveCode,
        {
          themes: ['github-light', 'github-dark'],
          plugins: [pluginCollapsibleSections(), pluginLineNumbers()],
          useDarkModeMediaQuery: false,
          themeCssSelector: (theme: ExpressiveCodeTheme) =>
            `[data-theme="${theme.name.split('-')[1]}"]`,
          defaultProps: {
            wrap: true,
            collapseStyle: 'collapsible-auto',
            overridesByLang: {
              'ansi,bat,bash,batch,cmd,console,powershell,ps,ps1,psd1,psm1,sh,shell,shellscript,shellsession,text,zsh':
                {
                  showLineNumbers: false,
                },
            },
          },
          styleOverrides: {
            codeFontSize: '0.75rem',
            borderColor: 'var(--border)',
            codeFontFamily: 'var(--font-mono)',
            codeBackground:
              'color-mix(in oklab, var(--muted) 25%, transparent)',
            frames: {
              editorActiveTabForeground: 'var(--muted-foreground)',
              editorActiveTabBackground:
                'color-mix(in oklab, var(--muted) 25%, transparent)',
              editorActiveTabIndicatorBottomColor: 'transparent',
              editorActiveTabIndicatorTopColor: 'transparent',
              editorTabBorderRadius: '0',
              editorTabBarBackground: 'transparent',
              editorTabBarBorderBottomColor: 'transparent',
              frameBoxShadowCssValue: 'none',
              terminalBackground:
                'color-mix(in oklab, var(--muted) 25%, transparent)',
              terminalTitlebarBackground: 'transparent',
              terminalTitlebarBorderBottomColor: 'transparent',
              terminalTitlebarForeground: 'var(--muted-foreground)',
            },
            lineNumbers: {
              foreground: 'var(--muted-foreground)',
            },
            uiFontFamily: 'var(--font-sans)',
          },
        },
      ],
      [
        rehypeShiki,
        {
          themes: {
            light: 'github-light',
            dark: 'github-dark',
          },
          inline: 'tailing-curly-colon',
        },
      ],
      rehypeCodeFigure,
    ],
    remarkPlugins: [remarkMath, remarkEmoji],
  },
})
