/**
 * Super Admin user management API — /api/admin/users.
 *
 * StaffJwtGuard authenticates; StaffRolesGuard authorises. All mutations are
 * super_admin only; the two read routes also allow administrator. The actor is
 * taken from the verified staff JWT (req.staff), never from the body.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffJwtGuard, StaffRolesGuard, StaffRoles, type StaffContext } from '../auth/staff-jwt.guard';
import { AdminUsersService } from './admin-users.service';
import { CreateUserDto, SetScopesDto, UpdateUserDto } from './admin-users.dto';

interface StaffReq {
  staff: StaffContext;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}

function actorOf(req: StaffReq) {
  return { staffId: req.staff.staffId, email: req.staff.email, role: req.staff.role };
}
function ipOf(req: StaffReq): string | undefined {
  const fwd = req.headers?.['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : fwd) ?? req.ip;
}

@Controller('api/admin/users')
@UseGuards(StaffJwtGuard, StaffRolesGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  // Read — super_admin + administrator
  @Get()
  @StaffRoles('super_admin', 'administrator')
  list(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.users.list({ role, status, search });
  }

  @Get(':id')
  @StaffRoles('super_admin', 'administrator')
  get(@Param('id') id: string) {
    return this.users.get(id);
  }

  // Mutations — super_admin only
  @Post()
  @StaffRoles('super_admin')
  create(@Body() dto: CreateUserDto, @Req() req: StaffReq) {
    return this.users.create(actorOf(req), dto, ipOf(req));
  }

  @Put(':id')
  @StaffRoles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: StaffReq) {
    return this.users.update(actorOf(req), id, dto, ipOf(req));
  }

  @Delete(':id')
  @StaffRoles('super_admin')
  remove(@Param('id') id: string, @Req() req: StaffReq) {
    return this.users.remove(actorOf(req), id, ipOf(req));
  }

  @Post(':id/invite')
  @StaffRoles('super_admin')
  invite(@Param('id') id: string, @Req() req: StaffReq) {
    return this.users.reinvite(actorOf(req), id, ipOf(req));
  }

  @Post(':id/reset-password')
  @StaffRoles('super_admin')
  resetPassword(@Param('id') id: string, @Req() req: StaffReq) {
    return this.users.resetPassword(actorOf(req), id, ipOf(req));
  }

  @Post(':id/reset-mfa')
  @StaffRoles('super_admin')
  resetMfa(@Param('id') id: string, @Req() req: StaffReq) {
    return this.users.resetMfa(actorOf(req), id, ipOf(req));
  }

  @Post(':id/revoke-sessions')
  @StaffRoles('super_admin')
  revokeSessions(@Param('id') id: string, @Req() req: StaffReq) {
    return this.users.revokeSessions(actorOf(req), id, ipOf(req));
  }

  @Put(':id/scopes')
  @StaffRoles('super_admin')
  setScopes(@Param('id') id: string, @Body() dto: SetScopesDto, @Req() req: StaffReq) {
    return this.users.setScopes(actorOf(req), id, dto.scopes, ipOf(req));
  }
}
