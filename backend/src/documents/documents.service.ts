import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { DocumentType, Role } from '@prisma/client';
import { renderMedicalCertificate } from './templates/medical-certificate.template';
import { renderLabRequest } from './templates/lab-request.template';
import { renderPrescription } from './templates/prescription.template';
import { renderReferralLetter } from './templates/referral-letter.template';
import { randomUUID } from 'crypto';
import { GenerateDocumentDto } from './dto/generate-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  private async resolvePhysician(
    userId: string,
    physicianId: string | undefined,
    visitId: string | undefined,
  ) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (physicianId && uuidRegex.test(physicianId)) {
      const p = await this.prisma.user.findUnique({
        where: { id: physicianId },
      });
      if (!p || p.role !== Role.DOCTOR)
        throw new BadRequestException('physicianId must reference a doctor');
      return p;
    }
    if (userId && uuidRegex.test(userId)) {
      const requester = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (requester?.role === Role.DOCTOR) return requester;
    }
    if (visitId && uuidRegex.test(visitId)) {
      const visit = await this.prisma.visit.findUnique({
        where: { id: visitId },
        include: { physician: true },
      });
      if (visit) return visit.physician;
    }
    return null; // caller decides whether this is fatal
  }

  private async gatherData(
    patientId: string,
    type: DocumentType,
    visitId: string | undefined,
    userId: string,
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const physician = await this.resolvePhysician(userId, undefined, visitId);

    const data: Record<string, any> = { patient, physician };

    if (
      type === DocumentType.MEDICAL_CERTIFICATE ||
      type === DocumentType.REFERRAL_LETTER ||
      type === DocumentType.LAB_REQUEST
    ) {
      const latestNote = await this.prisma.initialNote.findFirst({
        where: { visit: { patientId }, status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
      });
      data.assessment = latestNote?.assessment ?? null;
      data.diagnostics = latestNote?.diagnostics ?? null;
      data.chiefComplaintDefault = latestNote?.chiefComplaint ?? '';
    }

    if (
      type === DocumentType.MEDICAL_CERTIFICATE ||
      type === DocumentType.REFERRAL_LETTER ||
      type === DocumentType.PRESCRIPTION
    ) {
      data.medications = await this.prisma.medication.findMany({
        where: { patientId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (type === DocumentType.MEDICAL_CERTIFICATE) {
      const latestVisit = await this.prisma.visit.findFirst({
        where: { patientId },
        orderBy: { visitDatetime: 'desc' },
      });
      data.latestVisitDate = latestVisit?.visitDatetime ?? null;
    }

    return data;
  }

  async buildDraft(
    patientId: string,
    type: DocumentType,
    visitId: string | undefined,
    userId: string,
  ) {
    // draft is generated with a system-level "viewer" — physician resolution here is best-effort;
    // pass patientId's most recent visit physician if no authenticated-doctor context is meaningful in a GET.
    const data = await this.gatherData(patientId, type, visitId, userId);
    const candidateDoctors = data.physician
      ? []
      : await this.prisma.user.findMany({
          where: { role: Role.DOCTOR, isActive: true },
          select: { id: true, firstName: true, lastName: true },
        });
    return { ...data, candidateDoctors };
  }

  async generate(patientId: string, dto: GenerateDocumentDto, userId: string) {
    const { type, visitId, physicianId } = dto;
    const data = await this.gatherData(patientId, type, visitId, userId);

    if (physicianId) {
      data.physician = await this.resolvePhysician(
        userId,
        physicianId,
        visitId,
      );
    }
    if (!data.physician) {
      throw new BadRequestException(
        'A physician must be specified for this document',
      );
    }

    if (type === DocumentType.MEDICAL_CERTIFICATE) {
      if (!dto.chiefComplaint || !dto.recommendation) {
        throw new BadRequestException(
          'chiefComplaint and recommendation are required for a Medical Certificate',
        );
      }
      data.chiefComplaint = dto.chiefComplaint;
      data.recommendation = dto.recommendation;
    }

    if (type === DocumentType.REFERRAL_LETTER) {
      if (!dto.referralRecipient || !dto.salientPoints || !dto.referralReason) {
        throw new BadRequestException(
          'referralRecipient, salientPoints, and referralReason are required for a Referral Letter',
        );
      }
      data.referralRecipient = dto.referralRecipient;
      data.salientPoints = dto.salientPoints;
      data.referralReason = dto.referralReason;
    }

    let buffer: Buffer;
    switch (type) {
      case DocumentType.MEDICAL_CERTIFICATE:
        buffer = await renderMedicalCertificate(data);
        break;
      case DocumentType.LAB_REQUEST:
        buffer = await renderLabRequest(data);
        break;
      case DocumentType.PRESCRIPTION:
        buffer = await renderPrescription(data);
        break;
      case DocumentType.REFERRAL_LETTER:
        buffer = await renderReferralLetter(data);
        break;
      default:
        throw new BadRequestException('Unknown document type');
    }

    const uuid = randomUUID();
    const path = `patients/${patientId}/documents/${uuid}.pdf`;
    const storageKey = await this.storageService.upload(
      path,
      buffer,
      'application/pdf',
    );

    return this.prisma.document.create({
      data: {
        patientId,
        visitId,
        documentType: type,
        storageKey,
        generatedBy: userId,
      },
    });
  }

  async findByPatient(patientId: string) {
    return this.prisma.document.findMany({
      where: { patientId },
      orderBy: { generatedAt: 'desc' },
      include: {
        generatedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });
  }

  async getDownloadUrl(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document?.storageKey)
      throw new NotFoundException('Document or storage file not found');
    return { url: await this.storageService.getSignedUrl(document.storageKey) };
  }

  async remove(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) throw new NotFoundException('Document not found');
    if (document.storageKey)
      await this.storageService.delete(document.storageKey);
    await this.prisma.document.delete({ where: { id } });
    return { success: true };
  }
}
