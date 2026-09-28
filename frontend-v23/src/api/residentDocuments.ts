import { apiClient } from "./client";

export interface ResidentDocument { id:string; document_type:string; title:string; file_name:string; content_type:string; size_bytes:number; issued_on:string|null; expires_on:string|null; notes:string|null; created_at:string; }
const base=(o:string,e:string,r:string)=>`/organizations/${o}/establishments/${e}/residents/${r}/documents`;
export function listResidentDocuments(o:string,e:string,r:string,token:string):Promise<{documents:ResidentDocument[]}>{return apiClient.get(base(o,e,r),token);}
export function uploadResidentDocument(o:string,e:string,r:string,file:File,meta:{documentType:string;title:string;issuedOn?:string;expiresOn?:string;notes?:string},token:string):Promise<{document:ResidentDocument}>{const q=new URLSearchParams({documentType:meta.documentType,title:meta.title,fileName:file.name});if(meta.issuedOn)q.set("issuedOn",meta.issuedOn);if(meta.expiresOn)q.set("expiresOn",meta.expiresOn);if(meta.notes)q.set("notes",meta.notes);return apiClient.postBinary(`${base(o,e,r)}?${q.toString()}`,file,file.type||"application/octet-stream",token);}
export function getResidentDocumentDownload(o:string,e:string,r:string,d:string,token:string):Promise<{url:string}>{return apiClient.get(`${base(o,e,r)}/${d}/download`,token);}
