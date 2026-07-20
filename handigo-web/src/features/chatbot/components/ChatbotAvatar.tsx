export function ChatbotAvatar({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="chatbot-avatar-bg" x1="5" y1="3" x2="43" y2="46">
          <stop stopColor="#6D64F2" />
          <stop offset="1" stopColor="#2820A7" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#chatbot-avatar-bg)" />
      <path
        d="M24 7v5m-2.5-6.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z"
        fill="none"
        stroke="#D9F9FF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="7" y="12" width="34" height="29" rx="10" fill="#FFFFFF" />
      <rect x="10" y="15" width="28" height="20" rx="7" fill="#E9EBFF" />
      <circle cx="18" cy="25" r="3" fill="#3525CD" />
      <circle cx="30" cy="25" r="3" fill="#3525CD" />
      <path
        d="M18 32c1.7 1.4 3.7 2 6 2s4.3-.6 6-2"
        fill="none"
        stroke="#00687A"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M7 23H4v8h3m34-8h3v8h-3"
        fill="#57DFFE"
        stroke="#D9F9FF"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
