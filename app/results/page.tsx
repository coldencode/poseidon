import { Suspense } from "react";
import ResultsPageClient from "./ResultsPageClient";
export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string; pose?: string }>;
}) {
  const params = await searchParams;
  const target = params.target ?? params.pose;
  return (
    <Suspense fallback={<div className="min-h-screen p-8">Loading results…</div>}>
      <ResultsPageClient target={target} />
    </Suspense>
  );
}