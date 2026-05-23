import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() email: string;
  @MinLength(6) password: string;
  @IsNotEmpty() fullName: string;
  @IsNotEmpty() orgName: string;
  @IsOptional() subdomain?: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @MinLength(6) password: string;
}
