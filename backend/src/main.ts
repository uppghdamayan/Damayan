import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─────────────────────────────────────────────
  // CORS
  // ─────────────────────────────────────────────
  const frontendUrls = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: frontendUrls,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ─────────────────────────────────────────────
  // GLOBAL VALIDATION PIPE
  // ─────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not declared in DTO
      forbidNonWhitelisted: true, // Throw 400 if unknown properties are sent
      transform: true, // Auto-transform payload to DTO class instance
      transformOptions: {
        enableImplicitConversion: true, // Convert query string types automatically
      },
    }),
  );

  // ─────────────────────────────────────────────
  // SWAGGER
  // ─────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('DAMAYAN EMR API')
    .setDescription(
      'Problem-Oriented EMR System for Philippine Clinical Settings',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your Supabase JWT access token',
      },
      'access_token',
    )
    .addTag('Auth', 'User authentication and provisioning')
    .addTag('Accounts', 'Admin-only user account management')
    .addTag('Patients', 'Patient management')
    .addTag('Visits', 'Visit records')
    .addTag('Initial Notes', 'Initial consultation SOAP notes')
    .addTag('Progress Notes', 'Progress notes with copy-forward logic')
    .addTag('Problems', 'Problem list management')
    .addTag('Medications', 'Medication management')
    .addTag('Vitals', 'Vital signs recording and history')
    .addTag('Documents', 'Document generation and retrieval')
    .addTag('Attachments', 'File uploads and signed URL downloads')
    .addTag('Audit Logs', 'Complete audit trail')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // ─────────────────────────────────────────────
  // START SERVER
  // ─────────────────────────────────────────────
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`✓ DAMAYAN API running   → http://localhost:${port}`);
  console.log(`✓ Swagger docs          → http://localhost:${port}/api`);
}

bootstrap();
