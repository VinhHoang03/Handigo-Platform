export type BookingStatusTone =
  | "completed"
  | "pending"
  | "cancelled"
  | "active";

export interface BookingListItem {
  id: string;
  serviceName: string;
  statusLabel: string;
  statusTone: BookingStatusTone;
  status?: string;
  schedule: string;
  meta: string;
  price: string;
  imageUrl?: string;
  primaryAction: string;
  secondaryAction?: string;
  rating?: string;
}
