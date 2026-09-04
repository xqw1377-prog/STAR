import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-6xl space-y-3 p-6">
      <h1 className="text-xl font-bold tracking-tight">页面不存在</h1>
      <p className="text-sm text-muted-foreground">没有这条路由。研究台没有创建或删除任何数据。</p>
      <Link href="/" className="text-sm underline underline-offset-4">
        回到研究台
      </Link>
    </main>
  );
}
