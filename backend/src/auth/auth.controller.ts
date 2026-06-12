import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
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
  @Get('me')
  @ApiBearerAuth('access_token')
  @ApiOperation({ summary: 'Get current user profile from JWT' })
  async getMe() {
    // Phase 2: extract from @CurrentUser() decorator
    return { message: 'stub — implement in Phase 2' };
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access_token')
  @ApiOperation({
    summary: 'Provision a new user (Admin only)',
    description:
      'Creates a new user via Supabase service_role key. ' +
      'Self-registration is disabled. All accounts must be created through this endpoint.',
  })
  @ApiCreatedResponse({ description: 'User provisioned successfully.' })
  async createUser(@Body() dto: CreateUserDto) {
    // Phase 2: implement AuthService.provisionUser()
    return { message: 'stub — implement in Phase 2', data: dto };
  }

  @Patch('users/:id')
  @ApiBearerAuth('access_token')
  @ApiOperation({ summary: 'Update role or deactivate account (Admin only)' })
  async updateUser(@Param('id') id: string, @Body() dto: Partial<CreateUserDto>) {
    // Phase 2: implement AuthService.deactivateUser()
    return { message: 'stub — implement in Phase 2', id };
  }

  @Post('change-password')
  @ApiBearerAuth('access_token')
  @ApiOperation({ summary: 'Change password (authenticated user)' })
  async changePassword(@Body() dto: any) {
    // Phase 2: implement ChangePasswordDto + AuthService
    return { message: 'stub — implement in Phase 2' };
  }
}
