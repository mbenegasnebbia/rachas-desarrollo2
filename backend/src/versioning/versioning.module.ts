import {
  BadRequestException,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpException,
  Injectable,
  Logger,
  Module,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import type { CallHandler, NestInterceptor } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { map } from 'rxjs';
import { Public } from '../auth/auth.decorators';
import { adaptInput, contract, isV2 } from './contract';
import { compareVersions, validVersion, VersionPolicy } from './version-policy';

@Controller('version-policy')
export class VersionPolicyController {
  constructor(private readonly policy: VersionPolicy) {}
  @Get()
  @Public()
  get() {
    return this.policy.getPolicy();
  }
}

@Injectable()
export class AppVersionGuard implements CanActivate {
  constructor(private readonly policy: VersionPolicy) {}
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path
      .toLowerCase()
      .replace(/^\/v[12](?=\/|$)/, '')
      .replace(/\/$/, '');
    // Authentication remains authenticated, but is exempt from version enforcement.
    if (
      path === '' ||
      path === '/version-policy' ||
      /^\/auth(?:\/|$)/.test(path) ||
      /^\/analytics\/(events|consent)$/.test(path)
    )
      return true;
    const version = request.headers['x-app-version'] ?? '1.0.0';
    if (typeof version !== 'string' || !validVersion(version))
      throw new BadRequestException(
        'x-app-version debe usar major.minor.patch',
      );
    if (compareVersions(version, this.policy.minimum) < 0)
      throw new HttpException(
        {
          statusCode: 426,
          message: 'Necesitás actualizar Rachas para continuar.',
          ...this.policy.getPolicy(),
        },
        426,
      );
    adaptInput(request);
    return true;
  }
}

@Injectable()
export class ContractInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const v2 = isV2(context.switchToHttp().getRequest<Request>());
    return next.handle().pipe(map((value: unknown) => contract(value, v2)));
  }
}

// Registered before routing: includes 401/426 responses, never logs tokens or IDs.
@Injectable()
export class LegacyUsage {
  private count = 0;
  private readonly logger = new Logger('ApiV1');
  constructor(private readonly policy: VersionPolicy) {}
  use(request: Request, response: Response, next: NextFunction): void {
    const discovery = /^\/(?:version-policy)?\/?$/i.test(request.path);
    if (!isV2(request) && !discovery && request.method !== 'OPTIONS') {
      response.setHeader('Deprecation', this.policy.deprecatedAt);
      response.setHeader('Sunset', this.policy.sunset);
      response.on('finish', () => {
        this.count++;
        this.logger.log({
          event: 'api.v1.request',
          count: this.count,
          method: request.method,
          status: response.statusCode,
        });
      });
    }
    next();
  }
}
@Module({
  imports: [ConfigModule],
  controllers: [VersionPolicyController],
  providers: [
    VersionPolicy,
    LegacyUsage,
    { provide: APP_GUARD, useClass: AppVersionGuard },
    { provide: APP_INTERCEPTOR, useClass: ContractInterceptor },
  ],
  exports: [VersionPolicy, LegacyUsage],
})
export class VersioningModule {}
