import { useEffect, useRef, useState } from "react";

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

const getRecognition = () => {
  if (typeof window === "undefined") return undefined;
  const browser = window as SpeechWindow;
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
};

export function useVoiceInput(disabled: boolean, maxLength: number, onText: (text: string) => void) {
  const [supported] = useState(() => Boolean(getRecognition()));
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);

  const cancel = () => {
    const current = recognition.current;
    recognition.current = null;
    if (current) {
      current.onresult = null;
      current.onerror = null;
      current.onend = null;
      current.abort();
    }
    setListening(false);
    setError("");
  };

  useEffect(() => {
    if (disabled && recognition.current) {
      recognition.current.onresult = null;
      recognition.current.abort();
    }
  }, [disabled]);

  useEffect(() => () => {
    const current = recognition.current;
    if (current) {
      current.onresult = null;
      current.onerror = null;
      current.onend = null;
      current.abort();
      recognition.current = null;
    }
  }, []);

  const toggle = (draft: string) => {
    if (disabled) return;
    if (recognition.current) {
      recognition.current.stop();
      return;
    }
    const Constructor = getRecognition();
    if (!Constructor) {
      setError("Trình duyệt chưa hỗ trợ nhập giọng nói. Bạn vẫn có thể nhập bằng bàn phím.");
      return;
    }
    if (!window.isSecureContext) {
      setError("Nhập giọng nói cần kết nối HTTPS hoặc localhost.");
      return;
    }
    setError("");
    try {
      const current = new Constructor();
      recognition.current = current;
      current.lang = "vi-VN";
      current.continuous = false;
      current.interimResults = false;
      current.onresult = (event) => {
        if (recognition.current !== current) return;
        const transcript = Array.from(event.results)
          .filter((result) => result.isFinal).map((result) => result[0].transcript.trim()).join(" ");
        if (!transcript) return;
        const text = [draft.trimEnd(), transcript].filter(Boolean).join(" ");
        onText(text.slice(0, maxLength));
        if (text.length > maxLength) setError(`Nội dung đã đạt giới hạn ${maxLength} ký tự. Vui lòng kiểm tra trước khi gửi.`);
      };
      current.onerror = (event) => {
        if (recognition.current !== current || event.error === "aborted") return;
        const messages: Record<string, string> = {
          "not-allowed": "Chưa có quyền micro. Hãy cho phép micro trong cài đặt trang rồi thử lại.",
          "service-not-allowed": "Trình duyệt không cho phép dịch vụ nhận dạng giọng nói. Vui lòng nhập bằng bàn phím.",
          "audio-capture": "Không truy cập được micro. Hãy kiểm tra thiết bị và thử lại.",
          "no-speech": "Chưa nghe rõ lời nói. Nhấn micro để thử lại.",
          network: "Không kết nối được dịch vụ nhận dạng giọng nói. Hãy kiểm tra mạng và thử lại.",
          "language-not-supported": "Trình duyệt chưa hỗ trợ nhận dạng tiếng Việt. Vui lòng nhập bằng bàn phím.",
        };
        setError(messages[event.error] ?? "Không nhận dạng được giọng nói. Bạn có thể thử lại hoặc nhập bằng bàn phím.");
      };
      current.onend = () => {
        if (recognition.current !== current) return;
        recognition.current = null;
        setListening(false);
      };
      current.start();
      setListening(true);
    } catch {
      cancel();
      setError("Không khởi động được micro. Vui lòng kiểm tra quyền truy cập và thử lại.");
    }
  };

  return { supported, listening, error, toggle, cancel };
}
