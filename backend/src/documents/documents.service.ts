import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { DocumentType, Role } from '@prisma/client';
import { renderMedicalCertificate } from './templates/medical-certificate.template';
import { renderLabRequest } from './templates/lab-request.template';
import { renderPrescription } from './templates/prescription.template';
import { renderChargeSlip } from './templates/charge-slip.template';
import { randomUUID } from 'crypto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async generate(patientId: string, type: DocumentType, visitId: string | undefined, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (type === DocumentType.CHARGE_SLIP && user?.role === Role.DOCTOR) {
      throw new ForbiddenException('Doctors are not allowed to generate charge slips');
    }

    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    let data: any = { patient };

    if (type === DocumentType.MEDICAL_CERTIFICATE) {
      const latestNote = await this.prisma.initialNote.findFirst({
        where: { visit: { patientId }, status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' }
      });
      data.assessment = latestNote?.assessment || null;
    } else if (type === DocumentType.LAB_REQUEST) {
      const activeNote = await this.prisma.initialNote.findFirst({
        where: { visit: { patientId } },
        orderBy: { createdAt: 'desc' }
      });
      data.diagnostics = activeNote?.diagnostics || null;
    } else if (type === DocumentType.PRESCRIPTION) {
      const medications = await this.prisma.medication.findMany({
        where: { patientId, isActive: true }
      });
      data.medications = medications;
    } else if (type === DocumentType.CHARGE_SLIP) {
      if (visitId) {
        const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
        data.visit = visit;
      }
      const problems = await this.prisma.problem.findMany({ where: { patientId } });
      data.problems = problems;
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
      case DocumentType.CHARGE_SLIP:
        buffer = await renderChargeSlip(data);
        break;
      default:
        throw new BadRequestException('Unknown document type');
    }

    const uuid = randomUUID();
    const path = `patients/${patientId}/documents/${uuid}.pdf`;
    const storageKey = await this.storageService.upload(path, buffer, 'application/pdf');

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
        generatedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
      }
    });
  }

  async getDownloadUrl(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document || !document.storageKey) {
      throw new NotFoundException('Document or storage file not found');
    }
    return { url: await this.storageService.getSignedUrl(document.storageKey) };
  }

  async remove(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.storageKey) {
      await this.storageService.delete(document.storageKey);
    }

    await this.prisma.document.delete({ where: { id } });
    return { success: true };
  }
}

import { BadRequestException } from '@nestjs/common';
