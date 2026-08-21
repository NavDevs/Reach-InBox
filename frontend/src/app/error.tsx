"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-black text-white p-6">
      <h2 className="text-xl font-bold text-red-500 mb-4">Something went wrong!</h2>
      <pre className="text-sm bg-gray-900 p-4 rounded text-left overflow-auto w-full max-w-2xl">{error.message}</pre>
      <button
        className="mt-4 px-4 py-2 bg-blue-600 rounded"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
