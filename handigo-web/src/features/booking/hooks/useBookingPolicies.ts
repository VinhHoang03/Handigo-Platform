import { useEffect, useState } from 'react';
import { bookingApi } from '../api/booking.api';
import type { BookingPolicies } from '../types/bookingPolicy.types';

export function useBookingPolicies(bookingFingerprint: string) {
  const [policies, setPolicies] = useState<BookingPolicies | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [acceptedBooking, setAcceptedBooking] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      bookingApi.getBookingPolicies().then((data) => {
        if (active) setPolicies(data);
      }).catch(() => {
        if (active) setError('Không thể tải chính sách Handigo. Vui lòng thử lại trước khi đặt đơn.');
      }).finally(() => {
        if (active) setLoading(false);
      });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [attempt]);

  return {
    policies, loading, error,
    accepted: Boolean(policies && !loading && !error && acceptedBooking === bookingFingerprint),
    setAccepted: (accepted: boolean) => setAcceptedBooking(accepted && policies && !loading && !error ? bookingFingerprint : null),
    retry: () => {
      setPolicies(null);
      setAcceptedBooking(null);
      setError('');
      setLoading(true);
      setAttempt((value) => value + 1);
    },
  };
}
