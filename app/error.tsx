'use client';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-6xl space-y-3 p-6">
      <h1 className="text-xl font-bold tracking-tight">页面出错</h1>
      <p className="text-sm text-muted-foreground">研究台未能完成这次渲染。没有写入任何数据。</p>
      <button
        type="button"
        onClick={reset}
        className="text-sm underline underline-offset-4"
      >
        重试
      </button>
    </main>
  );
}
