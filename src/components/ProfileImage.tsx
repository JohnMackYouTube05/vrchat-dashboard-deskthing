import { useState } from 'react';

export default function ProfileImage({ sources, name, className }: { sources: (string | undefined)[]; name: string; className: string }) {
  const [failed, setFailed] = useState<string[]>([]);
  const source = sources.find(url => url?.trim() && !failed.includes(url));
  if (!source) {
    return (
      <div className={`${className} bg-slate-700 flex items-center justify-center`} role="img" aria-label={`${name}'s profile image unavailable`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-1/2 h-1/2 text-slate-300" aria-hidden="true">
          <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 3-9 7v1h18v-1c0-4-4-7-9-7z" />
        </svg>
      </div>
    );
  }
  return <img src={source} alt={`${name}'s profile`} className={className}
    onError={() => setFailed(previous => [...previous, source])} />;
}
