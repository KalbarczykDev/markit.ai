import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'

import { AccountBar, AccountProvider } from '@/account'

import appCss from '@/index.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#07090d' },
      { title: 'markit.ai | Live voice intelligence' },
      {
        name: 'description',
        content: 'A realtime voice conversation powered by live intelligence.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' },
    ],
  }),
  component: RootDocument,
})

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AccountProvider>
          <AccountBar />
          <Outlet />
        </AccountProvider>
        <Scripts />
      </body>
    </html>
  )
}
