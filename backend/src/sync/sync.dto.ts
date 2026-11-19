import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsISO8601, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { STORES } from './records.js';

export class ChangeDto {
  @IsIn(STORES as unknown as string[])
  store!: (typeof STORES)[number];

  @IsIn(['upsert', 'delete'])
  op!: 'upsert' | 'delete';

  @IsObject()
  data!: Record<string, unknown>;
}

export class PushDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ChangeDto)
  changes!: ChangeDto[];
}

export class PullQueryDto {
  @IsOptional()
  @IsISO8601()
  since?: string;
}
