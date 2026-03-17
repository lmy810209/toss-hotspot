import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Toss Hotspot - 실시간 핫플레이스 혼잡도',
  description: '지금 가장 핫한 곳의 혼잡도를 실시간으로 확인하고 제보하세요.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-primary selection:text-white">
        {children}
      </body>
    </html>
  );
}
