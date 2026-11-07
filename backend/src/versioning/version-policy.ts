import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Stable application releases only; prereleases are not distributed by Rachas.
export function validVersion(value: string): boolean {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value);
}
export function compareVersions(a: string, b: string): number {
  if (!validVersion(a) || !validVersion(b))
    throw new Error('Versión inválida: usar major.minor.patch');
  const aa = a.split('.'),
    bb = b.split('.');
  for (let i = 0; i < 3; i++) {
    if (aa[i].length !== bb[i].length)
      return aa[i].length > bb[i].length ? 1 : -1;
    if (aa[i] !== bb[i]) return aa[i] > bb[i] ? 1 : -1;
  }
  return 0;
}
@Injectable()
export class VersionPolicy {
  readonly minimum: string;
  readonly recommended: string;
  readonly sunset: string;
  readonly deprecatedAt = '@1793923200'; // 2026-11-06 UTC: introduction of v2.
  readonly updateUrl: string | null;
  constructor(config: ConfigService) {
    this.minimum = config.get<string>('MIN_APP_VERSION') || '1.0.0';
    this.recommended = config.get<string>('RECOMMENDED_APP_VERSION') || '1.1.0';
    if (compareVersions(this.minimum, this.recommended) > 0)
      throw new Error('RECOMMENDED_APP_VERSION debe ser >= MIN_APP_VERSION');
    const sunset =
      config.get<string>('V1_SUNSET_DATE') || '2027-06-30T23:59:59Z';
    const date = new Date(sunset);
    if (!Number.isFinite(date.getTime()) || date.getTime() < 1793923200000)
      throw new Error('V1_SUNSET_DATE inválida o anterior a la deprecación');
    this.sunset = date.toUTCString();
    const url = config.get<string>('APP_UPDATE_URL');
    if (url) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error('APP_UPDATE_URL debe ser una URL pública http(s)');
      }
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      )
        throw new Error('APP_UPDATE_URL debe ser http(s) sin credenciales');
    }
    this.updateUrl = url || null;
  }
  getPolicy() {
    return {
      minimumVersion: this.minimum,
      recommendedVersion: this.recommended,
      updateUrl: this.updateUrl,
      instructions:
        'Web: recargá la página para obtener la versión publicada. Android/iOS: instalá el nuevo build provisto por el responsable de Rachas.',
    };
  }
}
