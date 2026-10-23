import { apiClient } from "./client";

export interface PlatformEstablishmentDocument {
  id: string;
  organization_id: string;
  organization_name: string;
  establishment_id: string;
  establishment_name: string;
  document_type: string;
  title: string;
  file_name: string;
  content_type: string;
  issued_on: string | null;
  expires_on: string | null;
  review_status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  review_reason: string | null;
  created_at: string;
}

export async function listPlatformEstablishmentDocuments(token: string) {
  const result = await apiClient.get<{ documents: PlatformEstablishmentDocument[] }>(
    "/platform/establishment-documents/verification-queue",
    token,
  );
  return result.documents;
}

export async function openPlatformEstablishmentDocument(id: string, token: string) {
  const result = await apiClient.get<{ url: string }>(
    `/platform/establishment-documents/${id}/download`,
    token,
  );
  return result.url;
}

export async function reviewPlatformEstablishmentDocument(
  id: string,
  status: "approved" | "rejected",
  reason: string,
  token: string,
) {
  return apiClient.patch(
    `/platform/establishment-documents/${id}/review`,
    { status, ...(reason.trim() ? { reason: reason.trim() } : {}) },
    token,
  );
}
