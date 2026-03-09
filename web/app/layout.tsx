import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Forecast Platform - 可视化接口测试',
  description: '预测平台 API 可视化测试',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
