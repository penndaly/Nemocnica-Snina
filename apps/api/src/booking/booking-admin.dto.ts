/**
 * DTOs for the admin booking-management API (Sprint A4, Part B).
 * Status/payment are exposed as the prototype's lowercase vocabulary; the Prisma
 * enum (PENDING|CONFIRMED|CANCELLED|COMPLETED|NO_SHOW) is mapped at the edge.
 */
import { BookingStatus } from '@prisma/client';

export type BookingDtoStatus = 'pending' | 'booked' | 'cancelled' | 'completed' | 'no_show';
export type PaymentDtoStatus = 'free' | 'paid' | 'refunded' | 'pending';

/** Prisma enum → admin DTO status. */
export const STATUS_TO_DTO: Record<BookingStatus, BookingDtoStatus> = {
  PENDING: 'pending',
  CONFIRMED: 'booked',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
};

/** Admin DTO status → Prisma enum. */
export const DTO_TO_STATUS: Record<BookingDtoStatus, BookingStatus> = {
  pending: 'PENDING',
  booked: 'CONFIRMED',
  cancelled: 'CANCELLED',
  completed: 'COMPLETED',
  no_show: 'NO_SHOW',
};

export interface BookingAdminItemDto {
  id: string;
  patientTokenPreview: string; // opaque pseudonym — never the name/RC/phone
  clinicId: string;
  clinicName: string;
  physicianId?: string;
  physicianSlug?: string;
  slot: string; // ISO datetime
  durationMin: number;
  status: BookingDtoStatus;
  paymentStatus: PaymentDtoStatus;
  bookedAt: string;
  updatedAt: string;
}

export interface ListBookingsQuery {
  clinicId?: string;
  departmentId?: string;
  physicianId?: string;
  status?: BookingDtoStatus;
  date?: string;
  page?: number;
  limit?: number;
}

export interface CancelBookingDto {
  reason: string;
  notifyPatient?: boolean;
}

export interface RescheduleBookingDto {
  newSlotId: string;
  reason?: string;
}
