import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access_token')
  @ApiOperation({
    summary: 'Provision a new user (Admin only)',
    description:
      'Creates a new user via Supabase service_role key. ' +
      'Self-registration is disabled — all accounts must be created through this endpoint.',
  })
  @ApiCreatedResponse({ description: 'User provisioned successfully.' })
  async createUser(@Body() createUserDto: CreateUserDto) {
    // Implementation handled in AuthService (Phase 2)
    return { message: 'User provisioned', data: createUserDto };
  }
}
