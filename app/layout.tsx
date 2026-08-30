import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://duck-joss-paper.yoyo50582.chatgpt.site'),
  title: '鴨鴨燒紙錢｜中元普渡限定節奏遊戲',
  description: '快速連點把金紙投入金爐，抓準約 20 秒的節奏，小心丟太快讓金爐發爐！',
  applicationName: '鴨鴨燒紙錢',
  openGraph: {
    title: '鴨鴨燒紙錢｜中元普渡限定挑戰',
    description: '快速連點燒完金紙，挑戰約 20 秒完成，但別讓金爐發爐！',
    type: 'website',
    locale: 'zh_TW',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: '鴨鴨燒紙錢 中元普渡限定節奏挑戰' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '鴨鴨燒紙錢｜中元普渡限定挑戰',
    description: '快速連點燒完金紙，挑戰約 20 秒完成，但別讓金爐發爐！',
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
