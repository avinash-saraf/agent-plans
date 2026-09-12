import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Matches, Min } from 'class-validator';

export class RevisionDto {
  @IsInt() @Min(0) revision: number;
}
export class CityDto extends RevisionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  city: string;
}
export class CreateGroupDto {
  @IsString()
  @Length(1, 60)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  city: string;
}
export class MemberDto extends RevisionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 80)
  name: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 4000)
  context: string;
}
