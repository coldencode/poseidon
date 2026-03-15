import { Suspense } from "react";
import ResultsPageClient from "./ResultsPageClient";
export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string }>;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={<div className="min-h-screen p-8">Loading results…</div>}>
      <ResultsPageClient target={params.target} />
    </Suspense>
  );
}