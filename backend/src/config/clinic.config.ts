export const clinicConfig = {
  name: process.env.CLINIC_NAME ?? 'Metro Health Clinic & Diagnostic Center',
  addressLine1:
    process.env.CLINIC_ADDRESS_LINE1 ??
    'Unit 405, Medical Arts Building, St. Jude General Hospital',
  addressLine2:
    process.env.CLINIC_ADDRESS_LINE2 ??
    '456 Taft Avenue, Ermita, Manila, Philippines',
  tel: process.env.CLINIC_TEL ?? '(02) 8123-4567',
  email: process.env.CLINIC_EMAIL ?? 'contact@metrohealthclinic.ph',
};
