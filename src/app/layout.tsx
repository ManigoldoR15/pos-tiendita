import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { ThemeProvider } from '@/components/theme-provider'
import { createServiceClient } from '@/lib/supabase/service'
import { unstable_noStore as noStore } from 'next/cache'
import SeasonalDecor from '@/components/seasonal-decor'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'POS Tiendita',
  description: 'Punto de venta para tu negocio',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  noStore() // el tema puede cambiar en cualquier momento — no cachear este layout
  const locale = await getLocale()
  const messages = await getMessages()

  // Load active seasonal theme (public table, no auth needed)
  const admin = createServiceClient()
  const { data: tema } = await admin
    .from('temas_estacionales')
    .select('slug, css_vars')
    .eq('activo', true)
    .neq('slug', 'default')
    .maybeSingle()

  const temaSlug = tema?.slug ?? null
  const cssVars = tema?.css_vars as Record<string, string> | null
  // Sanitize CSS property names and values before injecting into <style>.
  // Only allow characters valid in CSS custom property declarations.
  // This prevents XSS even if the superadmin account is compromised.
  const safeCSSToken = (s: string) => s.replace(/[^a-zA-Z0-9#%.,\- _()/:]/g, '')
  const temaStyle = cssVars && Object.keys(cssVars).length > 0
    ? Object.entries(cssVars)
        .filter(([k]) => k.startsWith('--'))
        .map(([k, v]) => `${safeCSSToken(k)}:${safeCSSToken(v)}`)
        .join(';')
    : null

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {temaStyle && (
          <style dangerouslySetInnerHTML={{ __html: `:root{${temaStyle}}html.dark{${temaStyle}}` }} />
        )}
      </head>
      <body className="min-h-full flex flex-col">
        {/* Anti-flash: apply saved theme before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        <SeasonalDecor slug={temaSlug} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
