import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://duck-milk-rhythm.yoyo50582.chatgpt.site'),
  title: '鴨鴨喝牛奶｜60 秒節奏遊戲',
  description: '快速連點讓原創鴨鴨喝完牛奶，掌握約 20 秒的節奏，又別喝得太急。',
  applicationName: '鴨鴨喝牛奶',
  openGraph: {
    title: '鴨鴨喝牛奶｜60 秒節奏挑戰',
    description: '快速連點喝牛奶，挑戰約 20 秒喝完，但別讓鴨鴨嗆到！',
    type: 'website',
    locale: 'zh_TW',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: '鴨鴨喝牛奶 60 秒節奏挑戰' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '鴨鴨喝牛奶｜60 秒節奏挑戰',
    description: '快速連點喝牛奶，挑戰約 20 秒喝完，但別讓鴨鴨嗆到！',
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
