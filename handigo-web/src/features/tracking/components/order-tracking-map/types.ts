import type { LucideIcon } from "lucide-react";
import type { Order } from "@/types/booking";

export type Coordinate = {
  latitude: number;
  longitude: number;
  updatedAt?: string;
};

export type TrackingState = {
  customer: Coordinate | null;
  provider: Coordinate | null;
};

export type LocationEvent = Coordinate & {
  ownerType: "customer" | "provider";
};

export interface OrderTrackingMapProps {
  order: Order;
  viewerRole: "CUSTOMER" | "PROVIDER";
  compact?: boolean;
}

export type TrackingPointKey = "customer" | "provider";

export type TrackingPoint = {
  key: TrackingPointKey;
  label: string;
  shortLabel: string;
  color: string;
  accentColor: string;
  coordinate: Coordinate;
  displayText: string;
  updatedAtLabel: string;
  icon: LucideIcon;
};
