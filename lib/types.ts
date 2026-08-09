export type Clinic = {
  id: string;
  doctor_name: string;
  clinic_name: string;
  email: string;
  phone: string;
  avg_time_per_patient: number;
  current_token: number;
  consultation_fee: number;
  clinic_hours: string;
  google_review_link: string | null;
  whatsapp_number: string | null;
  razorpay_subscription_id: string | null;
  cashfree_order_id: string | null;
  cashfree_subscription_id: string | null;
  phone_normalized: string | null;
  subscription_expires_at: string | null;
  trial_started_at: string | null;
  subscription_status: string;
  trial_ends_at: string | null;
  created_at: string;
};

export type Token = {
  id: string;
  clinic_id: string;
  token_number: number;
  queue_position: number;
  status: "waiting" | "called" | "completed";
  patient_phone: string | null;
  patient_name: string | null;
  is_emergency: boolean;
  is_late: boolean;
  review_sent: boolean;
  confirmed_at: string | null;
  estimated_call_at: string | null;
  completed_at: string | null;
  late_shift_count: number;
  confirmation_sent: boolean;
  created_at: string;
};

/** @deprecated Use Token */
export type QueueEntry = Token;

export type ClinicRegistrationInput = {
  doctor_name: string;
  clinic_name: string;
  email: string;
  phone: string;
  avg_time_per_patient: number;
  consultation_fee?: number;
  clinic_hours?: string;
  google_review_link?: string;
};

export type LiveTrackerData = {
  entry: Token;
  clinic: Clinic;
  currentToken: number;
  positionInQueue: number;
  estimatedWaitMinutes: number;
};

export type WhatsAppWebhookMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
};
