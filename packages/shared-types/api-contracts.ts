/**
 * BYK RoadRescue — REST API Contracts / DTOs
 * Shared package: packages/shared-types. Imported by apps/web and services/*.
 * Convention: request DTOs end in `Request`, responses in `Response` or `Dto`.
 */

/** ---------- Enums shared across DTOs ---------- */

export type VehicleType = 'car' | 'bike' | 'ev' | 'commercial';
export type ServiceCategory =
  | 'towing' | 'jumpstart' | 'puncture' | 'fuel_delivery' | 'lockout'
  | 'minor_repair' | 'accident_emergency';

export type JobStatus =
  | 'requested' | 'matched' | 'en_route' | 'arrived' | 'in_progress'
  | 'completed' | 'completed_payment_pending' | 'cancelled' | 'reassigning';

export type PaymentMethod = 'upi' | 'card' | 'cash';
export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded';

/** ---------- POST /api/jobs — Create a rescue request ---------- */

export interface CreateJobRequest {
  idempotencyKey: string;      // client-generated UUID, prevents double-submit duplicates
  customerId: string;
  vehicleType: VehicleType;
  serviceCategory: ServiceCategory;
  location: {
    lat: number;
    lng: number;
    source: 'gps' | 'manual_pin' | 'address_search';
    accuracyM?: number;
  };
  notes?: string;
  fleetContractId?: string;    // present for B2B jobs, drives SLA tier lookup
}

export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
  slaDeadline: string;         // ISO 8601 — fixed at creation, never shifts on reassignment
  estimatedSearchRadiusM: number;
}

/** ---------- GET /api/jobs/:jobId — Snapshot (used by fallback polling too) ---------- */

export interface JobDetailResponse {
  jobId: string;
  status: JobStatus;
  serviceCategory: ServiceCategory;
  vehicleType: VehicleType;
  customer: { id: string; name: string; phone: string };
  technician: {
    id: string; name: string; phone: string; rating: number; vehiclePlate: string;
    lat: number | null; lng: number | null;
  } | null;
  etaSeconds: number | null;
  slaDeadline: string;
  createdAt: string;
  updatedAt: string;
  payment: { method: PaymentMethod; status: PaymentStatus; amountPaise: number } | null;
  statusHistory: Array<{
    fromStatus: JobStatus | null;
    toStatus: JobStatus;
    changedBy: 'customer' | 'technician' | 'dispatcher' | 'system';
    at: string;
  }>;
}

/** ---------- POST /api/jobs/:jobId/offers/:offerId/respond — Technician accept/reject ---------- */

export interface RespondToOfferRequest {
  technicianId: string;
  response: 'accept' | 'reject';
  rejectReason?: 'too_far' | 'wrong_vehicle_type' | 'off_shift' | 'other';
}

export interface RespondToOfferResponse {
  accepted: boolean;
  jobId: string;
  /** If rejected/expired, the offer has already been re-routed server-side;
   * this tells the technician client not to keep showing the stale offer. */
  offerStillValid: boolean;
}

/** ---------- POST /api/jobs/:jobId/complete — OTP-gated completion ---------- */

export interface CompleteJobRequest {
  technicianId: string;
  otp: string;
  paymentMethod: PaymentMethod;
  /** Required when paymentMethod === 'cash' — both-party confirmation, see edge cases doc */
  cashConfirmedByCustomer?: boolean;
}

export interface CompleteJobResponse {
  jobId: string;
  status: JobStatus;              // 'completed' or 'completed_payment_pending'
  invoiceUrl: string | null;
}

/** ---------- POST /api/jobs/:jobId/reassign — Dispatcher manual override ---------- */

export interface ReassignJobRequest {
  dispatcherId: string;
  newTechnicianId: string;
  reason: string;
  /** Optimistic-concurrency guard — see "two dispatchers assign simultaneously" edge case */
  expectedJobVersion: number;
}

export interface ReassignJobResponse {
  jobId: string;
  jobVersion: number;
  technicianId: string;
}

/** ---------- Error envelope (all endpoints) ---------- */

export interface ApiErrorResponse {
  code:
    | 'VALIDATION_ERROR'
    | 'IDEMPOTENCY_CONFLICT'
    | 'JOB_VERSION_CONFLICT'      // 409 — someone else already assigned/mutated this job
    | 'OFFER_EXPIRED'
    | 'OTP_INVALID'
    | 'PAYMENT_PROVIDER_UNAVAILABLE'
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'RATE_LIMITED'
    | 'INTERNAL_ERROR';
  message: string;
  requestId: string;              // correlates client error toast with server logs
  retryable: boolean;
}
