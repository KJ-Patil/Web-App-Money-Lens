import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { Providers } from '@/components/providers/providers';
import NextTopLoader from 'nextjs-toploader';
import '@/app/globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'DhanBook - Personal Wealth Manager',
  description: 'Your Secure Personal Finance Companion',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Runs synchronously while the HTML is still parsing — before the first
          paint — so a returning dark-mode user never sees a flash of the light
          theme. Falls back to the OS setting until an explicit choice is saved.
          Keep the storage key in sync with THEME_STORAGE_KEY in themeProvider.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="dark"){document.documentElement.classList.add("dark")}document.documentElement.style.colorScheme=t}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NextTopLoader
          color="#2299DD"
          showSpinner={true}
          height={4}
          shadow="0 0 10px #2299DD,0 0 5px #2299DD"
          zIndex={9999}
          speed={200}
        />
        <Providers>
          {children}
        </Providers>
        <Toaster richColors position="top-right" closeButton duration={4000} expand={false} />
      </body>
    </html>
  );
}
