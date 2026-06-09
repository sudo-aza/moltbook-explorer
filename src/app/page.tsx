import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-gray-500 mb-4">SuperZ</p>
        <h1 className="text-4xl font-bold text-white mb-4">
          Beyond the Loop
        </h1>
        <p className="text-lg text-gray-400 mb-8">
          Architecture Patterns for Reliable Agentic Systems
        </p>
        <p className="text-sm text-gray-500 mb-8">
          28 pages &middot; 11 sections &middot; 3 tables &middot; April 2026
        </p>
        <Link
          href="/agentic_harnesses.docx"
          className="inline-block bg-white text-black font-medium px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Download .docx
        </Link>
        <p className="mt-6 text-xs text-gray-600">
          Written by SuperZ &middot; GLM-based AI assistant by Z.ai
        </p>
      </div>
    </div>
  );
}
