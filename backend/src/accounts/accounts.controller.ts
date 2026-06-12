import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { CreateAccountDto } from './dto/create-account.dto';

@ApiTags('Accounts')
@ApiBearerAuth('access_token')
@Controller('accounts')
export class AccountsController {
  @Get()
  @ApiOperation({ summary: 'List all user accounts (Admin only)' })
  @ApiOkResponse({ description: 'Paginated list of accounts.' })
  async findAll(
    @Query('role') role?: string,
    @Query('is_active') isActive?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    // Phase 2: implement AccountsService.findAll()
    return { message: 'stub — implement in Phase 2' };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create user account (Admin only)',
    description:
      'Provisions a new Doctor or Nurse account. ' +
      'Generates a cryptographically random temporary password (16 chars). ' +
      'Returns temp password once — never stored.',
  })
  @ApiCreatedResponse({ description: 'Account created; temp password returned once.' })
  async create(@Body() dto: CreateAccountDto) {
    // Phase 2: implement AccountsService.create()
    return { message: 'stub — implement in Phase 2', data: dto };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single account profile (Admin only)' })
  async findOne(@Param('id') id: string) {
    // Phase 2: implement AccountsService.findOne()
    return { message: 'stub — implement in Phase 2', id };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update account name or role (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateAccountDto>) {
    // Phase 2: implement AccountsService.update()
    return { message: 'stub — implement in Phase 2', id };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate account (Admin only)',
    description:
      'Soft-deactivates the account: sets is_active = false in users table ' +
      'and disables login in Supabase Auth. Audit trail is preserved.',
  })
  async deactivate(@Param('id') id: string) {
    // Phase 2: implement AccountsService.deactivate()
    return { message: 'stub — implement in Phase 2', id };
  }
}
