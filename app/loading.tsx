export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050810]">
      <div className="flex items-center gap-2" aria-label="Loading">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c9a96a]"
            style={{ animationDelay: `${i * 220}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
