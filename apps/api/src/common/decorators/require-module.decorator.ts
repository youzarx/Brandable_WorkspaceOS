import { SetMetadata } from '@nestjs/common';

export const MODULE_KEY = 'module';
export const RequireModule = (moduleKey: string) => SetMetadata(MODULE_KEY, moduleKey);
