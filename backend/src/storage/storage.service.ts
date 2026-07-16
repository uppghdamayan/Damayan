import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly bucket = 'damayan-attachments';

  constructor(private readonly supabase: SupabaseClient) {}

  async upload(path: string, buffer: Buffer, contentType: string): Promise<string> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(path, buffer, { contentType, upsert: false });
    if (error) {
      const status = error.status ? parseInt(error.status as any, 10) : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(error.message || 'Storage upload error', isNaN(status) ? HttpStatus.INTERNAL_SERVER_ERROR : status);
    }
    return path;
  }

  async getSignedUrl(storageKey: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(storageKey, expiresInSeconds);
    if (error) {
      const status = error.status ? parseInt(error.status as any, 10) : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(error.message || 'Storage getUrl error', isNaN(status) ? HttpStatus.INTERNAL_SERVER_ERROR : status);
    }
    return data.signedUrl;
  }

  async delete(storageKey: string): Promise<void> {
    const { error } = await this.supabase.storage.from(this.bucket).remove([storageKey]);
    if (error) {
      const status = error.status ? parseInt(error.status as any, 10) : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(error.message || 'Storage delete error', isNaN(status) ? HttpStatus.INTERNAL_SERVER_ERROR : status);
    }
  }
}
