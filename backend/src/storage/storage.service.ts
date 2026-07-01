import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly bucket = 'damayan-attachments';

  constructor(private readonly supabase: SupabaseClient) {}

  async upload(path: string, buffer: Buffer, contentType: string): Promise<string> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(path, buffer, { contentType, upsert: false });
    if (error) throw error;
    return path;
  }

  async getSignedUrl(storageKey: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(storageKey, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  }

  async delete(storageKey: string): Promise<void> {
    const { error } = await this.supabase.storage.from(this.bucket).remove([storageKey]);
    if (error) throw error;
  }
}
