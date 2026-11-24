import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
export type EmployeeFile={bytes:Buffer;fileName:string;contentType:string};
const signatures=[
  ['application/pdf',Buffer.from('%PDF-')],
  ['image/jpeg',Buffer.from([0xff,0xd8,0xff])],
  ['image/png',Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])],
] as const;
export const documentTypes=['cv','nid_copy','appointment_letter','other'];
export function employeeFile(fileName:string,bytes:Buffer):EmployeeFile {
  const signature=signatures.find(([,letter])=>letter.equals(bytes.subarray(0,letter.length)));
  if (!signature || bytes.length>5*1024*1024) throw new BadRequestException('Upload a PDF, JPEG, or PNG up to 5 MiB');
  return {bytes,fileName:fileName.replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,200)||randomUUID(),contentType:signature[0]};
}
