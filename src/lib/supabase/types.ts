// Mirrors supabase/schema.sql's `jobs` table. If you add a column there,
// add it here too — nothing generates this automatically yet (Supabase can
// do that later via `supabase gen types typescript`, once the CLI is wired
// into this project).

export type VehicleType = 'car' | 'bike' | 'ev' | 'commercial';

export type ServiceCategory =
  | 'towing' | 'jumpstart' | 'puncture' | 'fuel_delivery' | 'lockout'
  | 'minor_repair' | 'accident_emergency';

export type JobPriority = 'emergency' | 'standard' | 'fleet_contract';

export type JobRowStatus =
  | 'requested' | 'matched' | 'en_route' | 'arrived' | 'in_progress'
  | 'completed' | 'cancelled';

export interface JobRow {
  id: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_phone: string;
  vehicle_type: VehicleType;
  service_category: ServiceCategory;
  priority: JobPriority;
  status: JobRowStatus;
  lat: number;
  lng: number;
  notes: string | null;
  technician_name: string | null;
  sla_deadline: string;
}

export type NewJobInput = Omit<JobRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'technician_name'> & {
  status?: JobRowStatus;
  technician_name?: string | null;
};

const SLA_MINUTES_BY_PRIORITY: Record<JobPriority, number> = {
  emergency: 5,
  standard: 15,
  fleet_contract: 20,
};

export function computeSlaDeadline(priority: JobPriority, from: Date = new Date()): string {
  return new Date(from.getTime() + SLA_MINUTES_BY_PRIORITY[priority] * 60_000).toISOString();
}
