import { ConfigService } from '@nestjs/config';

export function mongoOptions(config: ConfigService) {
  const autoInit = config.get<string>('MONGODB_AUTO_INIT_ENABLED') === 'true';
  return {
    uri: config.getOrThrow<string>('MONGODB_URI'),
    autoCreate: autoInit,
    autoIndex: autoInit,
  };
}
