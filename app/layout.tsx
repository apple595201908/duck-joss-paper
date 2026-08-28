import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '鴨鴨喝牛奶｜60 秒節奏遊戲',
  description: '按住喝一口、放開吞下去！在 60 秒內幫原創鴨鴨喝完牛奶，又別喝得太急。',
  applicationName: '鴨鴨喝牛奶',
  openGraph: {
    title: '鴨鴨喝牛奶｜60 秒節奏挑戰',
    description: '按住喝一口、放開吞下去。喝快一點，但別讓鴨鴨嗆到！',
    type: 'website',
    locale: 'zh_TW',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: '鴨鴨喝牛奶 60 秒節奏挑戰' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '鴨鴨喝牛奶｜60 秒節奏挑戰',
    description: '按住喝一口、放開吞下去。喝快一點，但別讓鴨鴨嗆到！',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
